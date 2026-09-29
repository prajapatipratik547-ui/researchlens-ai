/** Validation limits and typical timings, from the ResearchLens integration guide. */
export const LIMITS = {
  name: { min: 2, max: 80 },
  /** Measured in UTF-8 bytes (bcrypt truncates past 72). */
  passwordBytes: { min: 8, max: 72 },
  project: {
    title: { min: 3, max: 150 },
    researchQuestion: { min: 10, max: 600 },
    description: { max: 2000 },
  },
  question: { min: 3, max: 1000 },
  upload: {
    maxFiles: 5,
    maxBytes: 10 * 1024 * 1024,
    extensions: ['.pdf', '.docx', '.txt'] as const,
    fieldName: 'files',
  },
  sessionDays: 7,
} as const;

export const TIMING = {
  /** Default Axios timeout. */
  requestTimeoutMs: 30_000,
  /** /analyze and /brief can take up to a minute. */
  longRequestTimeoutMs: 90_000,
  documentPollMs: 2_500,
} as const;

/** Confidence score (0–100) → label. */
export type ConfidenceLabel = 'Low' | 'Medium' | 'High';
export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}
