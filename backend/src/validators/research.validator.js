import { z } from 'zod';
import { INSIGHT_TYPES } from '../models/Insight.js';
import { objectId } from './project.validator.js';

export const insightsQuery = z.object({
  type: z.enum(INSIGHT_TYPES, { error: `Type must be one of: ${INSIGHT_TYPES.join(', ')}` }).optional(),
});

export const researchParams = z.object({ projectId: objectId('project id') });

export const askSchema = z.object({
  question: z
    .string({ error: 'Question is required' })
    .trim()
    .min(3, 'Question must be at least 3 characters')
    .max(1000, 'Question must be at most 1000 characters'),
});
