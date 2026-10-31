// POST /api/transcribe — accurate speech-to-text with Whisper on Groq, so the learner's real words are what gets reviewed.
// Body: { audio: base64 recording (webm, ogg, mp4 or wav), type: its MIME type, prompt: what the partner just said (context) }
import { guard, configured, clip, send } from './_coach.js';

const EXT = { webm: 'webm', ogg: 'ogg', mp4: 'mp4', 'x-m4a': 'm4a', aac: 'm4a', mpeg: 'mp3', wav: 'wav' };
// Spelling hints for words Whisper can't guess from sound alone
const HINT = 'Workplace chat with an Australian manager. HR terms: 201 file, NBI clearance, SSS, PhilHealth, Pag-IBIG, TIN, onboarding, payroll.';

export default async function handler(req, res) {
  if (guard(req, res, configured.transcribe)) return;
  const audio = Buffer.from(String(req.body?.audio || ''), 'base64');
  if (audio.length < 1000 || audio.length > 3_000_000) return send(res, 400, { error: 'Record between 1 second and 2 minutes.' });
  const mime = String(req.body?.type || 'audio/webm').split(';')[0];
  const form = new FormData();
  form.append('file', new Blob([audio], { type: mime }), `answer.${EXT[mime.split('/')[1]] || 'webm'}`);
  form.append('model', 'whisper-large-v3');
  form.append('language', 'en');
  form.append('temperature', '0');
  form.append('response_format', 'verbose_json');
  form.append('prompt', `${HINT} ${clip(req.body?.prompt, 400)}`.trim());
  try {
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      signal: AbortSignal.timeout(40_000),
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
    });
    if (r.status === 429) return send(res, 429, { error: 'Too many recordings at once. Wait a moment and try again.' });
    if (!r.ok) {
      console.error('Groq transcription error', r.status, await r.text().catch(() => ''));
      return send(res, 502, { error: `Speech-to-text error (${r.status}).` });
    }
    const j = await r.json();
    // Drop segments Whisper marks as probably silence, where it tends to invent words like "Thank you."
    const segs = Array.isArray(j.segments) ? j.segments.filter(x => !(x.no_speech_prob > 0.6 && x.avg_logprob < -0.7)) : null;
    send(res, 200, { text: clip(segs ? segs.map(x => x.text).join('') : j.text, 1500) });
  } catch (e) {
    console.error(e);
    send(res, 503, { error: "Couldn't reach the speech-to-text service." });
  }
}
