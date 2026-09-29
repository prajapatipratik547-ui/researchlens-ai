import { z } from 'zod';
import { LIMITS } from './limits';

/* ------------------------------------------------------------------ primitives */

/** Mongo ObjectId: 24 hex characters. */
export const idSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
export const isoDateSchema = z.string().datetime({ offset: true });
export const confidenceSchema = z.number().min(0).max(100);

/* ------------------------------------------------------------------ errors */

export const errorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'INVALID_JSON',
  'NO_TOKEN',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'USER_NOT_FOUND',
  'INVALID_CREDENTIALS',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'FILE_TYPE_NOT_ALLOWED',
  'TOO_MANY_FILES',
  'FILE_TOO_LARGE',
  'NO_READY_SOURCES',
  'ANALYSIS_REQUIRED',
  'ANALYSIS_IN_PROGRESS',
  'AI_RATE_LIMITED',
  'AI_BAD_RESPONSE',
  'AI_UNAVAILABLE',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const fieldErrorSchema = z.object({ field: z.string(), message: z.string() });

/** Every error from every endpoint has this shape. */
export const apiErrorBodySchema = z.object({
  error: z.object({
    message: z.string(),
    // Unknown future codes must not break the client.
    code: z.union([errorCodeSchema, z.string()]),
    details: z.array(fieldErrorSchema).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
export type FieldError = z.infer<typeof fieldErrorSchema>;

/* ------------------------------------------------------------------ auth */

export const userSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type User = z.infer<typeof userSchema>;

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

export const passwordSchema = z
  .string()
  .refine((p) => utf8Bytes(p) >= LIMITS.passwordBytes.min, `Use at least ${LIMITS.passwordBytes.min} characters`)
  .refine((p) => utf8Bytes(p) <= LIMITS.passwordBytes.max, `Use at most ${LIMITS.passwordBytes.max} bytes`)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number');

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');

export const registerRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(LIMITS.name.min, `Name must be at least ${LIMITS.name.min} characters`)
    .max(LIMITS.name.max, `Name must be at most ${LIMITS.name.max} characters`),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authResponseSchema = z.object({ user: userSchema, token: z.string() });
export type AuthResponse = z.infer<typeof authResponseSchema>;
export const meResponseSchema = z.object({ user: userSchema });

/* ------------------------------------------------------------------ projects */

export const projectStatusSchema = z.enum(['draft', 'active', 'analyzed']);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectSchema = z.object({
  id: idSchema,
  userId: idSchema,
  title: z.string(),
  researchQuestion: z.string(),
  description: z.string(),
  status: projectStatusSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  stats: z.object({ sourceCount: z.number(), insightCount: z.number(), gapCount: z.number() }),
  // Arrives with Phase 7; tolerate its absence until then.
  analyzedAt: isoDateSchema.nullable().optional(),
});
export type Project = z.infer<typeof projectSchema>;

export const createProjectRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(LIMITS.project.title.min, `Title must be at least ${LIMITS.project.title.min} characters`)
    .max(LIMITS.project.title.max, `Title must be at most ${LIMITS.project.title.max} characters`),
  researchQuestion: z
    .string()
    .trim()
    .min(
      LIMITS.project.researchQuestion.min,
      `Question must be at least ${LIMITS.project.researchQuestion.min} characters`,
    )
    .max(
      LIMITS.project.researchQuestion.max,
      `Question must be at most ${LIMITS.project.researchQuestion.max} characters`,
    ),
  description: z
    .string()
    .trim()
    .max(LIMITS.project.description.max, `Description must be at most ${LIMITS.project.description.max} characters`)
    .optional(),
});
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const projectsResponseSchema = z.object({ projects: z.array(projectSchema) });
export const projectResponseSchema = z.object({ project: projectSchema });

/* ------------------------------------------------------------------ documents */

export const fileTypeSchema = z.enum(['pdf', 'docx', 'txt']);
export const processingStatusSchema = z.enum(['processing', 'analyzing', 'ready', 'failed']);
export type ProcessingStatus = z.infer<typeof processingStatusSchema>;

export const documentSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  filename: z.string(),
  fileType: fileTypeSchema,
  fileSize: z.number(),
  processingStatus: processingStatusSchema,
  processingError: z.string(),
  summary: z.string(),
  metadata: z.object({
    pageCount: z.number().nullable(),
    wordCount: z.number(),
    chunkCount: z.number(),
  }),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type SourceDocument = z.infer<typeof documentSchema>;

export const documentDetailSchema = documentSchema.extend({ extractedText: z.string() });
export type SourceDocumentDetail = z.infer<typeof documentDetailSchema>;

export const documentsResponseSchema = z.object({ documents: z.array(documentSchema) });
export const documentResponseSchema = z.object({ document: documentDetailSchema });

/* ------------------------------------------------------------------ evidence */

export const supportSchema = z.enum(['supporting', 'contradicting', 'unclear']);
export const evidenceStatusSchema = z.enum(['supporting', 'contradicting', 'unclear', 'no_evidence']);
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;

/** Evidence item inside a conversation answer. */
export const answerEvidenceSchema = z.object({
  claim: z.string(),
  sourceId: idSchema,
  sourceName: z.string(),
  page: z.number().nullable(),
  quote: z.string(),
  support: supportSchema,
});
export type AnswerEvidence = z.infer<typeof answerEvidenceSchema>;

export const sourceRefSchema = z.object({
  documentId: idSchema,
  filename: z.string(),
  pageNumber: z.number().nullable(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

/** Evidence item inside an insight (different field names from answer evidence). */
export const insightEvidenceSchema = sourceRefSchema.extend({
  claim: z.string(),
  quote: z.string(),
  support: supportSchema,
});
export type InsightEvidence = z.infer<typeof insightEvidenceSchema>;

/* ------------------------------------------------------------------ research */

export const askRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(LIMITS.question.min, `Ask at least ${LIMITS.question.min} characters`)
    .max(LIMITS.question.max, `Keep questions under ${LIMITS.question.max} characters`),
});
export type AskRequest = z.infer<typeof askRequestSchema>;

export const conversationSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  question: z.string(),
  response: z.object({
    answer: z.string(),
    keyFindings: z.array(z.string()),
    evidence: z.array(answerEvidenceSchema),
    confidence: confidenceSchema,
    limitations: z.array(z.string()),
    insufficientEvidence: z.boolean(),
  }),
  sources: z.array(sourceRefSchema),
  createdAt: isoDateSchema,
});
export type Conversation = z.infer<typeof conversationSchema>;

export const conversationResponseSchema = z.object({ conversation: conversationSchema });
export const conversationsResponseSchema = z.object({ conversations: z.array(conversationSchema) });

export const insightTypeSchema = z.enum([
  'key_finding',
  'theme',
  'contradiction',
  'research_gap',
  'unanswered_question',
]);
export type InsightType = z.infer<typeof insightTypeSchema>;

const claimRefSchema = z.object({
  text: z.string(),
  documentId: idSchema,
  filename: z.string(),
  pageNumber: z.number().nullable(),
});

export const contradictionDetailsSchema = z.object({
  claimA: claimRefSchema,
  claimB: claimRefSchema,
  possibleExplanation: z.string(),
});
export const gapDetailsSchema = z.object({ rationale: z.string() });

export const insightSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  type: insightTypeSchema,
  title: z.string(),
  description: z.string(),
  confidence: confidenceSchema,
  evidence: z.array(insightEvidenceSchema),
  details: z.union([contradictionDetailsSchema, gapDetailsSchema]).nullable(),
  sourceReferences: z.array(sourceRefSchema),
  createdAt: isoDateSchema,
});
export type Insight = z.infer<typeof insightSchema>;
export type ContradictionDetails = z.infer<typeof contradictionDetailsSchema>;
export type GapDetails = z.infer<typeof gapDetailsSchema>;

