import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { aiStatus } from '../services/llm.service.js';

const router = Router();

// Lets the UI explain why AI actions are disabled. Never includes keys.
router.get('/status', requireAuth, (_req, res) => {
  res.json({ ai: aiStatus() });
});

export default router;
