'use strict';

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem('vocu-' + k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('vocu-' + k, JSON.stringify(v)); } catch {} },
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.random() * a.length | 0];
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const setNum = (sel, v) => { const el = $(sel); if (el.textContent !== String(v)) { el.textContent = v; restart(el, 'bump'); } };

// Similarity 0..1 (Levenshtein) for pronunciation checks
function similar(a, b) {
  if (!a || !b) return 0;
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return 1 - d[b.length] / Math.max(a.length, b.length);
}

/* ---------- Countries & words ---------- */
const REGIONS = {
  us: { name: 'American', country: 'the US', short: 'US', flag: 'us', locale: 'en-US' },
  au: { name: 'Australian', country: 'Australia', short: 'AU', flag: 'au', locale: 'en-AU' },
  uk: { name: 'British', country: 'the UK', short: 'UK', flag: 'gb', locale: 'en-GB' },
  ph: { name: 'Philippine', country: 'the Philippines', short: 'PH', flag: 'ph', locale: 'en-PH' },
};
const RORDER = Object.keys(REGIONS);
const flag = r => `<img class="flag" src="https://flagcdn.com/${REGIONS[r].flag}.svg" alt="${REGIONS[r].short}">`;
const flags = rs => `<span class="flags">${rs.map(flag).join('')}</span>`;
const shorts = rs => rs.map(r => REGIONS[r].short).join(' & ');
const rsName = rs => (rs.length === 1 ? REGIONS[rs[0]].name : shorts(rs));
const countries = rs => rs.map(r => REGIONS[r].country).join(' & ');
const regionLabel = x => `${rsName(x.rs)} ${x.cat === 'Slang' ? 'slang' : 'English'}`;
const sayLang = x => REGIONS[x.rs[0]].locale;

const CONCEPT_LIST = CONCEPTS.map(([cat, def, ...terms], cid) => ({ cid, cat, def, t: Object.fromEntries(RORDER.map((r, i) => [r, terms[i] ?? PH_TERMS[terms[0]] ?? terms[0]])) }))
  .filter(c => new Set(RORDER.map(r => norm(c.t[r]))).size > 1);
// One entry per distinct word; countries sharing a word share the entry (rs = ['au', 'uk'])
const WORDS = (() => {
  const seen = new Set(), out = [];
  const add = (rs, w, cat, def, ex, extra) => {
    const key = rs[0] + ':' + norm(w);
    if (!seen.has(key)) { seen.add(key); out.push({ rs, w, cat, def, ex, key, ...extra }); }
  };
  CONCEPT_LIST.forEach(c => {
    const byTerm = new Map(), terms = new Set(RORDER.map(r => norm(c.t[r])));
    RORDER.forEach(r => { const k = norm(c.t[r]); byTerm.has(k) ? byTerm.get(k).rs.push(r) : byTerm.set(k, { w: c.t[r], rs: [r] }); });
    byTerm.forEach(({ w, rs }) => add(rs, w, c.cat, c.def, '', { cid: c.cid, terms }));
  });
  SLANG.forEach(([reg, w, def, ex, eq]) => {
    const rs = reg.split(' ');
    add(rs, w, 'Slang', def, ex, { eq, eqr: rs.includes('us') ? 'au' : 'us', terms: new Set([norm(w), norm(eq)]) });
  });
  return out.sort((a, b) => norm(a.w).localeCompare(norm(b.w))).map((x, id) => ({ ...x, id }));
})();
const byKey = new Map(WORDS.map(x => [x.key, x]));
const CATS = ['All', ...new Set(WORDS.map(x => x.cat))];
const others = x => (x.cid == null ? [] : WORDS.filter(y => y.cid === x.cid && y !== x));
const findWord = (r, term) => WORDS.find(y => y.rs.includes(r) && norm(y.w) === norm(term));
const kin = (x, y) => y !== x && [...x.terms].some(t => y.terms.has(t)); // same meaning → never a quiz distractor
const entryFor = (c, r) => WORDS.find(y => y.cid === c.cid && y.rs.includes(r));
const eqLine = x => (x.cid != null
  ? others(x).map(o => `<span>${flags(o.rs)}<em>${shorts(o.rs)}:</em> ${esc(o.w)}</span>`).join('')
  : `<span>${flags([x.eqr])}<em>${REGIONS[x.eqr].short}:</em> ${esc(x.eq)}</span>`);

const LANGS = {
  auto: 'Auto-detect', en: 'English', tl: 'Filipino', ceb: 'Cebuano', ilo: 'Ilocano', es: 'Spanish',
  'zh-CN': 'Chinese (Simplified)', 'zh-TW': 'Chinese (Traditional)', vi: 'Vietnamese', ko: 'Korean', ja: 'Japanese', hi: 'Hindi',
  pa: 'Punjabi', ar: 'Arabic', fr: 'French', de: 'German', it: 'Italian', el: 'Greek', pt: 'Portuguese', id: 'Indonesian', th: 'Thai', ru: 'Russian',
};
const langOpts = (skip = []) => Object.entries(LANGS).filter(([k]) => !skip.includes(k)).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

const FOCI = ['all', ...RORDER];
const S = {
  focus: FOCI.includes(store.get('focus')) ? store.get('focus') : 'all',
  words: store.get('words', []), prog: store.get('prog', {}), days: store.get('days', { last: '', n: 0 }),
  history: store.get('history', []), saved: store.get('saved', []),
  cat: 'All', q: '', deck: 'All',
};
const root = document.documentElement;
const inFocus = x => S.focus === 'all' || x.rs.includes(S.focus);
const pool = () => WORDS.filter(inFocus);
const accent = () => (S.focus === 'all' ? 'us' : S.focus);
const isSaved = k => S.words.includes(k);

/* ---------- Toast ---------- */
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  (modal.open ? $('#sheet') : $('#toasts')).append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2600);
}

