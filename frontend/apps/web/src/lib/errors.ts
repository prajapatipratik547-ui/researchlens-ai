import { apiErrorBodySchema, type FieldError } from '@synapse/shared';
import { isAxiosError } from 'axios';

/** Normalised error for everything the API client throws. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: FieldError[];

  constructor(status: number, code: string, message: string, details: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetwork() {
    return this.status === 0;
  }
}

const FALLBACK: Record<number, string> = {
  401: 'Your session has ended. Please log in again.',
  404: 'We couldn’t find that.',
  413: 'That’s too large. Files must be 10 MB or less.',
  429: 'Too many requests right now. Wait a moment and try again.',
};

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return new ApiError(0, 'TIMEOUT', 'The server took too long to respond. Try again.');
    }
    if (!err.response) {
      return new ApiError(0, 'NETWORK_ERROR', 'Can’t reach the server. Check your connection and try again.');
    }
    const { status, data } = err.response;
    const parsed = apiErrorBodySchema.safeParse(data);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      return new ApiError(status, code, message, details ?? []);
    }
    return new ApiError(
      status,
      status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN',
      FALLBACK[status] ?? 'Something went wrong. Try again.',
    );
  }
  return new ApiError(0, 'UNKNOWN', err instanceof Error ? err.message : 'Something went wrong.');
}

/** Message for a given field from a validation error, if any. */
export function fieldMessage(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.details.find((d) => d.field === field)?.message : undefined;
}
