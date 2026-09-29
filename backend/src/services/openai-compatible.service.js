import { AIProviderError } from './llm.errors.js';

/**
 * Any OpenAI-compatible chat completions API: Groq, OpenRouter, LM Studio,
 * Ollama. Only `baseURL`, `apiKey` and `model` differ between them.
 */
export function createOpenAICompatibleProvider({ name, baseURL, apiKey, model, timeoutMs }) {
  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

  return {
    name,
    model,
    async complete({ system, prompt, temperature, maxOutputTokens, json }) {
      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            model,
            temperature,
            max_tokens: maxOutputTokens,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
            ...(json ? { response_format: { type: 'json_object' } } : {}),
          }),
        });
      } catch (err) {
        const timedOut = err?.name === 'TimeoutError';
        throw new AIProviderError(timedOut ? 'timeout' : 'unavailable', `${name}: ${err.message}`);
      }

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = `${res.status} ${body.error?.message ?? ''}`.trim();
        if (res.status === 429) throw new AIProviderError('rate_limited', `${name} rate limit: ${detail}`);
        if (res.status === 401 || res.status === 403) throw new AIProviderError('auth', `${name} auth: ${detail}`);
        if (res.status >= 500) throw new AIProviderError('unavailable', `${name} server: ${detail}`);
        throw new AIProviderError('bad_request', `${name} request rejected: ${detail}`);
      }

      const choice = body.choices?.[0];
      const text = choice?.message?.content ?? '';
      if (choice?.finish_reason === 'length') {
        throw new AIProviderError('bad_response', `${name} reply was cut off (length)`);
      }
      if (!text.trim()) throw new AIProviderError('bad_response', `${name} returned empty text`);
      return { text, model, usage: body.usage };
    },
  };
}
