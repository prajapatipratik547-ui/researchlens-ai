import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Labelled input (or textarea with `multiline`) with an accessible inline
 * error, optional hint, and a character counter when `maxLength` is set.
 */
export default function FormField({
  label,
  error,
  hint,
  optional = false,
  multiline = false,
  type = 'text',
  ...inputProps
}) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const { maxLength, value } = inputProps;

  const shared = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    ...inputProps,
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="label">
          {label}
          {optional && <span className="ml-1.5 font-normal text-slate-400">(optional)</span>}
        </label>
        {maxLength && typeof value === 'string' && (
          <span
            className={`text-xs tabular-nums ${value.length > maxLength * 0.9 ? 'text-amber-600' : 'text-slate-400'}`}
            aria-hidden="true"
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <div className="relative">
        {multiline ? (
          <textarea rows={3} className="input resize-y leading-relaxed" {...shared} />
        ) : (
          <input
            type={isPassword && revealed ? 'text' : type}
            className={`input ${isPassword ? 'pr-11' : ''}`}
            {...shared}
          />
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-600"
            aria-label={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