/* ---------- Speech output ---------- */
const synth = window.speechSynthesis;
let voices = [];
if (synth) { const lv = () => (voices = synth.getVoices()); lv(); synth.onvoiceschanged = lv; }
const locale = code => (code === 'en' || code === 'auto' || !code) ? REGIONS[accent()].locale : code === 'tl' ? 'fil-PH' : code;

function speak(text, lang) {
  if (!text) return;
  if (!synth) return toast("Speech isn't supported in this browser");
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const n = v => v.lang.toLowerCase().replace('_', '-'), L = lang.toLowerCase(), base = L.split('-')[0];
  const alt = base === 'fil' ? 'tl' : base;
  u.lang = lang; u.rate = .92;
  u.voice = voices.find(v => n(v) === L) || voices.find(v => n(v).startsWith(base) || n(v).startsWith(alt)) || null;
  synth.speak(u);
}
const playAudio = url => new Audio(url).play().catch(() => toast('Recording unavailable'));

/* ---------- Voice input (shared) ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const SR_ERR = { 'not-allowed': 'Microphone permission denied', 'service-not-allowed': 'Microphone permission denied', 'no-speech': 'No speech detected. Try again.', network: 'Voice service needs an internet connection', aborted: '' };
function listen(lang, { onStart, onText, onEnd } = {}) {
  if (!SR) { toast('Voice input needs Chrome, Edge or Safari'); return null; }
  const rec = new SR();
  rec.lang = lang; rec.interimResults = true; rec.maxAlternatives = 5;
  rec.onstart = () => onStart?.();
  rec.onresult = e => onText?.(Array.from(e.results).map(r => r[0].transcript).join(''), e);
  rec.onerror = e => { const m = SR_ERR[e.error] ?? 'Voice error: ' + e.error; if (m) toast(m); };
  rec.onend = () => onEnd?.();
  try { rec.start(); } catch { toast('Could not start the microphone'); return null; }
  return rec;
}

/* ---------- Online services ---------- */
const cache = new Map();
async function translate(text, sl, tl) {
  const key = `${sl}|${tl}|${text}`;
  if (cache.has(key)) return cache.get(key);
  let res;
  try {
    const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${sl}&tl=${tl}&q=${encodeURIComponent(text)}`);
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    res = { text: (j[0] || []).map(s => s[0]).join(''), detected: j[2] };
  } catch {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${sl === 'auto' ? 'en' : sl}|${tl}`);
    const j = await r.json();
    if (+j.responseStatus !== 200) throw new Error(j.responseDetails || 'Translation failed');
    res = { text: j.responseData.translatedText, detected: sl === 'auto' ? 'en' : sl };
  }
  cache.set(key, res);
  return res;
}
const dictCache = new Map();
let dictDown = false; // after one network/CORS failure, stop calling the API for this session
function fetchDict(word) {
  const k = word.toLowerCase().trim();
  if (dictDown) return Promise.resolve(null);
  if (!dictCache.has(k)) {
    dictCache.set(k, fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(k)}`)
      .then(r => (r.ok ? r.json() : null)).catch(() => { dictDown = true; return null; })
      .then(j => { if (!Array.isArray(j)) dictCache.delete(k); return Array.isArray(j) ? j : null; }));
  }
  return dictCache.get(k);
}
const pickPhon = d => d.map(e => e.phonetic || e.phonetics?.find(p => p.text)?.text).find(Boolean);
const pickAudio = (d, r) => { const a = d.flatMap(e => e.phonetics || []).filter(p => p.audio); return (a.find(p => p.audio.includes(`-${r}.`)) || a[0])?.audio; };

/* ---------- Study streak ---------- */
const dayStr = (off = 0) => new Date(Date.now() - off * 864e5).toDateString();
function studied() {
  const d = S.days;
  if (d.last === dayStr()) return;
  d.n = d.last === dayStr(1) ? d.n + 1 : 1; d.last = dayStr();
  store.set('days', d);
}
const streak = () => ([dayStr(), dayStr(1)].includes(S.days.last) ? S.days.n : 0);

/* ---------- Dictionary ---------- */
function score(x, q) {
  const w = norm(x.w);
  return w === q ? 5 : w.startsWith(q) ? 4 : w.includes(q) ? 3 : [...x.terms].some(t => t.includes(q)) ? 2 : norm(x.def).includes(q) ? 1 : 0;
}
function wCard(x, i) {
  const m = (S.prog[x.key]?.b || 0) >= 4, on = isSaved(x.key);
  return `<article class="w-card card" style="--d:${Math.min(i, 20) * 24}ms">
    <button class="w-open rp" data-w="${x.id}">
      <span class="w-top">${flags(x.rs)}${regionLabel(x)}${m ? '<span class="w-badge">Mastered</span>' : ''}</span>
      <span class="w-word">${esc(x.w)}</span>
      <span class="w-def">${esc(x.def)}</span>
      <span class="w-eq">${eqLine(x)}</span>
    </button>
    <button class="w-save${on ? ' on' : ''}" data-save="${x.key}" aria-pressed="${on}" aria-label="Save ${esc(x.w)}">${icon('bookmark')}</button>
  </article>`;
}
function renderDict(animate = true) {
  $$('#cats .chip').forEach(b => b.classList.toggle('on', b.dataset.cat === S.cat));
  const q = norm(S.q);
  let list = pool().filter(x => S.cat === 'All' || x.cat === S.cat);
  if (q) list = list.map(x => [x, score(x, q)]).filter(([, s]) => s).sort((a, b) => b[1] - a[1]).map(([x]) => x);
  const grid = $('#wGrid');
  grid.classList.toggle('still', !animate);
  grid.innerHTML = list.map(wCard).join('');
  $('#dMeta').textContent = q ? `${list.length} match${list.length === 1 ? '' : 'es'} for "${S.q.trim()}"` : `${list.length} words · tap any card for meaning, examples and pronunciation`;
  $('#wod').hidden = !!q;
  $('#lookup').hidden = !q;
  $('#lookupQ').textContent = S.q.trim();
  const clear = !!q && !qRec;
  $('#search').classList.toggle('has-q', clear);
  $('#qMic use').setAttribute('href', clear ? '#i-x' : '#i-mic');
  $('#qMic').setAttribute('aria-label', clear ? 'Clear search' : 'Search by voice');
}
function renderWod() {
  const p = pool(), x = p[(Math.floor(Date.now() / 864e5) * 7919) % p.length], on = isSaved(x.key);
  $('#wod').innerHTML = `
    <div class="wod-l"><span class="wod-tag">Word of the day</span><h2>${esc(x.w)}</h2>
      <p class="wod-def">${esc(x.def)}</p>${x.ex ? `<p class="wod-ex">“${esc(x.ex)}”</p>` : ''}</div>
    <div class="wod-r"><span class="w-top">${flags(x.rs)}${regionLabel(x)}</span>
      <div class="wod-act">
        <button class="btn rp" data-say="${esc(x.w)}" data-lang="${sayLang(x)}">${icon('vol')}Hear it</button>
        <button class="btn rp${on ? ' on' : ''}" data-save="${x.key}" aria-pressed="${on}" aria-label="Save word">${icon('bookmark')}</button>
        <button class="btn primary rp" data-w="${x.id}">Learn it</button>
      </div></div>`;
}
$('#cats').innerHTML = CATS.map(c => `<button class="chip rp" data-cat="${c}">${c}</button>`).join('');
let qTimer, qRec = null;
$('#q').addEventListener('input', e => { S.q = e.target.value; clearTimeout(qTimer); qTimer = setTimeout(() => renderDict(false), 90); });
function clearSearch() { $('#q').value = S.q = ''; renderDict(false); $('#q').focus(); }
$('#q').addEventListener('keydown', e => {
  if (e.key === 'Escape') clearSearch();
  else if (e.key === 'Enter' && S.q.trim() && !$('#wGrid').children.length) openLookup(S.q.trim());
});
$('#qMic').onclick = () => {
  if (qRec) return qRec.stop();
  if (S.q) return clearSearch();
  qRec = listen(REGIONS[accent()].locale, {
    onStart: () => $('#search').classList.add('listening'),
    onText: t => { $('#q').value = S.q = t.replace(/[.?!]$/, ''); renderDict(false); },
    onEnd: () => { qRec = null; $('#search').classList.remove('listening'); renderDict(false); },
  });
};

function toggleWord(k) {
  const on = !isSaved(k), x = byKey.get(k);
  S.words = on ? [k, ...S.words] : S.words.filter(w => w !== k);
  store.set('words', S.words);
  $$(`[data-save="${k}"]`).forEach(b => {
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    const s = $('span', b); if (s) s.textContent = on ? 'Saved' : 'Save word';
  });
  toast(on ? `Saved "${x.w}" to My Words` : 'Removed from My Words');
  renderWords();
}
function markKnown(id) {
  const x = WORDS[id];
  S.prog[x.key] = { b: 5, due: Date.now() + 30 * 864e5 };
  store.set('prog', S.prog); studied();
  toast(`"${x.w}" marked as mastered`);
  fcStats(); renderWords();
}

/* ---------- Word detail & full-dictionary sheet ---------- */
const modal = $('#modal');
let openSeq = 0, sayRec = null, closeTimer = 0;
const accentPills = w => RORDER.map(r => `<button class="pill rp" data-say="${esc(w)}" data-lang="${REGIONS[r].locale}">${icon('vol')}${REGIONS[r].short} accent</button>`).join('');
const eqRow = (rs, label, w, id) => `<div class="d-eq">${flags(rs)}<div><small>${label}</small><b>${esc(w)}</b></div>
  <button class="icon-btn sm rp" data-say="${esc(w)}" data-lang="${REGIONS[rs[0]].locale}" aria-label="Hear ${esc(w)}">${icon('vol')}</button>
  ${id != null ? `<button class="link" data-w="${id}">Open</button>` : ''}</div>`;
function showModal(html) {
  clearTimeout(closeTimer);
  $('#sheet').innerHTML = `<button class="icon-btn close rp" data-act="close" aria-label="Close">${icon('x')}</button>${html}`;
  $('#sheet').scrollTop = 0;
  modal.classList.remove('closing');
  if (!modal.open) modal.showModal();
  return ++openSeq;
}
function openWord(id) {
  const x = WORDS[id], on = isSaved(x.key);
  const elsewhere = x.cid != null
    ? `<div class="d-sec"><h4>In other countries</h4>${others(x).map(o => eqRow(o.rs, `In ${countries(o.rs)} they say`, o.w, o.id)).join('')}</div>`
    : `<div class="d-sec"><h4>Closest word elsewhere</h4>${eqRow([x.eqr], `In ${REGIONS[x.eqr].country}`, x.eq, findWord(x.eqr, x.eq)?.id)}</div>`;
  const tok = showModal(`
    <div class="d-head">
      <span class="w-top">${flags(x.rs)}${regionLabel(x)} · ${esc(x.cat)}</span>
      <h2 class="d-word">${esc(x.w)}</h2>
      <div class="d-phon" id="dPhon"></div>
      <div class="d-say">${accentPills(x.w)}<span id="dAudio"></span></div>
    </div>
    <div class="d-sec"><h4>Meaning</h4><p class="d-def">${esc(x.def)}</p>
      ${x.ex ? `<p class="d-ex">“${esc(x.ex)}” <button class="icon-btn sm rp" data-say="${esc(x.ex)}" data-lang="${sayLang(x)}" aria-label="Hear example">${icon('vol')}</button></p>` : ''}</div>
    ${elsewhere}
    <div class="d-sec"><h4>In Filipino</h4><p class="d-fil" id="dFil">…</p></div>
    <div class="d-practice"><button class="btn rp" data-act="say-check" data-id="${x.id}">${icon('mic')}Say it</button><span class="d-res" id="dRes">Practise your pronunciation</span></div>
    <div class="d-actions">
      <button class="btn rp${on ? ' on' : ''}" data-save="${x.key}" aria-pressed="${on}">${icon('bookmark')}<span>${on ? 'Saved' : 'Save word'}</span></button>
      <button class="btn primary rp" data-act="known" data-id="${x.id}">${icon('check')}I know this</button>
    </div>`);
  translate(x.def, 'en', 'tl').then(r => tok === openSeq && ($('#dFil').textContent = r.text), () => tok === openSeq && ($('#dFil').textContent = 'Unavailable offline'));
  if (/^[a-z'-]+$/i.test(x.w)) fetchDict(x.w).then(d => {
    if (!d || tok !== openSeq) return;
    const ph = pickPhon(d), au = pickAudio(d, x.rs[0]);
    if (ph) $('#dPhon').textContent = ph;
    if (au) $('#dAudio').innerHTML = `<button class="pill rp" data-audio="${esc(au)}">${icon('vol')}Real recording</button>`;
  });
}
async function openLookup(q) {
  const tok = showModal(`<div class="d-head"><span class="w-top">Full dictionary</span><h2 class="d-word">${esc(q)}</h2><div class="d-phon" id="dPhon"></div><div class="d-say" id="lkSay"></div></div><div class="lk loading" id="lk">Looking it up…</div>`);
  const d = await fetchDict(q);
  if (tok !== openSeq) return;
  const lk = $('#lk');
  lk.classList.remove('loading');
  $('#lkSay').innerHTML = accentPills(q);
  if (!d) { lk.innerHTML = `<p class="d-res">No dictionary entry found for "${esc(q)}" (or the dictionary service is offline).</p><button class="btn rp" data-act="translate-q">${icon('lang')}Translate it instead</button>`; return; }
  $('#dPhon').textContent = pickPhon(d) || '';
  const au = pickAudio(d, accent());
  if (au) $('#lkSay').insertAdjacentHTML('beforeend', `<button class="pill rp" data-audio="${esc(au)}">${icon('vol')}Real recording</button>`);
  lk.innerHTML = d.flatMap(e => e.meanings || []).slice(0, 4).map(m => `<div class="d-sec"><h4>${esc(m.partOfSpeech)}</h4><ol>${
    m.definitions.slice(0, 3).map(df => `<li>${esc(df.definition)}${df.example ? `<span class="d-ex">“${esc(df.example)}”</span>` : ''}</li>`).join('')}</ol></div>`).join('');
}
function sayCheck(id, btn) {
  if (sayRec) return sayRec.stop();
  const x = WORDS[id], target = norm(x.w), res = $('#dRes');
  let heard = '', ok = false;
  sayRec = listen(sayLang(x), {
    onStart: () => { btn.classList.add('rec'); res.textContent = `Listening… say "${x.w}"`; },
    onText: (t, e) => {
      heard = t;
      const alts = Array.from(e.results).flatMap(r => Array.from(r).map(a => norm(a.transcript)));
      if (alts.some(a => a.includes(target) || similar(a.replace(/ /g, ''), target.replace(/ /g, '')) >= .75)) ok = true;
    },
    onEnd: () => {
      sayRec = null; btn.classList.remove('rec');
      if (!$('#dRes')) return;
      if (!heard) res.textContent = "Didn't catch that. Tap and try again.";
      else if (ok) { res.innerHTML = `<b class="good">Spot on!</b> We heard “${esc(heard)}”`; confetti(btn); studied(); }
      else res.innerHTML = `<b class="bad">Almost.</b> We heard “${esc(heard)}”. Listen and try again.`;
    },
  });
}
function closeModal() {
  if (!modal.open || modal.classList.contains('closing')) return;
  sayRec?.abort();
  openSeq++;
  modal.classList.add('closing');
  closeTimer = setTimeout(() => { modal.classList.remove('closing'); modal.close(); }, reduced ? 0 : 230);
}
modal.addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

/* ---------- Flashcards (Leitner spaced repetition) ---------- */
const DAY = 864e5, GAPS = [0, 1, 3, 7, 14, 30];
const P = x => S.prog[x.key];
const isMastered = x => (P(x)?.b || 0) >= 4;
const nextBox = (x, k) => Math.min((P(x)?.b || 0) + k, 5);
const gapLabel = b => (GAPS[b] === 1 ? '1 day' : `${GAPS[b]} days`);
const deckWords = () => pool().filter(x => S.deck === 'Saved' ? isSaved(x.key) : S.deck === 'All' || x.cat === S.deck);
let queue = [], cur = null;
$('#decks').innerHTML = [...CATS, 'Saved'].map(c => `<button class="chip rp" data-deck="${c}">${c === 'Saved' ? 'My saved words' : c}</button>`).join('');

function fcStats() {
  const d = deckWords(), now = Date.now();
  setNum('#fcDue', d.filter(x => P(x) && P(x).due <= now).length);
  setNum('#fcNew', d.filter(x => !P(x)).length);
  setNum('#fcMast', d.filter(isMastered).length);
}
function buildQueue(reviewAhead = false) {
  $$('#decks .chip').forEach(b => b.classList.toggle('on', b.dataset.deck === S.deck));
  const d = deckWords(), now = Date.now();
  queue = [...d.filter(x => P(x) && P(x).due <= now).sort((a, b) => P(a).due - P(b).due), ...shuffle(d.filter(x => !P(x))).slice(0, 10)];
  if (!queue.length && reviewAhead) queue = shuffle(d.filter(P)).slice(0, 10);
  fcStats(); showCard();
}
function showCard() {
  cur = queue[0] || null;
  const fc = $('#fc'), d = deckWords();
  fc.style.transition = 'none'; fc.classList.remove('flipped'); void fc.offsetWidth; fc.style.transition = '';
  $('#v-learn').classList.remove('revealed');
  $('#fcDone').hidden = !!cur;
  $('#scene').hidden = $('#rate').hidden = !cur;
  if (!cur) {
    const fresh = d.some(x => !P(x));
    $('#fcDoneTxt').textContent = !d.length ? (S.deck === 'Saved' ? 'Save words from the Dictionary to study them here.' : 'No words in this deck.') : fresh ? 'Nothing due right now.' : 'You have seen every word in this deck. Come back later for reviews.';
    $('#fcMore').textContent = fresh ? 'Study 10 new words' : 'Review again anyway';
    $('#fcMore').hidden = !d.length;
    return;
  }
  const x = cur;
  fc.style.setProperty('--rc', `var(--${x.rs[0]})`);
  $('#fcFront').innerHTML = `<span class="w-top">${flags(x.rs)}${regionLabel(x)}</span><div class="fc-word">${esc(x.w)}</div>
    <button class="icon-btn rp" data-say="${esc(x.w)}" data-lang="${sayLang(x)}" aria-label="Hear it">${icon('vol')}</button><span class="fc-hint">Tap to flip</span>`;
  $('#fcBack').innerHTML = `<span class="w-top">${flags(x.rs)}${esc(x.w)}</span><p class="fc-def">${esc(x.def)}</p>
    ${x.ex ? `<p class="fc-ex">“${esc(x.ex)}”</p>` : ''}<span class="w-eq">${eqLine(x)}</span>`;
  $('#rGood').textContent = gapLabel(nextBox(x, 1));
  $('#rEasy').textContent = gapLabel(nextBox(x, 2));
  restart($('#scene'), 'enter');
}
function flip() {
  if (!cur) return;
  $('#fc').classList.toggle('flipped');
  $('#v-learn').classList.add('revealed');
}
function rate(k) {
  if (!cur || !$('#v-learn').classList.contains('revealed')) return;
  const x = queue.shift();
  if (k === 0) { S.prog[x.key] = { b: 0, due: Date.now() }; queue.splice(Math.min(3, queue.length), 0, x); }
  else { const b = nextBox(x, k); S.prog[x.key] = { b, due: Date.now() + GAPS[b] * DAY }; }
  store.set('prog', S.prog); studied();
  fcStats(); showCard();
}
$('#fc').addEventListener('click', e => { if (!e.target.closest('[data-say]')) flip(); });
document.addEventListener('keydown', e => {
  if (!$('#v-learn').classList.contains('active') || modal.open || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest('button,a')) { e.preventDefault(); flip(); }
  else if (['1', '2', '3'].includes(e.key)) rate(+e.key - 1);
});

/* ---------- Quiz ---------- */
const quiz = { mode: 'meaning', score: 0, streak: 0, best: store.get('qbest', 0), q: null, lock: false, timer: 0 };
const distractors = (vals, ans, avoid = []) => shuffle([...new Set(vals)].filter(v => norm(v) !== norm(ans) && !avoid.some(a => norm(a) === norm(v)))).slice(0, 3);
function makeQ(mode) {
  if (mode === 'swap') {
    // Show one country's word, ask for another country's word for the same thing
    const to = S.focus === 'all' ? pick(RORDER) : S.focus;
    const c = pick(CONCEPT_LIST), from = pick(RORDER.filter(r => norm(c.t[r]) !== norm(c.t[to])));
    const x = entryFor(c, from), ans = c.t[to];
    return { x, ask: `What's it called in ${REGIONS[to].country}?`, word: x.w, ans, say: [ans, REGIONS[to].locale],
      opts: shuffle([ans, ...distractors(CONCEPT_LIST.filter(d => d !== c).map(d => d.t[to]), ans, [x.w])]) };
  }
  const p = pool();
  let x;
  do x = pick(p); while (p.length > 1 && x === quiz.q?.x);
  const same = p.filter(y => y.rs.some(r => x.rs.includes(r)) && !kin(x, y));
  if (mode === 'meaning') {
    return { x, ask: `What does this ${rsName(x.rs)} word mean?`, word: x.w, ans: x.def, long: true, say: [x.w, sayLang(x)],
      opts: shuffle([x.def, ...distractors(same.map(y => y.def), x.def)]) };
  }
  return { x, ask: 'Listen, then pick the word you hear', word: x.w, listen: true, ans: x.w, say: [x.w, sayLang(x)],
    opts: shuffle([x.w, ...distractors(same.map(y => y.w), x.w)]) };
}
function renderQStats() { setNum('#qScore', quiz.score); setNum('#qStreak', quiz.streak); setNum('#qBest', quiz.best); }
function nextQ() {
  const q = quiz.q = makeQ(quiz.mode);
  quiz.lock = false;
  restart($('#stage'), 'enter');
  $('#qAsk').textContent = q.ask;
  $('#qTag').innerHTML = `${flags(q.x.rs)}${regionLabel(q.x)}`;
  $('#qWord').textContent = q.word;
  $('#qWord').hidden = !!q.listen;
  $('#qPlay').hidden = !q.listen;
  $('#opts').className = 'opts' + (q.long ? ' long' : '');
  $('#opts').innerHTML = q.opts.map(o => `<button class="opt rp" data-opt="${esc(o)}">${esc(o)}</button>`).join('');
  if (q.listen) setTimeout(() => quiz.q === q && $('#v-quiz').classList.contains('active') && speak(...q.say), 400);
}
function answer(btn) {
  if (quiz.lock) return;
  quiz.lock = true;
  const q = quiz.q, ok = btn.dataset.opt === q.ans;
  $('#opts').classList.add('done');
  $$('#opts .opt').forEach(b => { b.disabled = true; if (b.dataset.opt === q.ans) b.classList.add('correct'); });
  if (ok) {
    quiz.score++; quiz.streak++; studied();
    if (quiz.streak > quiz.best) { quiz.best = quiz.streak; store.set('qbest', quiz.best); }
    confetti(btn);
    speak(...q.say);
  } else { btn.classList.add('wrong'); quiz.streak = 0; }
  $('#qWord').hidden = false;
  renderQStats();
  quiz.timer = setTimeout(nextQ, ok ? 1300 : 2200);
}
function setMode(mode) {
  quiz.mode = mode; clearTimeout(quiz.timer);
  $$('#modes .chip').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  nextQ();
}
function confetti(el) {
  if (reduced) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const colors = ['#cc4a2d', '#2d5bd0', '#1f7a55', '#8e2c48', '#e2a019'];
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 120;
    p.className = 'confetti';
    p.style.cssText = `left:${cx}px;top:${cy}px;background:${colors[i % colors.length]};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 50}px;--r:${Math.random() * 720 - 360}deg`;
    (modal.open ? $('#sheet') : document.body).append(p);
    setTimeout(() => p.remove(), 1050);
  }
}

