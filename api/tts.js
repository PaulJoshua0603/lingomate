// POST /api/tts — natural neural voice via Azure Speech (optional). Returns audio/mpeg.
import { guard, configured, clip, send } from './_coach.js';

const VOICES = {
  'au-female': { name: 'en-AU-NatashaNeural', lang: 'en-AU' },
  'au-male': { name: 'en-AU-WilliamNeural', lang: 'en-AU' },
  'neutral-female': { name: 'en-US-JennyNeural', lang: 'en-US' },
  'neutral-male': { name: 'en-US-GuyNeural', lang: 'en-US' },
};
const xml = s => s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

export default async function handler(req, res) {
  if (guard(req, res, configured.azure)) return;
  const text = clip(req.body?.text, 800);
  if (!text) return send(res, 400, { error: 'No text to speak.' });
  const voice = VOICES[req.body?.voice] || VOICES['au-female'];
  const pct = Math.round((Math.min(1.5, Math.max(0.5, Number(req.body?.rate) || 1)) - 1) * 100);
  // Shorter, even pauses at sentence ends and commas so the speech flows like a real conversation
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voice.lang}"><voice name="${voice.name}">`
    + '<mstts:silence type="Leading-exact" value="0ms"/><mstts:silence type="Sentenceboundary-exact" value="250ms"/><mstts:silence type="Comma-exact" value="120ms"/>'
    + `<prosody rate="${pct >= 0 ? '+' : ''}${pct}%">${xml(text)}</prosody></voice></speak>`;
  try {
    const r = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-48khz-96kbitrate-mono-mp3',
        'User-Agent': 'lingomate',
      },
      body: ssml,
    });
    if (!r.ok) return send(res, 502, { error: `Voice service error (${r.status}).` });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    console.error(e);
    send(res, 503, { error: "Couldn't reach the voice service." });
  }
}
