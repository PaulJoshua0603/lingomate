'use strict';
// Australian English coach. Loaded after app.js and reuses its helpers
// ($, $$, esc, icon, store, toast, listen, synth, voices, norm, similar, shuffle, studied, streak, VIEWS).

/* ---------- Settings & progress (saved in this browser) ---------- */
const COACH_DEFAULTS = {
  name: '', role: 'HR Admin', manager: 'Sarah', accent: 'australian', level: 'intermediate', speed: 1,
  correction: 'after', explain: 'taglish', topics: TOPICS.map(t => t.id), duration: 15, voice: 'female', accessCode: '',
};
const CS = { ...COACH_DEFAULTS, ...store.get('coach-settings', {}) };
const saveCS = () => store.set('coach-settings', CS);
const CP = { days: {}, sessions: [], grammar: [], pron: [], confidence: [], vocab: {}, recent: [], goals: { days: 5, convos: 5 }, ...store.get('coach-progress', {}) };
function saveCP() {
  CP.days = Object.fromEntries(Object.keys(CP.days).sort().slice(-120).map(k => [k, CP.days[k]]));
  ['sessions', 'grammar', 'pron', 'confidence'].forEach(k => (CP[k] = CP[k].slice(-300)));
  CP.recent = CP.recent.slice(-30);
  store.set('coach-progress', CP);
}
const avg = a => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
const clamp100 = n => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));
const dkey = (d = new Date()) => d.toLocaleDateString('en-CA');
const weekDays = () => {
  const now = new Date(), monday = now.getDate() - ((now.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), monday + i));
};
const profile = () => ({ name: CS.name, role: CS.role, manager: CS.manager, level: CS.level, explain: CS.explain, accent: CS.accent });

let lastAct = 0;
// Practice time: gaps under 2 minutes between actions count as practice
function activity(turns = 0) {
  const now = Date.now(), d = (CP.days[dkey()] ||= { sec: 0, turns: 0 });
  d.sec += lastAct && now - lastAct < 120000 ? (now - lastAct) / 1000 : 20;
  d.turns += turns;
  lastAct = now;
  saveCP(); studied();
}
function logScore(list, s) { if (Number.isFinite(s)) { CP[list].push({ t: Date.now(), s: clamp100(s) }); saveCP(); } }
function addVocab(v) { if (v?.term && !CP.vocab[v.term]) CP.vocab[v.term] = { meaning: v.meaning || '', t: Date.now() }; }

/* ---------- Server connection ---------- */
let ST = { reachable: false, ai: false, voice: false, pronunciation: false, transcribe: false, authorized: false, model: null };
const aiReady = () => ST.ai && ST.authorized;
const azureReady = () => ST.voice && ST.authorized;
const transcribeReady = () => ST.transcribe && ST.authorized;
async function checkStatus() {
  try {
    const r = await fetch('/api/status', { headers: { 'x-access-code': CS.accessCode }, cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('no server');
    ST = { ...(await r.json()), reachable: true };
  } catch {
    ST = { reachable: false, ai: false, voice: false, pronunciation: false, transcribe: false, authorized: false, model: null };
  }
  refreshCoach();
}
async function api(path, body) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 70000);
  try {
    const r = await fetch('/api/' + path, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'x-access-code': CS.accessCode }, body: JSON.stringify(body) });
    const json = (r.headers.get('content-type') || '').includes('json');
    if (!r.ok) throw new Error((json && (await r.json().catch(() => ({}))).error) || `Server error (${r.status})`);
    return json ? r.json() : r.blob();
  } catch (e) {
    throw e.name === 'AbortError' ? new Error('The tutor took too long to answer. Try again.') : e;
  } finally { clearTimeout(timer); }
}
function bannerHtml() {
  if (aiReady()) return '';
  const [h, p, act] = !ST.reachable
    ? ['AI tutor offline', "The AI tutor runs on the app's server, which isn't available here (for example on a plain local web server). It works on the deployed site.", '']
    : !ST.ai
      ? ['AI tutor not set up yet', 'The site owner needs to add an Anthropic API key and an access code on the server. Settings → AI connection shows the steps.', '<a class="btn rp" href="#settings">See setup steps</a>']
      : ['Enter your access code', 'The AI tutor is set up. Enter your access code in Settings to unlock it.', '<a class="btn primary rp" href="#settings">Enter access code</a>'];
  return `<div class="banner card"><div><b>${h}</b><p>${p}</p></div>${act}</div>`;
}

