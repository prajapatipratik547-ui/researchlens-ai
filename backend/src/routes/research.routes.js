import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import {
  analyze,
  ask,
  getBrief,
  getEvidence,
  listConversations,
  listGaps,
  listInsights,
} from '../controllers/research.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireOwnedProject } from '../middleware/project.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { askSchema, insightsQuery, researchParams } from '../validators/research.validator.js';

// Every AI request spends free-tier quota; cap each signed-in user so one
// runaway tab or script can't exhaust it for everyone.
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  keyGenerator: (req) => String(req.userId),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (_req, res) =>
    res.status(429).json({
      error: { message: 'You have made a lot of AI requests. Please wait a few minutes.', code: 'AI_RATE_LIMITED' },
    }),
});

const router = Router();
const ownProject = [requireAuth, validate({ params: researchParams }), requireOwnedProject('projectId')];

router.post('/:projectId/ask', ...ownProject, aiLimiter, validate({ body: askSchema }), ask);
router.get('/:projectId/conversations', ...ownProject, listConversations);

router.post('/:projectId/analyze', ...ownProject, aiLimiter, analyze);
router.get('/:projectId/insights', ...ownProject, validate({ query: insightsQuery }), listInsights);
router.get('/:projectId/gaps', ...ownProject, listGaps);
router.get('/:projectId/evidence', ...ownProject, getEvidence);
// Writes the brief on first request after an analysis, so it counts as AI use.
router.get('/:projectId/brief', ...ownProject, aiLimiter, getBrief);

export default router;