/* ---------- My Words ---------- */
function renderWords() {
  const p = pool(), m = p.filter(isMastered).length, learning = p.filter(x => P(x) && !isMastered(x)).length;
  const pct = p.length ? Math.round(m / p.length * 100) : 0, ring = $('#ring');
  ring.style.setProperty('--p', 0);
  requestAnimationFrame(() => requestAnimationFrame(() => ring.style.setProperty('--p', pct)));
  $('#ringPct').textContent = pct + '%';
  $('#ringTxt').textContent = `${m} of ${p.length} ${S.focus === 'all' ? '' : REGIONS[S.focus].name + ' '}words mastered`;
  $('#statGrid').innerHTML = [['🔖', S.words.length, 'Saved words'], ['🌱', learning, 'Learning'], ['🔥', streak(), 'Day streak'], ['🏆', quiz.best, 'Best quiz streak']]
    .map(([e, v, l], i) => `<div class="stat card" style="--d:${i * 70}ms"><span class="stat-e">${e}</span><b>${v}</b><span>${l}</span></div>`).join('');
  $('#bars').innerHTML = CATS.slice(1).map(c => {
    const t = p.filter(x => x.cat === c), mm = t.filter(isMastered).length;
    return t.length ? `<div><div class="bar-h"><span>${c}</span><span>${mm} / ${t.length}</span></div><div class="progress"><i style="width:${mm / t.length * 100}%"></i></div></div>` : '';
  }).join('');
  $('#savedWords').innerHTML = S.words.map(k => byKey.get(k)).filter(Boolean).map((x, i) => `<li style="--d:${Math.min(i, 10) * 40}ms">
    <button class="h-item rp" data-w="${x.id}"><span class="h-out">${flags(x.rs)} ${esc(x.w)}</span><span class="h-src">${esc(x.def)}</span></button>
    <button class="icon-btn sm rp" data-say="${esc(x.w)}" data-lang="${sayLang(x)}" aria-label="Hear ${esc(x.w)}">${icon('vol')}</button>
    <button class="icon-btn sm rp on" data-save="${x.key}" aria-label="Remove ${esc(x.w)}">${icon('x')}</button></li>`).join('')
    || '<li class="muted">Tap the bookmark on any word to save it here.</li>';
}

