import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'lg';
}

/** Native <dialog>: focus trap, Esc and inert background come for free. */
export function Dialog({ open, onClose, title, children, footer, size = 'sm' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={`m-auto w-[calc(100%-2rem)] rounded-2xl border border-white/10 bg-ink-2 p-0 text-white shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm ${
        size === 'lg' ? 'max-w-3xl' : 'max-w-md'
      }`}
    >
      {open && (
        <div className="flex max-h-[85svh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
            <h2 id="dialog-title" className="text-base font-medium">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 grid size-8 place-items-center rounded-lg text-white/50 hover:bg-white/8 hover:text-white"
              aria-label="Close"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4 text-sm text-white/70">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
