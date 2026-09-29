export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type Size = 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-white text-ink hover:bg-violet-50 disabled:bg-white/40',
  secondary: 'bg-white/[0.07] text-white ring-1 ring-white/10 hover:bg-white/[0.12] disabled:text-white/40',
  ghost: 'text-white/70 hover:bg-white/[0.06] hover:text-white disabled:text-white/30',
  danger: 'bg-contradict text-white hover:bg-[#c8103a] disabled:bg-contradict/40',
};
const SIZE: Record<Size, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-11 gap-2 rounded-xl px-5 text-sm',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}