/* ---------- Translator ---------- */
const input = $('#input'), output = $('#output'), src = $('#src'), dst = $('#dst');
src.innerHTML = langOpts();
dst.innerHTML = langOpts(['auto']);
src.value = store.get('src', 'auto');
dst.value = store.get('dst', 'tl');
if (!src.value) src.value = 'auto';
if (!dst.value) dst.value = 'tl';
const persistLangs = () => { store.set('src', src.value); store.set('dst', dst.value); };
let seq = 0, tTimer, hTimer, last = null;

function setOutput(t) {
  output.dataset.text = t;
  output.replaceChildren();
  if (!t) { output.innerHTML = '<span class="ph">Translation appears here</span>'; return; }
  const parts = t.split(/(\s+)/), animate = parts.length < 240;
  parts.forEach((w, i) => {
    const s = document.createElement('span');
    s.textContent = w;
    if (animate && w.trim()) { s.className = 'w'; s.style.animationDelay = Math.min(i * 16, 700) + 'ms'; }
    output.append(s);
  });
}
function onInput() {
  $('#count').textContent = `${input.value.length} / 5000`;
  clearTimeout(tTimer);
  tTimer = setTimeout(runTranslate, 450);
}
async function runTranslate(save) {
  clearTimeout(tTimer);
  const text = input.value.trim(), pane = $('#outPane'), det = $('#detected');
  if (!text) { seq++; last = null; setOutput(''); det.hidden = true; pane.classList.remove('loading'); syncStar(); return; }
  const id = ++seq;
  pane.classList.add('loading');
  try {
    const r = await translate(text, src.value, dst.value);
    if (id !== seq) return;
    last = { from: src.value === 'auto' ? (r.detected || 'auto') : src.value, to: dst.value, text, out: r.text };
    setOutput(r.text);
    det.hidden = src.value !== 'auto' || !LANGS[r.detected];
    det.textContent = 'Detected: ' + (LANGS[r.detected] || '');
    syncStar();
    clearTimeout(hTimer);
    if (save === true) addHistory(); else hTimer = setTimeout(addHistory, 1800);
    return r.text;
  } catch {
    if (id === seq) toast('Translation service unreachable. Check your connection.');
  } finally {
    if (id === seq) pane.classList.remove('loading');
  }
}
const tkey = e => e.to + '|' + e.text;
function addHistory() {
  if (!last) return;
  const l = last;
  S.history = [{ ...l }, ...S.history.filter(e => !(e.to === l.to && (l.text.startsWith(e.text) || e.text.startsWith(l.text))))].slice(0, 20);
  store.set('history', S.history);
  renderHist();
}
function syncStar() { $('#starBtn').classList.toggle('on', !!last && S.saved.some(e => tkey(e) === tkey(last))); }
function toggleSave() {
  if (!last) return toast('Translate something first');
  const i = S.saved.findIndex(e => tkey(e) === tkey(last));
  i >= 0 ? S.saved.splice(i, 1) : S.saved.unshift({ ...last });
  store.set('saved', S.saved); renderHist(); syncStar();
  toast(i >= 0 ? 'Removed from saved' : 'Saved to phrases');
}
function histItem(e, i, type) {
  return `<li style="--d:${Math.min(i, 10) * 40}ms"><button class="h-item rp" data-load="${type}:${i}">
    <span class="h-src">${esc(e.text)}</span><span class="h-out">${esc(e.out)}</span>
    <span class="h-tag">${esc(LANGS[e.from] || e.from)} → ${esc(LANGS[e.to] || e.to)}</span></button>
    ${type === 'saved' ? `<button class="icon-btn sm rp" data-unsave="${i}" aria-label="Remove saved phrase">${icon('x')}</button>` : ''}</li>`;
}
function renderHist() {
  $('#history').innerHTML = S.history.map((e, i) => histItem(e, i, 'history')).join('') || '<li class="muted">Your translations will appear here.</li>';
  $('#saved').innerHTML = S.saved.map((e, i) => histItem(e, i, 'saved')).join('') || '<li class="muted">Tap the star on a translation to save it.</li>';
}
function loadEntry(e) {
  src.value = LANGS[e.from] ? e.from : 'auto'; dst.value = e.to; input.value = e.text;
  persistLangs(); onInput(); runTranslate();
  $('#translator').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
}
function usePhrase(p) {
  src.value = 'en'; if (dst.value === 'en') dst.value = 'tl';
  persistLangs(); input.value = p; onInput(); runTranslate(true);
}
function renderPhrases() {
  const list = S.focus === 'all' ? RORDER.flatMap(r => PHRASES[r].slice(0, 2)) : PHRASES[S.focus];
  $('#phrases').innerHTML = list.map((p, i) => `<button class="chip rp" style="--d:${i * 50}ms" data-phrase="${esc(p)}">${esc(p)}</button>`).join('');
}
input.addEventListener('input', onInput);
input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runTranslate(true); } });
src.onchange = dst.onchange = () => { persistLangs(); runTranslate(); };
$('#swap').onclick = () => {
  const from = src.value === 'auto' ? (last && LANGS[last.from] && last.from !== 'auto' ? last.from : 'en') : src.value;
  src.value = dst.value; dst.value = from;
  if (last?.out) input.value = last.out;
  $('#swap').classList.toggle('flip');
  persistLangs(); onInput(); runTranslate();
};
const autoSpeak = $('#autoSpeak');
autoSpeak.checked = store.get('autospeak', false);
autoSpeak.onchange = () => store.set('autospeak', autoSpeak.checked);

