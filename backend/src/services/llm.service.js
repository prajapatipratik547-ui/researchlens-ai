import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { AIProviderError } from './llm.errors.js';
import { createGeminiProvider } from './gemini.service.js';
import { createOpenAICompatibleProvider } from './openai-compatible.service.js';

// ---------------------------------------------------------------------------
// Provider selection. The rest of the app calls generateJSON() and never
// knows which vendor answered, so switching is one line in .env.
// ---------------------------------------------------------------------------
function createProvider() {
  const timeoutMs = env.AI_TIMEOUT_MS;
  switch (env.AI_PROVIDER) {
    case 'gemini':
      if (!env.GEMINI_API_KEY) return null;
      return createGeminiProvider({
        apiKey: env.GEMINI_API_KEY,
        models: [env.GEMINI_MODEL, ...env.GEMINI_FALLBACK_MODELS.filter((m) => m !== env.GEMINI_MODEL)],
        timeoutMs,
      });
    case 'groq':
      if (!env.GROQ_API_KEY) return null;
      return createOpenAICompatibleProvider({
        name: 'groq',
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: env.GROQ_API_KEY,
        model: env.GROQ_MODEL,
        timeoutMs,
      });
    case 'openai':
      // Local servers (LM Studio, Ollama) need no key.
      if (!env.AI_BASE_URL || !env.AI_MODEL) return null;
      return createOpenAICompatibleProvider({
        name: 'openai-compatible',
        baseURL: env.AI_BASE_URL,
        apiKey: env.AI_API_KEY,
        model: env.AI_MODEL,
        timeoutMs,
      });
    default:
      return null;
  }
}

let provider = createProvider();

/** Tests swap in a fake provider; pass null to simulate "not configured". */
export function setProviderForTesting(fake) {
  provider = fake;
}
export function resetProvider() {
  provider = createProvider();
}

export function aiStatus() {
  return {
    configured: Boolean(provider),
    provider: provider?.name ?? env.AI_PROVIDER,
    model: provider?.model ?? null,
  };
}

// ---------------------------------------------------------------------------
// Structured generation
// ---------------------------------------------------------------------------

/** Pulls a JSON object out of a reply, tolerating ```json fences or chatter. */
export function parseJSONReply(text) {
  const unfenced = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    return undefined;
  }
}

function toApiError(err) {
  if (err instanceof ApiError) return err;
  const kind = err instanceof AIProviderError ? err.kind : 'unavailable';
  switch (kind) {
    case 'rate_limited':
      return new ApiError(429, 'The AI service is busy right now. Please try again in a minute.', {
        code: 'AI_RATE_LIMITED',
      });
    case 'bad_response':
      return new ApiError(502, 'The AI returned an answer we could not use. Please try again.', {
        code: 'AI_BAD_RESPONSE',
      });
    case 'timeout':
      return new ApiError(503, 'The AI service took too long to respond. Please try again.', {
        code: 'AI_UNAVAILABLE',
      });
    default:
      // auth / bad_request / unavailable: a configuration or outage problem
      // the user cannot fix, so the message stays generic.
      return new ApiError(503, 'The AI service is unavailable right now. Please try again later.', {
        code: 'AI_UNAVAILABLE',
      });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Asks the model for JSON and validates it with a Zod schema.
 *
 * - An invalid or off-schema reply gets one repair attempt that shows the
 *   model what was wrong.
 * - A temporarily unavailable provider gets one retry after a short pause.
 * - Anything else becomes an ApiError with an AI_* code (see the guide).
 *
 * @param {{ label: string, system: string, prompt: string, schema: import('zod').ZodType,
 *           temperature?: number, maxOutputTokens?: number }} request
 */
export async function generateJSON({
  label,
  system,
  prompt,
  schema,
  temperature = 0.2,
  maxOutputTokens = 8192,
}) {
  if (!provider) {
    throw new ApiError(503, 'AI features are not configured on the server.', { code: 'AI_UNAVAILABLE' });
  }

  const call = async (userPrompt) => {
    const request = { system, prompt: userPrompt, temperature, maxOutputTokens, json: true };
    try {
      return await provider.complete(request);
    } catch (err) {
      if (err instanceof AIProviderError && err.kind === 'unavailable') {
        await sleep(env.isTest ? 0 : 1500);
        return provider.complete(request);
      }
      throw err;
    }
  };

  const started = Date.now();
  try {
    let reply = await call(prompt);
    let data = parseJSONReply(reply.text);
    let result = data === undefined ? null : schema.safeParse(data);

    if (!result?.success) {
      const problem = result
        ? result.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
        : 'the reply was not valid JSON';
      logger.warn('AI reply failed validation, asking for a repair', { label, problem });
      reply = await call(
        `${prompt}\n\nYour previous reply could not be used because ${problem}. ` +
          'Reply again with only a JSON object in exactly the requested format.',
      );
      data = parseJSONReply(reply.text);
      result = data === undefined ? null : schema.safeParse(data);
      if (!result?.success) throw new AIProviderError('bad_response', `${label}: invalid JSON after repair`);
    }

    logger.info('AI call complete', {
      label,
      provider: provider.name,
      model: reply.model,
      ms: Date.now() - started,
    });
    return result.data;
  } catch (err) {
    logger.error('AI call failed', { label, error: err.message, kind: err.kind });
    throw toApiError(err);
  }
}
