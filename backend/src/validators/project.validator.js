import { z } from 'zod';

export const objectId = (label = 'id') =>
  z.string().regex(/^[a-f\d]{24}$/i, `Invalid ${label}`);

export const projectIdParams = z.object({ id: objectId('project id') });

export const createProjectSchema = z.object({
  title: z
    .string({ error: 'Title is required' })
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(150, 'Title must be at most 150 characters'),
  researchQuestion: z
    .string({ error: 'Research question is required' })
    .trim()
    .min(10, 'Research question must be at least 10 characters')
    .max(600, 'Research question must be at most 600 characters'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters')
    .optional()
    .default(''),
});