let rec = null;
if (!SR) $('#micHint').textContent = 'Voice: use Chrome, Edge or Safari';
function setListening(on) {
  $('#translator').classList.toggle('listening', on);
  $('#mic use').setAttribute('href', on ? '#i-stop' : '#i-mic');
  $('#mic').setAttribute('aria-label', on ? 'Stop voice input' : 'Start voice input');
  if (SR) $('#micHint').textContent = on ? `Listening (${locale(src.value)})…` : 'Tap to speak';
}
$('#mic').onclick = () => {
  if (rec) return rec.stop();
  const base = input.value.trim() ? input.value.trimEnd() + ' ' : '';
  rec = listen(locale(src.value), {
    onStart: () => setListening(true),
    onText: t => { input.value = (base + t).slice(0, 5000); $('#count').textContent = `${input.value.length} / 5000`; },
    onEnd: () => {
      rec = null; setListening(false);
      if (input.value.trim()) runTranslate(true).then(t => t && autoSpeak.checked && speak(t, locale(dst.value)));
    },
  });
};

/* ---------- Sharing ---------- */
const copy = t => t && navigator.clipboard?.writeText(t).then(() => toast('Copied to clipboard'), () => toast("Couldn't copy"));
async function share(text) {
  if (!text) return;
  if (navigator.share) { try { await navigator.share({ text }); } catch {} return; }
  copy(text);
}

