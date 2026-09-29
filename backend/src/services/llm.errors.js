/**
 * Provider-level failure, classified so the AI layer can decide whether to
 * retry and which HTTP error the client sees.
 *   rate_limited · unavailable · timeout · auth · bad_request · bad_response
 */
export class AIProviderError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'AIProviderError';
    this.kind = kind;
  }
}
