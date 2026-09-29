import { logger } from '../utils/logger.js';
import { AIProviderError } from './llm.errors.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Google Gemini over its REST API (no SDK needed). Tries `models` in order:
 * a model that is overloaded (503) or out of quota (429) hands the request
 * to the next one, so a busy free-tier model doesn't fail the request.
 */
export function createGeminiProvider({ apiKey, models, timeoutMs }) {
  async function callModel(model, { system, prompt, temperature, maxOutputTokens, json }) {
    let res;
    try {
      res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
            ...(json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      });
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError';
      throw new AIProviderError(timedOut ? 'timeout' : 'unavailable', timedOut ? 'Gemini timed out' : `Gemini unreachable: ${err.message}`);
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = `${res.status} ${body.error?.status ?? ''} ${body.error?.message ?? ''}`.trim();
      if (res.status === 429) throw new AIProviderError('rate_limited', `Gemini quota: ${detail}`);
      if (res.status === 400 && /API key/i.test(body.error?.message ?? '')) {
        throw new AIProviderError('auth', `Gemini rejected the API key: ${detail}`);
      }
      if (res.status === 401 || res.status === 403) throw new AIProviderError('auth', `Gemini auth: ${detail}`);
      if (res.status === 404) {
        // Also returned for models Google has retired for new keys.
        const err = new AIProviderError('unavailable', `Gemini model not available: ${model}`);
        err.modelMissing = true;
        throw err;
      }
      if (res.status >= 500) throw new AIProviderError('unavailable', `Gemini server: ${detail}`);
      throw new AIProviderError('bad_request', `Gemini request rejected: ${detail}`);
    }

    const candidate = body.candidates?.[0];
    if (!candidate) {
      const reason = body.promptFeedback?.blockReason ?? 'no candidates';
      throw new AIProviderError('bad_response', `Gemini returned nothing (${reason})`);
    }
    const text = candidate.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (candidate.finishReason === 'MAX_TOKENS') {
      throw new AIProviderError('bad_response', 'Gemini reply was cut off (MAX_TOKENS)');
    }
    if (!text.trim()) {
      throw new AIProviderError('bad_response', `Gemini returned empty text (${candidate.finishReason})`);
    }
    return { text, model, usage: body.usageMetadata };
  }

  return {
    name: 'gemini',
    model: models[0],
    async complete(request) {
      const errors = [];
      for (const model of models) {
        try {
          return await callModel(model, request);
        } catch (err) {
          // Only capacity problems are worth another model; a bad key or a
          // bad request fails the same way everywhere.
          if (!['rate_limited', 'unavailable', 'timeout'].includes(err.kind)) throw err;
          errors.push(err);
          if (models.length > 1) logger.warn('Gemini model failed, trying the next one', { model, kind: err.kind, error: err.message });
        }
      }
      // Report the most useful cause: quota beats a retired fallback model.
      throw (
        errors.find((e) => e.kind === 'rate_limited') ??
        errors.find((e) => !e.modelMissing) ??
        errors[0]
      );
    },
  };
}
