import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toApiError } from './errors';

/**
 * Put each `error.details` entry under its input; return a form-level message for
 * everything that isn't tied to a known field.
 */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
): string | null {
  const error = toApiError(err);
  let unmapped = error.details.length === 0;
  for (const d of error.details) {
    const field = fields.find((f) => f === d.field);
    if (field) setError(field, { type: 'server', message: d.message });
    else unmapped = true;
  }
  if (error.status === 429) return 'Too many attempts. Wait a few minutes, then try again.';
  return unmapped ? error.message : null;
}
