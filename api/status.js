// GET /api/status — which integrations are set up, and whether the sent access code is right. Reveals no secrets.
import { configured, authorized, MODEL } from './_coach.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const ai = configured.ai(), azure = configured.azure();
  res.status(200).json({ ai, voice: azure, pronunciation: azure, authorized: authorized(req), model: ai ? MODEL : null });
}
