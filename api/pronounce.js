// POST /api/pronounce — pronunciation assessment via Azure Speech (optional).
// Body: { audio: base64 16 kHz mono 16-bit WAV, text: reference sentence, lang: "en-AU" | "en-US" }
import { guard, configured, clip, send } from './_coach.js';

const pick = (o, k) => o?.PronunciationAssessment?.[k] ?? o?.[k];

export default async function handler(req, res) {
  if (guard(req, res, configured.azure)) return;
  const audio = Buffer.from(String(req.body?.audio || ''), 'base64');
  const text = clip(req.body?.text, 300);
  const lang = req.body?.lang === 'en-US' ? 'en-US' : 'en-AU';
  if (!text || audio.length < 2000 || audio.length > 2_500_000) return send(res, 400, { error: 'Record between 1 and 60 seconds of audio.' });
  const settings = {
    ReferenceText: text, GradingSystem: 'HundredMark', Granularity: 'Word', Dimension: 'Comprehensive', EnableMiscue: true,
    ...(lang === 'en-US' ? { EnableProsodyAssessment: true } : {}), // prosody (intonation) scoring is only offered for en-US
  };
  try {
    const r = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${lang}&format=detailed`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        'Pronunciation-Assessment': Buffer.from(JSON.stringify(settings)).toString('base64'),
        Accept: 'application/json',
      },
      body: audio,
    });
    if (!r.ok) return send(res, 502, { error: `Pronunciation service error (${r.status}).` });
    const j = await r.json();
    if (j.RecognitionStatus !== 'Success') return send(res, 200, { heard: '', scores: null, words: [], status: j.RecognitionStatus });
    const best = j.NBest?.[0] || {};
    send(res, 200, {
      heard: best.Display || j.DisplayText || '',
      scores: {
        overall: pick(best, 'PronScore'), accuracy: pick(best, 'AccuracyScore'), fluency: pick(best, 'FluencyScore'),
        completeness: pick(best, 'CompletenessScore'), prosody: pick(best, 'ProsodyScore') ?? null,
      },
      words: (best.Words || []).map(w => ({ word: w.Word, score: pick(w, 'AccuracyScore'), error: pick(w, 'ErrorType') || 'None' })),
    });
  } catch (e) {
    console.error(e);
    send(res, 503, { error: "Couldn't reach the pronunciation service." });
  }
}
