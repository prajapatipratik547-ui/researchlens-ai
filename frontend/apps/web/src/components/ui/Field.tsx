import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  count?: { value: number; max: number };
  children: ReactNode;
}

function FieldShell({ id, label, error, hint, count, children }: FieldShellProps) {
  const over = count && count.value > count.max;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-white/80">
          {label}
        </label>
        {count && (
          <span className={`font-mono text-[11px] tabular-nums ${over ? 'text-contradict' : 'text-white/35'}`} aria-live="polite">
            {count.value}/{count.max}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12.5px] text-[#ff8aa3]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] text-white/40">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const control =
  'w-full rounded-xl border bg-white/[0.04] px-3.5 text-[14.5px] text-white placeholder:text-white/30 outline-none transition-colors focus:border-violet-300/70 focus:bg-white/[0.06] aria-[invalid=true]:border-contradict/70';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  count?: { value: number; max: number };
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, count, className = '', ...rest }, ref) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} count={count}>
      <input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${control} h-11 border-white/10 ${className}`}
        {...rest}
      />
    </FieldShell>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  count?: { value: number; max: number };
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, count, className = '', ...rest },
  ref,
) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} count={count}>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${control} resize-y border-white/10 py-3 leading-relaxed ${className}`}
        {...rest}
      />
    </FieldShell>
  );
});

/** Form-level error (e.g. INVALID_CREDENTIALS, network). */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-contradict/40 bg-contradict/10 px-4 py-3 text-[13.5px] text-[#ffc2cf]">
      {children}
    </div>
  );
}
