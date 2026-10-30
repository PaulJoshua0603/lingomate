// POST /api/chat — one conversation turn ({task: "turn"}) or an end-of-session review ({task: "review"}).
import { guard, configured, coachTurn, coachReview, fail, send } from './_coach.js';

export default async function handler(req, res) {
  if (guard(req, res, configured.ai)) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    send(res, 200, body.task === 'review' ? await coachReview(body) : await coachTurn(body));
  } catch (e) {
    fail(res, e);
  }
}