const analysisMeta = {
  analyzedAt: isoDateSchema.nullable(),
  outdated: z.boolean(),
};

export const insightsResponseSchema = z.object({ insights: z.array(insightSchema), ...analysisMeta });
export const gapsResponseSchema = z.object({ gaps: z.array(insightSchema), ...analysisMeta });

export const evidenceMatrixSchema = z.object({
  sources: z.array(z.object({ documentId: idSchema, filename: z.string() })),
  rows: z.array(
    z.object({
      id: z.string(),
      claim: z.string(),
      cells: z.array(
        z.object({
          documentId: idSchema,
          status: evidenceStatusSchema,
          note: z.string(),
          pageNumber: z.number().nullable(),
        }),
      ),
    }),
  ),
});
export type EvidenceMatrix = z.infer<typeof evidenceMatrixSchema>;
export const evidenceResponseSchema = z.object({ matrix: evidenceMatrixSchema.nullable(), ...analysisMeta });

export const analysisResponseSchema = z.object({
  analysis: z.object({
    analyzedAt: isoDateSchema,
    sourceCount: z.number(),
    counts: z.record(insightTypeSchema, z.number()),
  }),
});
export type AnalysisResult = z.infer<typeof analysisResponseSchema>['analysis'];

export const briefSchema = z.object({
  title: z.string(),
  markdown: z.string(),
  generatedAt: isoDateSchema,
});
export type ResearchBrief = z.infer<typeof briefSchema>;
export const briefResponseSchema = z.object({ brief: briefSchema, outdated: z.boolean() });

export const healthResponseSchema = z.object({ status: z.string(), database: z.string() });