/* ---------- Voice output ---------- */
let speaking = false, audioEl = null, sayTok = 0;
const voiceLang = () => (CS.accent === 'australian' ? 'en-AU' : 'en-US');
const FEMALE = /natasha|karen|catherine|annette|carly|freya|tina|elsie|kim|joanne|female|samantha|jenny|aria|zira|ava|allison|libby|sonia/i;
const MALE = /william|lee|james|duncan|ken|tim|neil|darren|male|guy|david|mark|daniel|alex|fred|ryan|thomas/i;
const NATURAL = /natural|online|premium|enhanced/i;
function deviceVoice() {
  const L = voiceLang().toLowerCase(), want = CS.voice === 'male' ? MALE : FEMALE;
  const list = voices.filter(v => v.lang.toLowerCase().replace('_', '-') === L);
  // A natural (neural) voice of either gender sounds far more human than a robotic one of the chosen gender
  return list.find(v => want.test(v.name) && NATURAL.test(v.name)) || list.find(v => NATURAL.test(v.name)) || list.find(v => want.test(v.name)) || list[0] || null;
}
// Dashes, brackets, ellipses and emoji make voices pause awkwardly or read symbols aloud
const speakable = t => String(t).replace(/\p{Extended_Pictographic}/gu, '').replace(/\s*(?:[—–;…]|\.{3}|\s-\s)\s*/g, ', ')
  .replace(/[()[\]{}"*_#~]/g, '').replace(/\s+([,.!?])/g, '$1').replace(/([,.!?]),+/g, '$1').replace(/\s{2,}/g, ' ').trim();
function setSpeaking(on) { speaking = on; if (SESS.call && !SESS.call.summary && currentView() === 'call') renderCall(); }
function stopSpeaking() { sayTok++; synth?.cancel(); audioEl?.pause(); audioEl = null; if (speaking) setSpeaking(false); }
async function say(text, rate = CS.speed) {
  stopSpeaking();
  text = speakable(text || '');
  if (!text) return;
  const tok = sayTok;
  setSpeaking(true);
  try {
    if (azureReady()) {
      try {
        const blob = await api('tts', { text, rate, voice: `${CS.accent === 'australian' ? 'au' : 'neutral'}-${CS.voice}` });
        if (tok !== sayTok) return;
        const url = URL.createObjectURL(blob);
        audioEl = new Audio(url);
        await new Promise(res => { audioEl.onended = audioEl.onerror = res; audioEl.play().catch(res); });
        URL.revokeObjectURL(url);
        return;
      } catch { /* fall back to the device voice */ }
    }
    if (tok === sayTok) await deviceSay(text, rate);
  } finally { if (tok === sayTok) setSpeaking(false); }
}
function deviceSay(text, rate) {
  return new Promise(res => {
    if (!synth) return res();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voiceLang(); u.voice = deviceVoice(); u.rate = rate;
    const timer = setTimeout(res, 3000 + (text.length * 110) / rate); // Safari sometimes never fires onend
    u.onend = u.onerror = () => { clearTimeout(timer); res(); };
    synth.speak(u);
  });
}

/* ---------- Recording an answer (listen back, re-record, fix the words before sending) ---------- */
// Records the mic for playback. Unless the server transcribes the audio (Whisper), the browser's speech
// recognition runs alongside for the words. Returns { stop, abort, done } or null; done gives { blob, url, text } or { aborted }.
async function capture({ recognise, onText } = {}) {
  const audio = navigator.mediaDevices?.getUserMedia && window.MediaRecorder ? await startRecording().catch(() => null) : null;
  if (!audio && !recognise) throw new Error('Allow microphone access to record your answer.');
  let sr = null, text = '', aborted = false;
  const srDone = new Promise(res => {
    if (recognise) sr = listen(voiceLang(), { continuous: true, onText: t => { text = t; onText?.(t); }, onEnd: res });
    if (!sr) res();
  });
  if (!audio && !sr) return null;
  const stop = () => { audio?.stop(); sr?.stop(); };
  const auto = setTimeout(stop, 120000); // keeps uploads small
  return {
    stop,
    abort: () => { aborted = true; stop(); },
    done: Promise.all([audio?.done, srDone]).then(([blob]) => {
      clearTimeout(auto);
      if (aborted) return { aborted };
      return { blob: blob?.size ? blob : null, url: blob?.size ? URL.createObjectURL(blob) : '', text: text.trim() };
    }),
  };
}
function dropTake(s) { if (s?.take?.url) URL.revokeObjectURL(s.take.url); if (s) s.take = null; }
const takeHtml = (t, m) => `<div class="take">
    <p>${t.busy ? 'Writing down what you said…' : 'Listen back, then check the words and fix anything we misheard before you send.'}</p>
    ${t.url ? `<audio controls preload="metadata" src="${t.url}" aria-label="Your recording"></audio>` : ''}
    <button type="button" class="btn rp" data-coach="retake" data-m="${m}"${t.busy ? ' disabled' : ''}>${icon('mic')}Re-record</button>
  </div>`;

/* ---------- Conversations (daily chat, weekly check-in, live call) ---------- */
const SESS = {};
let talkTopic = CS.topics[0] || 'daily', callScenario = 'surprise', coachRec = null, recMode = null;
const currentView = () => { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : 'home'; };
function persona(mode) {
  if (mode === 'daily') {
    const topic = TOPICS.find(t => t.id === talkTopic)?.label || 'Daily conversation';
    return { name: 'Jess', initial: 'J', sub: 'Aussie workmate', title: 'Jess · your Aussie workmate', blurb: `Topic: ${topic}. Jess starts the chat; answer by voice or by typing.`, cta: 'Start chatting' };
  }
  const m = CS.manager || 'Sarah';
  return mode === 'checkin'
    ? { name: m, initial: m[0].toUpperCase(), sub: 'Your manager', title: `${m} · your manager`, blurb: 'Your weekly one-on-one: 9 stages, about 10 to 15 minutes.', cta: 'Start check-in' }
    : { name: m, initial: m[0].toUpperCase(), sub: 'Your manager' };
}
const deferredFeedback = mode => mode === 'call' || CS.correction === 'end';
const scoreCls = s => (s >= 85 ? 's-good' : s >= 65 ? 's-mid' : 's-low');

function startSession(mode) {
  if (!aiReady()) return toast('The AI tutor is not connected. See Settings.');
  stopSpeaking(); coachRec?.abort();
  SESS[mode] = { mode, history: [], items: [], stage: 0, ended: false, busy: false, started: Date.now(), scores: [], draft: '', error: '', topic: talkTopic, scenario: callScenario };
  activity();
  turn(mode);
}
async function turn(mode, userText = '') {
  const s = SESS[mode];
  if (!s || s.busy || s.ended) return;
  if (!aiReady()) return toast('The AI tutor is not connected. See Settings.');
  if (userText) { s.items.push({ who: 'me', text: userText }); s.draft = ''; dropTake(s); activity(1); }
  s.busy = true; s.error = '';
  renderCoach(mode);
  try {
    const out = await api('chat', { task: 'turn', mode, userText, history: s.history, stage: s.stage, topic: s.topic, scenario: s.scenario, profile: profile(), feedback: !deferredFeedback(mode) });
    if (userText) s.history.push({ role: 'user', content: userText });
    s.history.push({ role: 'assistant', content: out.reply });
    const fb = out.feedback;
    if (fb) {
      s.items[s.items.length - 1].fb = fb;
      s.scores.push(fb.grammarScore);
      logScore('grammar', fb.grammarScore);
      fb.vocabulary.forEach(addVocab);
      if (norm(fb.corrected) !== norm(fb.original)) CP.recent.push(fb);
      saveCP();
    }
    s.items.push({ who: 'ai', text: out.reply });
    s.stage = Math.max(s.stage, out.stage);
    s.ended = out.ended;
  } catch (e) {
    if (userText) { s.items.pop(); s.draft = userText; }
    s.error = e.message;
  } finally { s.busy = false; }
  renderCoach(mode);
  const last = s.items.at(-1);
  if (!s.error && last?.who === 'ai') await say(last.text);
  if (s.ended && !s.summary) endSession(mode);
}
async function endSession(mode) {
  const s = SESS[mode];
  if (!s || s.summary) return;
  coachRec?.abort(); stopSpeaking();
  s.ended = true; s.endedAt = Date.now();
  const turns = s.items.filter(i => i.who === 'me').length;
  s.summary = { turns, minutes: Math.max(1, Math.round((s.endedAt - s.started) / 60000)), grammar: avg(s.scores), review: null, loading: false, conf: null };
  if (turns && deferredFeedback(mode) && aiReady()) {
    s.summary.loading = true;
    renderCoach(mode);
    try {
      const r = await api('chat', { task: 'review', mode, history: s.history, profile: profile() });
      s.summary.review = r;
      s.summary.grammar = r.grammarScore;
      logScore('grammar', r.grammarScore);
      r.vocabulary.forEach(addVocab);
      CP.recent.push(...r.improvements);
    } catch (e) { s.summary.error = e.message; }
    s.summary.loading = false;
  }
  if (turns) CP.sessions.push({ t: Date.now(), mode, turns, grammar: s.summary.grammar });
  saveCP();
  renderCoach(mode);
}
// Records until you tap stop, then holds the answer for review instead of sending it straight away
async function toggleMic(mode) {
  if (recMode) return coachRec?.stop();
  const s = SESS[mode];
  if (!s || s.busy || s.ended || s.take?.busy) return;
  stopSpeaking(); dropTake(s);
  recMode = mode;
  try {
    coachRec = await capture({ recognise: !transcribeReady(), onText: t => { const live = $(`#live-${mode}`); if (live) live.textContent = t; } });
  } catch (e) { toast(e.message); }
  if (!coachRec) { recMode = null; return renderCoach(mode); }
  renderCoach(mode);
  const take = await coachRec.done;
  coachRec = null; recMode = null;
  if (take.aborted || SESS[mode] !== s) return renderCoach(mode);
  if (!take.blob && !take.text) { renderCoach(mode); return toast("We didn't catch anything. Tap the mic and try again."); }
  s.take = { url: take.url, busy: !!take.blob && transcribeReady() };
  if (take.text) s.draft = take.text;
  renderCoach(mode);
  if (!s.take.busy) return;
  try {
    const prompt = s.items.filter(i => i.who === 'ai').at(-1)?.text || '';
    const out = await api('transcribe', { audio: b64(new Uint8Array(await take.blob.arrayBuffer())), type: take.blob.type, prompt });
    if (s.take?.url === take.url) {
      s.draft = out.text;
      if (!out.text) toast("We couldn't make out any words. Tap Re-record and try again.");
    }
  } catch (e) { toast(e.message); }
  if (s.take?.url === take.url) s.take.busy = false;
  renderCoach(mode);
}

/* ---------- Conversation rendering ---------- */
const fmtTime = s => { const sec = Math.floor(((s.endedAt || Date.now()) - s.started) / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
const sayBtn = (text, label = 'Listen') => `<button class="icon-btn sm rp" data-coach="sayt" data-text="${esc(text)}" aria-label="${label}">${icon('vol')}</button>`;
const MISTAKE_TYPES = { grammar: 'Grammar', 'sentence structure': 'Sentence structure', vocabulary: 'Vocabulary', 'word choice': 'Word choice' };
function fbHtml(fb, open) {
  const ok = fb.correct ?? norm(fb.corrected) === norm(fb.original), list = fb.mistakes || [];
  const better = norm(fb.natural) !== norm(ok ? fb.original : fb.corrected);
  return `<details class="fb card"${open ? ' open' : ''}>
    <summary><span class="fb-score ${scoreCls(fb.grammarScore)}">${fb.grammarScore}</span>${ok ? '✓ Grammatically correct' : `${list.length || 'Some'} thing${list.length === 1 ? '' : 's'} to fix`}</summary>
    <dl>
      <dt>You said</dt><dd>${esc(fb.original)}</dd>
      ${ok ? '' : `<dt>Corrected</dt><dd><b>${esc(fb.corrected)}</b> ${sayBtn(fb.corrected)}</dd>`}
      ${list.length ? `<dt>What to improve</dt><dd><ul class="mistakes">${list.map(x => `<li><span class="tag">${esc(MISTAKE_TYPES[x.type] || x.type)}</span> <s>${esc(x.wrong)}</s> → <b>${esc(x.right)}</b><br><span class="muted">${esc(x.why)}</span></li>`).join('')}</ul></dd>` : ''}
      ${better ? `<dt>${ok ? 'Even more natural (Aussie)' : 'More natural (Aussie)'}</dt><dd><b>${esc(fb.natural)}</b> ${sayBtn(fb.natural)}</dd>` : ''}
      <dt>${ok ? 'Tip' : CS.explain === 'taglish' ? 'Bakit? (Why)' : 'Why'}</dt><dd>${esc(fb.explanation)}</dd>
      ${fb.vocabulary.length ? `<dt>Useful words</dt><dd class="vchips">${fb.vocabulary.map(v => `<span class="vchip"><b>${esc(v.term)}</b> ${esc(v.meaning)}</span>`).join('')}</dd>` : ''}
      <dt>Next question</dt><dd>${esc(fb.followUp)}</dd>
    </dl></details>`;
}
function msgsHtml(s, who) {
  const lastFb = s.items.map(i => !!i.fb).lastIndexOf(true);
  return s.items.map((it, i) => (it.who === 'ai'
    ? `<div class="msg ai"><span class="av">${who.initial}</span><div class="bubble">${esc(it.text)} ${sayBtn(it.text, 'Hear it again')}</div></div>`
    : `<div class="msg me"><div class="bubble">${esc(it.text)}</div></div>${it.fb ? fbHtml(it.fb, i === lastFb) : ''}`)).join('');
}
function reviewHtml(r) {
  return `<p>${esc(r.summary)}</p>
    ${r.strengths.length ? `<h4>What you did well</h4><ul>${r.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${r.improvements.length ? `<h4>Say it better</h4>${r.improvements.map(i => `<div class="imp"><s>${esc(i.original)}</s><p><b>${esc(i.natural)}</b> ${sayBtn(i.natural)}</p><p class="muted">${esc(i.explanation)}</p></div>`).join('')}` : ''}
    ${r.vocabulary.length ? `<h4>Useful expressions</h4><div class="vchips">${r.vocabulary.map(v => `<span class="vchip"><b>${esc(v.term)}</b> ${esc(v.meaning)}</span>`).join('')}</div>` : ''}
    ${r.confidenceTip ? `<p class="tip">💡 ${esc(r.confidenceTip)}</p>` : ''}`;
}
function summaryCard(mode, s) {
  const sm = s.summary;
  return `<div class="card summary">
    <h3>${mode === 'call' ? 'Call summary' : 'Session summary'}</h3>
    <div class="sum-stats"><span><b>${sm.turns}</b>answers</span><span><b>${sm.minutes}</b>min</span><span><b>${sm.grammar ?? '–'}</b>grammar score</span></div>
    ${sm.loading ? '<p class="muted">Reviewing your answers…</p>' : ''}
    ${sm.error ? `<p class="chat-err">Couldn't get the review: ${esc(sm.error)}</p>` : ''}
    ${sm.review ? reviewHtml(sm.review) : ''}
    ${sm.turns ? `<div class="conf"><h4>How confident did you feel speaking?</h4><div class="conf-row">${['Nervous', 'Unsure', 'Okay', 'Good', 'Confident'].map((l, i) => `<button class="chip rp${sm.conf === i + 1 ? ' on' : ''}" data-coach="conf" data-m="${mode}" data-v="${i + 1}">${i + 1} · ${l}</button>`).join('')}</div></div>` : ''}
    <button class="btn primary rp" data-coach="${mode === 'call' ? 'newcall' : 'start'}" data-m="${mode}">${mode === 'call' ? 'Make another call' : mode === 'checkin' ? 'Start a new check-in' : 'Start a new chat'}</button>
  </div>`;
}
function renderCoach(mode) {
  if (mode === 'checkin') renderStepper();
  if (mode === 'call') return renderCall();
  const box = $(`.coach[data-mode="${mode}"]`);
  if (!box) return;
  const s = SESS[mode], who = persona(mode);
  if (!s) {
    box.innerHTML = `<div class="card start-card"><span class="av lg">${who.initial}</span><div><h3>${esc(who.title)}</h3><p>${esc(who.blurb)}</p></div>
      <button class="btn primary rp" data-coach="start" data-m="${mode}"${aiReady() ? '' : ' disabled'}>${icon('chat')}${who.cta}</button></div>`;
    return;
  }
  const listening = !!coachRec && recMode === mode, hold = s.busy || !!s.take?.busy;
  box.innerHTML = `<div class="card chat${listening ? ' listening' : ''}">
    <div class="chat-head"><span class="av">${who.initial}</span><div><b>${esc(who.name)}</b><small>${who.sub}</small></div><span class="grow"></span>
      ${s.summary ? '' : `<button class="btn rp" data-coach="end" data-m="${mode}">End</button>`}</div>
    <div class="msgs" id="msgs-${mode}">${msgsHtml(s, who)}
      ${s.busy ? `<div class="msg ai"><span class="av">${who.initial}</span><div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div></div>` : ''}
      ${listening ? `<div class="msg me"><div class="bubble live" id="live-${mode}">Listening…</div></div>` : ''}
      ${s.error ? `<p class="chat-err">${esc(s.error)} <button class="link" data-coach="retry" data-m="${mode}">Try again</button></p>` : ''}
    </div>
    ${s.summary ? '' : `${s.take ? takeHtml(s.take, mode) : ''}<form class="composer" data-m="${mode}">
      <button type="button" class="mic sm" data-coach="mic" data-m="${mode}" aria-label="${listening ? "I'm finished" : 'Answer by voice'}"${hold ? ' disabled' : ''}>${icon(listening ? 'stop' : 'mic')}</button>
      <textarea rows="1" aria-label="Your answer" placeholder="${listening ? "Listening… tap ■ when you're finished" : 'Type your answer, or tap the mic and speak'}"${hold ? ' disabled' : ''}></textarea>
      <button class="mic sm send" aria-label="Send"${hold ? ' disabled' : ''}>${icon('send')}</button>
    </form>
    ${deferredFeedback(mode) ? '<p class="hint-line">Feedback comes at the end of the session (Settings → Correction timing).</p>' : ''}`}
  </div>${s.summary ? summaryCard(mode, s) : ''}`;
  const ta = $('textarea', box);
  if (ta) ta.value = s.draft || '';
  const m = $(`#msgs-${mode}`);
  if (m) m.scrollTop = m.scrollHeight;
}
function renderStepper() {
  const s = SESS.checkin, st = s ? s.stage : -1;
  $('#stepper').innerHTML = STAGES.map((l, i) => `<li class="${s?.summary || i < st ? 'done' : i === st ? 'now' : ''}"><span>${i + 1}</span>${esc(l)}</li>`).join('');
  $('#stepper .now')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function renderTopics() {
  $('#talkTopics').innerHTML = TOPICS.filter(t => CS.topics.includes(t.id))
    .map(t => `<button class="chip rp${t.id === talkTopic ? ' on' : ''}" data-coach="topic" data-v="${t.id}">${t.label}</button>`).join('');
}
function renderCall() {
  const box = $('.coach[data-mode="call"]');
  if (!box) return;
  const s = SESS.call, who = persona('call');
  if (!s) {
    box.innerHTML = `<div class="card call-setup"><span class="av xl">${who.initial}</span><h3>${esc(who.name)}</h3><p class="muted">Your Australian manager</p>
      <h4>What's the call about?</h4><div class="chips">${SCENARIOS.map(x => `<button class="chip rp${callScenario === x.id ? ' on' : ''}" data-coach="scenario" data-v="${x.id}">${x.label}</button>`).join('')}</div>
      <button class="btn call-go rp" data-coach="start" data-m="call"${aiReady() ? '' : ' disabled'}>${icon('phone')}Start call</button></div>`;
    return;
  }
  const listening = !!coachRec && recMode === 'call', hold = s.busy || !!s.take?.busy;
  const status = s.summary ? 'Call ended' : s.busy ? 'Thinking…' : speaking ? 'Speaking…' : listening ? "Listening… tap ■ when you're finished"
    : s.error || (s.take ? 'Check your answer below, then send it' : 'Your turn: tap the mic and answer');
  box.innerHTML = `<div class="card call${speaking ? ' talking' : ''}${listening ? ' listening' : ''}">
    <span class="av xl">${who.initial}</span><h3>${esc(who.name)}</h3>
    <span class="call-time" id="callTime">${fmtTime(s)}</span>
    <p class="call-status">${esc(status)}${s.error ? ` <button class="link" data-coach="retry" data-m="call">Try again</button>` : ''}</p>
    ${listening ? '<p class="live" id="live-call"></p>' : ''}
    ${s.summary ? '' : `<div class="call-ctl">
      <button class="ctl" data-coach="replay" aria-label="Repeat what ${esc(who.name)} said">${icon('vol')}<span>Repeat</span></button>
      <button class="mic xl" data-coach="mic" data-m="call" aria-label="${listening ? "I'm finished" : 'Answer'}"${hold ? ' disabled' : ''}>${icon(listening ? 'stop' : 'mic')}</button>
      <button class="ctl end" data-coach="end" data-m="call" aria-label="End call">${icon('phone')}<span>End</span></button></div>
    ${s.take ? takeHtml(s.take, 'call') : ''}
    <form class="composer call-type" data-m="call"><textarea rows="1" aria-label="Type your answer" placeholder="Or type your answer"${hold ? ' disabled' : ''}></textarea><button class="mic sm send" aria-label="Send"${hold ? ' disabled' : ''}>${icon('send')}</button></form>`}
    <details class="transcript"${s.summary ? ' open' : ''}><summary>Transcript</summary>
      ${s.items.map(it => `<p class="tl"><b>${it.who === 'ai' ? esc(who.name) : 'You'}:</b> ${esc(it.text)}</p>`).join('')}</details>
  </div>${s.summary ? summaryCard('call', s) : ''}`;
  const ta = $('textarea', box);
  if (ta) ta.value = s.draft || '';
}
setInterval(() => { const el = $('#callTime'), s = SESS.call; if (el && s && !s.summary) el.textContent = fmtTime(s); }, 1000);

/* ---------- Voice practice ---------- */
const ALL_SENT = Object.values(SENTENCES).flat();
const VP = { tab: 'repeat', cat: Object.keys(SENTENCES)[0], idx: 0, res: null, rec: null, take: null, busy: false, dIdx: Math.random() * ALL_SENT.length | 0, dRes: null, dTyped: '', cIdx: 0, cOrder: null, cPick: null };

// Word-level alignment (longest common subsequence) of what was heard against the target sentence
function align(ref, heard) {
  const words = ref.split(/\s+/), a = words.map(norm), b = norm(heard).split(' ').filter(Boolean);
  const eq = (x, y) => x === y || similar(x, y) >= 0.8;
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] && eq(a[i], b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hit = a.map(x => !x);
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] && eq(a[i], b[j]) && L[i][j] === L[i + 1][j + 1] + 1) { hit[i] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return { words: words.map((w, i) => ({ word: w, ok: hit[i] })), score: Math.round(100 * hit.filter(Boolean).length / Math.max(1, a.length)) };
}
const wCls = w => (w.ok !== undefined ? (w.ok ? 'w-ok' : 'w-miss') : w.error === 'Omission' || w.score < 60 ? 'w-miss' : w.score < 80 ? 'w-mid' : 'w-ok');
const scoreWords = ws => ws.map(w => `<span class="${wCls(w)}">${esc(w.word)}</span>`).join(' ');
function resultHtml(r) {
  const weak = r.words.filter(w => wCls(w) !== 'w-ok').map(w => w.word);
  const verdict = r.score >= 90 ? 'Excellent, very clear!' : r.score >= 75 ? 'Good, mostly clear.' : r.score >= 50 ? 'Getting there.' : "Let's try that again.";
  const bars = r.scores ? `<div class="sbars">${[['Accuracy', r.scores.accuracy], ['Fluency', r.scores.fluency], ['Completeness', r.scores.completeness], ['Intonation', r.scores.prosody]]
    .filter(([, v]) => v != null).map(([l, v]) => `<div><span>${l}</span><span class="progress"><i style="width:${clamp100(v)}%"></i></span><b>${clamp100(v)}</b></div>`).join('')}</div>` : '';
  const tip = !r.heard ? 'Make sure your microphone is allowed and speak a little louder.'
    : weak.length ? `Practise: ${weak.slice(0, 5).map(esc).join(', ')}. Say them slowly, then at normal speed.`
      : r.scores?.fluency < 70 ? 'Try saying the whole sentence in one smooth breath.' : 'Try it at a faster speed next.';
  return `<div class="vp-res"><div class="ring-prog sm" style="--p:${r.score}"><span>${r.score}</span></div>
    <div><b>${verdict}</b><p>${r.heard ? `We heard: “${esc(r.heard)}”` : "We didn't catch anything."}</p>${bars}<p class="muted">${tip}</p></div></div>`;
}
function repeatPane() {
  const list = SENTENCES[VP.cat], sent = list[VP.idx], r = VP.res;
  return `<div class="cats">${Object.keys(SENTENCES).map(c => `<button class="chip rp${c === VP.cat ? ' on' : ''}" data-coach="vcat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <div class="card vp${VP.rec ? ' listening' : ''}">
    <div class="vp-top"><span class="w-top">Sentence ${VP.idx + 1} of ${list.length}</span>${azureReady() ? '<span class="tag good-tag">Precise scoring · Azure Speech</span>' : '<span class="tag">Basic check · speech recognition</span>'}</div>
    <p class="vp-sent">${r ? scoreWords(r.words) : esc(sent)}</p>
    <div class="vp-act">
      <button class="btn rp" data-coach="vplay" data-text="${esc(sent)}">${icon('vol')}Listen</button>
      <button class="btn rp" data-coach="vplay" data-text="${esc(sent)}" data-slow="1">${icon('vol')}Slowly</button>
      <span class="grow"></span>
      <button class="mic lg" data-coach="vrec" aria-label="${VP.rec ? 'Stop recording' : 'Record yourself'}"${VP.busy ? ' disabled' : ''}>${icon(VP.rec ? 'stop' : 'mic')}</button>
    </div>
    <p class="vp-hint">${VP.busy ? 'Checking your pronunciation…' : VP.rec ? 'Recording… say the sentence, then tap ■' : VP.take ? 'Listen to your recording. Happy with it? Check it, or record again.' : 'Listen first, then tap the mic and say the sentence.'}</p>
    ${VP.take ? `<div class="take">
      ${VP.take.url ? `<audio controls preload="metadata" src="${VP.take.url}" aria-label="Your recording"></audio>` : ''}
      ${vpAzure() ? '' : `<p>We heard: “${esc(VP.take.text) || '…'}”</p>`}
      <div class="take-act"><button class="btn rp" data-coach="vrec"${VP.busy ? ' disabled' : ''}>${icon('mic')}Re-record</button>
        <button class="btn primary rp" data-coach="vcheck"${VP.busy ? ' disabled' : ''}>${icon('check')}Check my pronunciation</button></div></div>` : ''}
    ${r ? resultHtml(r) : ''}
    <div class="vp-nav"><button class="btn ghost rp" data-coach="vnav" data-v="-1">Previous</button><button class="btn rp" data-coach="vnav" data-v="1">Next sentence</button></div>
  </div>
  ${azureReady() ? '' : "<p class=\"note\">Precise pronunciation and intonation scores need the optional Azure Speech connection (Settings → AI connection). The basic check compares what your browser's speech recognition heard with the sentence.</p>"}`;
}
function dictPane() {
  const n = VP.dIdx % ALL_SENT.length, sent = ALL_SENT[n], r = VP.dRes;
  return `<div class="card vp">
    <div class="vp-top"><span class="w-top">Listen & type · ${n + 1} of ${ALL_SENT.length}</span></div>
    <p class="vp-hint">Play the sentence, then type exactly what you heard.</p>
    <div class="vp-act"><button class="btn primary rp" data-coach="vplay" data-text="${esc(sent)}">${icon('vol')}Play</button><button class="btn rp" data-coach="vplay" data-text="${esc(sent)}" data-slow="1">${icon('vol')}Slowly</button></div>
    <form class="dict" id="dictForm"><input id="dictIn" aria-label="What you heard" placeholder="Type what you heard" autocomplete="off" autocapitalize="off" value="${esc(VP.dTyped)}"${r ? ' disabled' : ''}><button class="btn rp"${r ? ' disabled' : ''}>Check</button></form>
    ${r ? `<div class="vp-res"><div class="ring-prog sm" style="--p:${r.score}"><span>${r.score}</span></div><div><p class="vp-sent sm">${scoreWords(r.words)}</p><p class="muted">${r.score === 100 ? 'Perfect!' : 'Red words were missed or misspelled.'}</p></div></div>` : ''}
    <div class="vp-nav"><span></span><button class="btn rp" data-coach="dnext">Next sentence</button></div>
  </div>`;
}
function compPane() {
  const n = VP.cIdx % LISTENING.length, it = LISTENING[n], done = VP.cPick != null;
  VP.cOrder ||= shuffle([0, 1, 2, 3]);
  return `<div class="card vp">
    <div class="vp-top"><span class="w-top">Listen & understand · ${n + 1} of ${LISTENING.length}</span></div>
    <div class="vp-act"><button class="btn primary rp" data-coach="vplay" data-text="${esc(it.say)}">${icon('vol')}Play</button><button class="btn rp" data-coach="vplay" data-text="${esc(it.say)}" data-slow="1">${icon('vol')}Slowly</button></div>
    <p class="ask">${esc(it.q)}</p>
    <div class="opts long${done ? ' done' : ''}">${VP.cOrder.map(i => `<button class="opt rp${done && i === 0 ? ' correct' : ''}${VP.cPick === i && i !== 0 ? ' wrong' : ''}" data-coach="cpick" data-v="${i}"${done ? ' disabled' : ''}>${esc(it.options[i])}</button>`).join('')}</div>
    ${done ? `<p class="vp-sent sm">“${esc(it.say)}”</p>` : ''}
    <div class="vp-nav"><span></span><button class="btn rp" data-coach="cnext">Next</button></div>
  </div>`;
}
function renderVoice() {
  $$('#voiceTabs .chip').forEach(b => b.classList.toggle('on', b.dataset.coach === 'vtab' && b.dataset.v === VP.tab));
  $('#voicePane').innerHTML = VP.tab === 'repeat' ? repeatPane() : VP.tab === 'dictation' ? dictPane() : compPane();
}
// Raw recording → 16 kHz mono 16-bit WAV, the format Azure pronunciation assessment expects
async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const mr = new MediaRecorder(stream), chunks = [];
  mr.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(res => (mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); res(new Blob(chunks, { type: mr.mimeType })); }));
  mr.start();
  return { stop: () => mr.state !== 'inactive' && mr.stop(), done };
}
async function toWav16k(blob) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const off = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, Math.ceil(buf.duration * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = buf; src.connect(off.destination); src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const v = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  pcm.forEach((x, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x)) * 0x7fff, true));
  return new Uint8Array(v.buffer);
}
const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
function finishVp() { if (VP.res?.heard) { logScore('pron', VP.res.score); activity(); } renderVoice(); }
const vpAzure = () => azureReady() && !!navigator.mediaDevices?.getUserMedia && !!window.MediaRecorder;
const vpDrop = () => { if (VP.take?.url) URL.revokeObjectURL(VP.take.url); VP.take = null; };
// Record → listen back → re-record or check. Nothing is scored until you choose "Check".
async function vpRecord() {
  if (VP.busy) return;
  if (VP.rec) return VP.rec.stop?.();
  stopSpeaking(); vpDrop(); VP.res = null;
  VP.rec = {}; // placeholder while the mic starts
  try { VP.rec = await capture({ recognise: !vpAzure() }); } catch (e) { VP.rec = null; toast(e.message); }
  if (!VP.rec) return renderVoice();
  renderVoice();
  const auto = setTimeout(VP.rec.stop, 15000);
  const take = await VP.rec.done;
  clearTimeout(auto);
  VP.rec = null;
  if (!take.aborted) VP.take = take;
  renderVoice();
}
async function vpCheck() {
  const take = VP.take, sent = SENTENCES[VP.cat][VP.idx];
  if (!take || VP.busy) return;
  if (vpAzure() && take.blob) {
    VP.busy = true; renderVoice();
    try {
      const out = await api('pronounce', { audio: b64(await toWav16k(take.blob)), text: sent, lang: voiceLang() });
      VP.res = out.scores ? { score: clamp100(out.scores.overall), heard: out.heard, scores: out.scores, words: out.words } : { score: 0, heard: '', words: align(sent, '').words };
    } catch (e) { toast(e.message || 'Recording failed'); }
    VP.busy = false;
  } else {
    const a = align(sent, take.text);
    VP.res = { score: take.text ? a.score : 0, heard: take.text, words: a.words };
  }
  vpDrop(); finishVp();
}

/* ---------- Australian slang guide ---------- */
const REG = { work: ['Safe at work', 'reg-work'], casual: ['Casual', 'reg-casual'], avoid: ['Avoid at work', 'reg-avoid'] };
let slangReg = 'all';
function renderSlang() {
  $('#slangFilter').innerHTML = [['all', 'All'], ['work', 'Safe at work'], ['casual', 'Casual'], ['avoid', 'Avoid at work']]
    .map(([k, l]) => `<button class="chip rp${slangReg === k ? ' on' : ''}" data-coach="sreg" data-v="${k}">${l}</button>`).join('');
  $('#slangGrid').innerHTML = SLANG_GUIDE.filter(x => slangReg === 'all' || x.reg === slangReg).map(x => {
    const learned = !!CP.vocab[x.t];
    return `<article class="card sl"><div class="sl-top"><span class="reg ${REG[x.reg][1]}">${REG[x.reg][0]}</span>
        <button class="w-save${learned ? ' on' : ''}" data-coach="learn" data-v="${esc(x.t)}" aria-pressed="${learned}" aria-label="Mark ${esc(x.t)} as learned">${icon('check')}</button></div>
      <h3>${esc(x.t)} ${sayBtn(x.t, `Hear ${x.t}`)}</h3><span class="say">${esc(x.say)}</span>
      <p class="en">${esc(x.en)}</p><p class="fil"><b>FIL</b>${esc(x.fil)}</p>
      ${x.work ? `<p class="ex"><b>At work</b>${esc(x.work)}</p>` : ''}${x.life ? `<p class="ex"><b>Everyday</b>${esc(x.life)}</p>` : ''}</article>`;
  }).join('');
  $('#culture').innerHTML = CULTURE.map(c => `<div class="card cult"><h3>${esc(c.h)}</h3><p>${esc(c.p)}</p></div>`).join('');
}

/* ---------- Home ---------- */
const todayMinutes = () => Math.round((CP.days[dkey()]?.sec || 0) / 60);
function ringTo(el, pct) { el.style.setProperty('--p', 0); requestAnimationFrame(() => requestAnimationFrame(() => el.style.setProperty('--p', pct))); }
function renderHome() {
  $('#homeDate').textContent = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#homeHi').innerHTML = `G'day${CS.name ? `, <em>${esc(CS.name)}</em>` : ''}!`;
  const mins = todayMinutes();
  ringTo($('#todayRing'), Math.min(100, Math.round(mins / CS.duration * 100)));
  $('#todayMin').textContent = mins;
  $('#todayTxt').textContent = mins >= CS.duration ? `Goal reached: ${mins} of ${CS.duration} minutes. Good on ya!` : `${mins} of ${CS.duration} minutes practised today.`;
  $('#homeStreak').textContent = streak() ? `🔥 ${streak()}-day streak` : 'Practise today to start a streak';
  const x = SLANG_GUIDE[Math.floor(Date.now() / 864e5) % SLANG_GUIDE.length];
  $('#homeExp').innerHTML = `<span class="wod-tag">Expression of the day</span><h2>${esc(x.t)} ${sayBtn(x.t)}</h2><p class="say">${esc(x.say)}</p><p>${esc(x.en)}</p><p class="muted"><b>FIL</b> ${esc(x.fil)}</p>`;
  $('#modules').innerHTML = [
    ['talk', 'chat', 'Daily Conversation', 'Chat with Jess, your Aussie workmate'],
    ['checkin', 'brief', 'HR Weekly Check-in', `Practise your one-on-one with ${CS.manager}`],
    ['call', 'phone', 'Live Call Simulation', 'A surprise call from your manager'],
    ['voice', 'mic', 'Voice Practice', 'Repeat, record and train your ear'],
    ['slang', 'quote', 'Australian Slang', 'Expressions, culture and when to use them'],
    ['progress', 'chart', 'Progress Tracker', 'Grammar, pronunciation and weekly goals'],
  ].map(([v, ic, h, p]) => `<a class="card mod" href="#${v}"><span class="av">${icon(ic)}</span><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div></a>`).join('');
}

/* ---------- Progress ---------- */
function trend(list) {
  const s = list.map(x => x.s ?? x.v), last = avg(s.slice(-5)), prev = avg(s.slice(-10, -5));
  return { last, delta: last != null && prev != null ? last - prev : null };
}
function renderProgress() {
  const week = weekDays().map(dkey), days = week.map(k => CP.days[k]);
  const minsWeek = Math.round(days.reduce((t, d) => t + (d?.sec || 0), 0) / 60);
  const practiced = days.filter(d => d && d.sec > 60).length;
  const monday = new Date(week[0]).getTime(), convosWeek = CP.sessions.filter(x => x.t >= monday).length;
  const vocabN = Object.keys(CP.vocab).length;
  $('#pStats').innerHTML = [['🔥', streak(), 'Day streak'], ['⏱️', minsWeek, 'Minutes this week'], ['💬', CP.sessions.length, 'Conversations completed'], ['📚', vocabN, 'Vocabulary learned']]
    .map(([e, v, l], i) => `<div class="stat card" style="--d:${i * 60}ms"><span class="stat-e">${e}</span><b>${v}</b><span>${l}</span></div>`).join('');
  const bar = (label, val, goal, key) => `<div class="goal"><div class="goal-h"><span>${label}</span><span>${val} / ${goal}
      ${key ? `<button class="gbtn" data-coach="goal" data-v="${key}:-1" aria-label="Lower goal">−</button><button class="gbtn" data-coach="goal" data-v="${key}:1" aria-label="Raise goal">+</button>` : ''}</span></div>
    <div class="progress"><i style="width:${Math.min(100, Math.round(val / Math.max(1, goal) * 100))}%"></i></div></div>`;
  $('#pGoals').innerHTML = `<div class="panel-h"><h3>${icon('check')}Weekly goals</h3></div>
    ${bar('Practice days', practiced, CP.goals.days, 'days')}${bar('Conversations', convosWeek, CP.goals.convos, 'convos')}${bar('Practice minutes', minsWeek, CS.duration * CP.goals.days)}`;
  const skill = (name, t, max, unit, empty) => `<div class="goal"><div class="goal-h"><span>${name}</span><span>${t.last == null ? '–' : `${t.last}${unit}`}</span></div>
    <div class="progress"><i style="width:${t.last == null ? 0 : Math.round(t.last / max * 100)}%"></i></div>
    <small class="muted">${t.last == null ? empty : t.delta == null ? 'Average of your latest results' : t.delta >= 0 ? `▲ ${t.delta} vs your previous 5` : `▼ ${-t.delta} vs your previous 5`}</small></div>`;
  $('#pSkills').innerHTML = `<div class="panel-h"><h3>${icon('chart')}Skills</h3></div>
    ${skill('Grammar', trend(CP.grammar), 100, '', 'Have a conversation to get grammar scores.')}
    ${skill('Pronunciation', trend(CP.pron), 100, '', 'Try Voice Practice to get pronunciation scores.')}
    ${skill('Speaking confidence', trend(CP.confidence), 5, ' / 5', 'Rate how you felt after each conversation.')}`;
  const maxMin = Math.max(CS.duration, ...days.map(d => (d?.sec || 0) / 60));
  $('#pWeek').innerHTML = `<div class="panel-h"><h3>${icon('history')}This week</h3></div><div class="wk">${weekDays().map((d, i) => {
    const m = Math.round((days[i]?.sec || 0) / 60);
    return `<div class="${week[i] === dkey() ? 'today-row' : ''}"><span>${d.toLocaleDateString('en-AU', { weekday: 'short' })}</span><span class="progress"><i style="width:${Math.round(m / maxMin * 100)}%"></i></span><span>${m} min</span></div>`;
  }).join('')}</div>`;
  const rv = CP.recent.slice(-5).reverse();
  $('#pReview').innerHTML = `<div class="panel-h"><h3>${icon('bookmark')}Review your corrections</h3></div>
    ${rv.length ? rv.map(r => `<div class="rv"><s>${esc(r.original)}</s><p><b>${esc(r.natural)}</b> ${sayBtn(r.natural)}</p></div>`).join('') : '<p class="muted pad">Your corrected sentences will appear here.</p>'}`;
}

/* ---------- Settings ---------- */
const seg = (key, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, l]) => {
  const on = String(CS[key]) === String(v);
  return `<button type="button" class="seg-b${on ? ' on' : ''}" role="radio" aria-checked="${on}" data-set="${key}" data-v="${v}">${l}</button>`;
}).join('')}</div>`;
const statusRow = (label, ok, optional) => `<div class="st-row"><span>${label}${optional ? ' <span class="muted">(optional)</span>' : ''}</span><b class="${ok ? 'ok' : 'no'}">${ok ? '✓ Connected' : !ST.reachable ? 'Server offline' : ok === null ? 'Locked: enter code' : 'Not set up'}</b></div>`;
function renderSettings() {
  const lockedOr = v => (v && !ST.authorized ? null : v && ST.authorized);
  const dv = deviceVoice();
  $('#settings').innerHTML = `
  <div class="card set-card"><h3>About you</h3>
    <label class="field"><span>Your first name</span><input type="text" data-set="name" value="${esc(CS.name)}" maxlength="40" autocomplete="given-name"></label>
    <label class="field"><span>Your role</span><input type="text" data-set="role" value="${esc(CS.role)}" maxlength="60"></label>
    <label class="field"><span>Your manager's first name</span><input type="text" data-set="manager" value="${esc(CS.manager)}" maxlength="40"></label>
  </div>
  <div class="card set-card"><h3>Learning</h3>
    <div class="field"><span>English level</span>${seg('level', [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']])}</div>
    <div class="field"><span>Explanations</span>${seg('explain', [['taglish', 'Taglish'], ['english', 'English only']])}</div>
    <div class="field"><span>When to show corrections</span>${seg('correction', [['after', 'After each answer'], ['end', 'At the end of the session']])}<small class="muted">Live calls always save feedback for the end, so nothing interrupts you.</small></div>
    <div class="field"><span>Daily practice goal</span>${seg('duration', [[5, '5 min'], [10, '10 min'], [15, '15 min'], [20, '20 min'], [30, '30 min']])}</div>
    <div class="field"><span>Conversation topics</span><div class="chks">${TOPICS.map(t => `<label class="chk"><input type="checkbox" data-topic="${t.id}"${CS.topics.includes(t.id) ? ' checked' : ''}>${t.label}</label>`).join('')}</div></div>
  </div>
  <div class="card set-card"><h3>Voice</h3>
    <div class="field"><span>Accent</span>${seg('accent', [['australian', 'Australian'], ['neutral', 'Neutral']])}</div>
    <div class="field"><span>Voice</span>${seg('voice', [['female', 'Female'], ['male', 'Male']])}</div>
    <div class="field"><span>Speaking speed</span><div class="range-row"><input type="range" min="0.7" max="1.3" step="0.05" data-set="speed" value="${CS.speed}" aria-label="Speaking speed"><output id="speedOut">${Number(CS.speed).toFixed(2)}×</output>
      <button type="button" class="btn rp" data-coach="testvoice">${icon('vol')}Test</button></div></div>
    <p class="muted">${azureReady() ? 'Using the Azure neural voice.' : dv ? `Using this device's voice: ${esc(dv.name)}.${NATURAL.test(dv.name) ? '' : ' It may sound robotic. For a natural Australian voice, open Lingomate in Microsoft Edge, or connect Azure Speech (it has a free tier).'}` : `No ${CS.accent === 'australian' ? 'Australian' : 'English'} voice was found on this device, so it will use the default voice.`}</p>
  </div>
  <div class="card set-card setup"><h3>AI connection</h3>
    <label class="field"><span>Access code</span><div class="range-row"><input type="password" id="codeIn" value="${esc(CS.accessCode)}" autocomplete="off" aria-label="Access code"><button type="button" class="btn primary rp" data-coach="savecode">Save & check</button></div></label>
    ${statusRow(`AI tutor${ST.provider ? ` (${ST.provider === 'groq' ? 'Groq' : 'Claude'})` : ''}`, lockedOr(ST.ai))}
    ${statusRow('Accurate speech-to-text (Whisper, uses the Groq key)', lockedOr(ST.transcribe), true)}
    ${statusRow('Australian neural voice (Azure)', lockedOr(ST.voice), true)}
    ${statusRow('Pronunciation scoring (Azure)', lockedOr(ST.pronunciation), true)}
    <details><summary>How to connect (for the site owner)</summary><ol>
      <li>Create an API key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com</a> (or use an Anthropic key from console.anthropic.com).</li>
      <li>In Vercel, open the <b>lingomate</b> project → <b>Settings → Environment Variables</b> and add <code>GROQ_API_KEY</code> (or <code>ANTHROPIC_API_KEY</code>) and <code>COACH_ACCESS_CODE</code> (a passphrase you make up).</li>
      <li>Optional, for the neural Australian voice and precise pronunciation scores: create an Azure Speech resource and add <code>AZURE_SPEECH_KEY</code> and <code>AZURE_SPEECH_REGION</code> (for example <code>australiaeast</code>).</li>
      <li>Redeploy, then enter your access code above.</li>
    </ol><p class="muted">Keys stay on the server. The browser only ever sees your access code.</p></details>
  </div>
  <p class="muted">Your settings and progress are saved on this device. Back them up from My Words → Backup.</p>`;
}

/* ---------- Navigation shell ---------- */
function toggleSide(open) {
  $('#side').classList.toggle('open', open);
  $('#scrim').hidden = !open;
  $('#moreBtn').setAttribute('aria-expanded', open);
}
function coachRoute(v) {
  toggleSide(false);
  if (!['talk', 'checkin', 'call'].includes(v)) coachRec?.abort();
  ({
    home: renderHome,
    talk: () => { renderTopics(); renderCoach('daily'); },
    checkin: () => renderCoach('checkin'),
    call: () => renderCoach('call'),
    voice: renderVoice,
    slang: renderSlang,
    progress: renderProgress,
    settings: renderSettings,
  })[v]?.();
}
function refreshCoach() {
  $$('[data-banner]').forEach(el => (el.innerHTML = bannerHtml()));
  coachRoute(currentView());
}

/* ---------- Events ---------- */
$('#moreBtn').onclick = () => toggleSide(!$('#side').classList.contains('open'));
$('#scrim').onclick = () => toggleSide(false);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') toggleSide(false);
  if (e.key === 'Enter' && !e.shiftKey && e.target.matches('.composer textarea')) { e.preventDefault(); e.target.form.requestSubmit(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('.composer textarea')) { const s = SESS[t.form.dataset.m]; if (s) s.draft = t.value; }
  else if (t.id === 'dictIn') VP.dTyped = t.value;
  else if (t.dataset.set) {
    CS[t.dataset.set] = t.type === 'range' ? Number(t.value) : t.value.trim();
    if (t.type === 'range') $('#speedOut').textContent = `${Number(t.value).toFixed(2)}×`;
    saveCS();
  }
});
document.addEventListener('change', e => {
  if (!e.target.dataset.topic) return;
  const on = $$('[data-topic]').filter(x => x.checked).map(x => x.dataset.topic);
  if (!on.length) { e.target.checked = true; return toast('Keep at least one topic'); }
  CS.topics = on; saveCS();
  if (!on.includes(talkTopic)) talkTopic = on[0];
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.matches('.composer')) {
    e.preventDefault();
    const text = $('textarea', f).value.trim();
    if (text) turn(f.dataset.m, text);
  } else if (f.id === 'dictForm') {
    e.preventDefault();
    VP.dTyped = $('#dictIn').value;
    if (!VP.dTyped.trim()) return;
    VP.dRes = align(ALL_SENT[VP.dIdx % ALL_SENT.length], VP.dTyped);
    activity(); renderVoice();
  }
});
document.addEventListener('click', e => {
  const set = e.target.closest('[data-set]');
  if (set && set.tagName === 'BUTTON') {
    const k = set.dataset.set;
    CS[k] = k === 'duration' ? Number(set.dataset.v) : set.dataset.v;
    saveCS(); renderSettings();
    return;
  }
  if (e.target.closest('.nav-link')) toggleSide(false);
  const t = e.target.closest('[data-coach]');
  if (!t) return;
  const d = t.dataset, m = d.m;
  switch (d.coach) {
    case 'start': startSession(m); break;
    case 'end': endSession(m); break;
    case 'mic': toggleMic(m); break;
    case 'retake': { const s = SESS[m]; if (s) { s.draft = ''; toggleMic(m); } break; }
    case 'retry': { const s = SESS[m]; if (s) { const text = s.draft; s.error = ''; turn(m, text); } break; }
    case 'sayt': say(d.text); break;
    case 'replay': { const last = SESS.call?.items.filter(i => i.who === 'ai').at(-1); if (last) say(last.text); break; }
    case 'conf': { const s = SESS[m]; if (s?.summary && !s.summary.conf) { CP.confidence.push({ t: Date.now(), v: +d.v }); saveCP(); } if (s?.summary) s.summary.conf = +d.v; renderCoach(m); break; }
    case 'newcall': SESS.call = null; renderCall(); break;
    case 'topic': {
      talkTopic = d.v; renderTopics();
      const s = SESS.daily;
      if (s && !s.summary && s.items.some(i => i.who === 'me') && !confirm('Start a new conversation on this topic?')) break;
      if (s && !s.summary) startSession('daily'); else renderCoach('daily');
      break;
    }
    case 'scenario': callScenario = d.v; renderCall(); break;
    case 'vtab': VP.tab = d.v; vpDrop(); renderVoice(); break;
    case 'vcat': VP.cat = d.v; VP.idx = 0; VP.res = null; vpDrop(); renderVoice(); break;
    case 'vnav': { const n = SENTENCES[VP.cat].length; VP.idx = (VP.idx + Number(d.v) + n) % n; VP.res = null; vpDrop(); renderVoice(); break; }
    case 'vcheck': vpCheck(); break;
    case 'vplay': say(d.text, d.slow ? Math.max(0.6, CS.speed * 0.75) : CS.speed); activity(); break;
    case 'vrec': vpRecord(); break;
    case 'dnext': VP.dIdx++; VP.dRes = null; VP.dTyped = ''; renderVoice(); break;
    case 'cpick': if (VP.cPick == null) { VP.cPick = Number(d.v); activity(); renderVoice(); } break;
    case 'cnext': VP.cIdx++; VP.cPick = null; VP.cOrder = null; renderVoice(); break;
    case 'sreg': slangReg = d.v; renderSlang(); break;
    case 'learn': {
      const x = SLANG_GUIDE.find(y => y.t === d.v);
      if (CP.vocab[d.v]) delete CP.vocab[d.v]; else CP.vocab[d.v] = { meaning: x?.en || '', t: Date.now() };
      saveCP(); renderSlang();
      break;
    }
    case 'goal': { const [k, delta] = d.v.split(':'); CP.goals[k] = Math.min(7 * (k === 'convos' ? 3 : 1), Math.max(1, CP.goals[k] + Number(delta))); saveCP(); renderProgress(); break; }
    case 'testvoice': say(`G'day${CS.name ? ` ${CS.name}` : ''}! How are you going? This is how I'll sound.`); break;
    case 'savecode': CS.accessCode = $('#codeIn').value.trim(); saveCS(); toast('Checking…'); checkStatus().then(() => toast(aiReady() ? 'Connected! The AI tutor is ready.' : ST.ai ? 'That access code is not right.' : 'Saved. The server is not set up yet.')); break;
  }
});

/* ---------- Init ---------- */
coachRoute(currentView());
checkStatus();