/* ---------- Focus (All / one country) ---------- */
function moveInk(container, el) {
  const ink = $('.ink', container);
  if (!el || !ink) return;
  ink.style.width = el.offsetWidth + 'px';
  ink.style.height = el.offsetHeight + 'px';
  ink.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
}
function syncInks() {
  moveInk($('#tabs'), $('.tab[aria-current=page]'));
}
const FOCUS_LABEL = { all: 'All countries', ph: 'Philippines', us: 'United States', au: 'Australia', uk: 'United Kingdom' };
const focusFlags = f => flags(f === 'all' ? RORDER : [f]);
$('#rdMenu').innerHTML = Object.keys(FOCUS_LABEL).map(f => `<button role="option" data-region="${f}">${focusFlags(f)}<span>${FOCUS_LABEL[f]}</span></button>`).join('');
const menu = open => { $('#rdMenu').hidden = !open; $('#rdBtn').setAttribute('aria-expanded', open); };
$('#rdBtn').onclick = () => menu($('#rdMenu').hidden);
document.addEventListener('click', e => { if (!e.target.closest('#region')) menu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') menu(false); });
function setFocus(f) {
  S.focus = f; store.set('focus', f); root.dataset.region = f;
  $$('#rdMenu [data-region]').forEach(b => b.setAttribute('aria-selected', b.dataset.region === f));
  $('#rdCur').innerHTML = `${focusFlags(f)}<span class="rd-label">${f === 'all' ? 'All' : REGIONS[f].short}</span>`;
  menu(false);
  $('#accent').textContent = REGIONS[accent()].name;
  $('#dictCount').innerHTML = `<b>${pool().length}</b> ${f === 'all' ? 'words from the Philippines, the US, Australia &amp; the UK' : REGIONS[f].name + ' words'}`;
  syncInks(); renderPhrases(); renderWod(); renderDict(); buildQueue(); renderWords();
  clearTimeout(quiz.timer);
  quiz.q = null;
  if ($('#v-quiz').classList.contains('active')) nextQ();
}

/* ---------- Backup & restore (progress lives in this browser only) ---------- */
const BACKUP_KEYS = ['words', 'prog', 'days', 'qbest', 'saved', 'history', 'focus'];
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isEntry = e => isObj(e) && ['text', 'out', 'to'].every(k => typeof e[k] === 'string');
const CLEAN = {
  words: v => Array.isArray(v) && v.filter(w => typeof w === 'string'),
  saved: v => Array.isArray(v) && v.filter(isEntry),
  history: v => Array.isArray(v) && v.filter(isEntry),
  prog: v => isObj(v) && v,
  days: v => isObj(v) && typeof v.n === 'number' && v,
  qbest: v => Number.isFinite(v) && v,
  focus: v => FOCI.includes(v) && v,
};
function exportBackup() {
  const data = { app: 'lingomate', version: 1, exported: new Date().toISOString() };
  BACKUP_KEYS.forEach(k => (data[k] = store.get(k, null)));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `lingomate-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded');
}
$('#importFile').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (d?.app !== 'lingomate') throw new Error('not a backup');
    Object.entries(CLEAN).forEach(([k, clean]) => { const v = clean(d[k]); if (v !== false && v != null) store.set(k, v); });
    toast('Backup restored');
    setTimeout(() => location.reload(), 700);
  } catch { toast("That file isn't a Lingomate backup"); }
};

/* ---------- Install hint (iOS has no install prompt, so show how) ---------- */
let installEvt = null;
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function showInstall(html) {
  if (standalone || store.get('install-hidden')) return;
  $('#installTxt').innerHTML = html;
  $('#installBtn').hidden = !installEvt;
  $('#install').hidden = false;
}
const hideInstall = () => { $('#install').hidden = true; store.set('install-hidden', true); };
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; showInstall('<b>Install Lingomate</b>Open it from your home screen, even offline.'); });
if (isIOS) setTimeout(() => showInstall(`<b>Install Lingomate</b>Tap ${icon('ios-share')} then “Add to Home Screen”.`), 2500);

/* ---------- Global click delegation ---------- */
const ACTS = {
  close: closeModal,
  export: exportBackup,
  import: () => $('#importFile').click(),
  'hide-install': hideInstall,
  install: async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; hideInstall(); },
  lookup: () => openLookup(S.q.trim()),
  'translate-q': () => { closeModal(); src.value = 'auto'; input.value = S.q.trim(); persistLangs(); location.hash = '#translate'; onInput(); runTranslate(true); },
  'say-check': t => sayCheck(+t.dataset.id, t),
  known: t => markKnown(+t.dataset.id),
  more: () => buildQueue(true),
  replay: () => quiz.q && speak(...quiz.q.say),
  reset: () => { if (confirm('Reset all flashcard progress? Saved words are kept.')) { S.prog = {}; store.set('prog', {}); buildQueue(); renderWords(); renderDict(); toast('Progress reset'); } },
  'say-in': () => speak(input.value.trim(), locale(src.value === 'auto' ? last?.from : src.value)),
  'say-out': () => speak(output.dataset.text, locale(dst.value)),
  clear: () => { input.value = ''; onInput(); runTranslate(); input.focus(); },
  copy: () => copy(output.dataset.text),
  star: toggleSave,
  share: () => share(output.dataset.text),
  'clear-history': () => { S.history = []; store.set('history', []); renderHist(); },
};
// button[data-region]: <html> also carries data-region (for theming) and must never match
const SEL = '[data-act],[data-load],[data-unsave],[data-say],[data-audio],[data-phrase],[data-w],[data-save],[data-cat],[data-deck],[data-mode],button[data-region],[data-opt],[data-rate]';
document.addEventListener('click', e => {
  const t = e.target.closest(SEL);
  if (!t) return;
  const d = t.dataset;
  if (d.region) setFocus(d.region);
  else if (d.say !== undefined) speak(d.say, d.lang);
  else if (d.audio) playAudio(d.audio);
  else if (d.phrase) usePhrase(d.phrase);
  else if (d.load) { const [k, i] = d.load.split(':'); loadEntry(S[k][+i]); }
  else if (d.unsave) { S.saved.splice(+d.unsave, 1); store.set('saved', S.saved); renderHist(); syncStar(); }
  else if (d.w) openWord(+d.w);
  else if (d.save) toggleWord(d.save);
  else if (d.cat) { S.cat = d.cat; renderDict(); }
  else if (d.deck) { S.deck = d.deck; buildQueue(); }
  else if (d.mode) setMode(d.mode);
  else if (d.opt !== undefined) answer(t);
  else if (d.rate) rate(+d.rate);
  else if (d.act) ACTS[d.act]?.(t);
});

/* ---------- Effects: tap ripple ---------- */
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.rp');
  if (!el || el.disabled || reduced) return;
  const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, w = document.createElement('span');
  w.className = 'ripple';
  w.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  el.append(w);
  setTimeout(() => w.remove(), 700);
}, { passive: true });

/* ---------- Theme (circular reveal where View Transitions exist) ---------- */
const themeColor = () => { $('meta[name=theme-color]').content = root.dataset.theme === 'dark' ? '#161412' : '#faf7f2'; };
$('#themeBtn').onclick = e => {
  const flipTheme = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; store.set('theme', root.dataset.theme); themeColor(); };
  if (!document.startViewTransition || reduced) return flipTheme();
  root.style.setProperty('--cx', e.clientX + 'px');
  root.style.setProperty('--cy', e.clientY + 'px');
  document.startViewTransition(flipTheme);
};

/* ---------- Router ---------- */
const VIEWS = ['dictionary', 'learn', 'quiz', 'words', 'translate'];
function route() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'dictionary';
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'v-' + v));
  $$('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.view === v ? 'page' : 'false'));
  syncInks();
  if (v === 'quiz' && !quiz.q) nextQ();
  if (v === 'words') renderWords();
  if (v === 'dictionary') renderDict();
  scrollTo(0, 0);
}

/* ---------- Init ---------- */
addEventListener('hashchange', route);
addEventListener('resize', syncInks);
addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', scrollY > 8), { passive: true });
document.fonts?.ready.then(syncInks);
setOutput('');
renderHist();
renderQStats();
setFocus(S.focus);
route();
themeColor();
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')));
if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
