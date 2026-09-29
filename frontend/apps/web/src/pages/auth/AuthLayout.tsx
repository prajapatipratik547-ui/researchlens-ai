import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { BrandMark } from '../../components/app/AppShell';
import { Sparkle } from '../../components/ui/Sparkle';

const PANEL_BG =
  'radial-gradient(90% 70% at 0% 0%, #7a2ff0 0%, #5516c0 22%, transparent 62%), radial-gradient(70% 40% at 50% 112%, rgb(178 150 225 / 0.55), transparent 70%), linear-gradient(180deg, #3a0a8a 0%, #200552 50%, #1b1428 100%)';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-svh bg-ink p-2 text-white lg:grid-cols-[1.05fr_1fr]">
      <aside className="panel grain relative hidden flex-col justify-between p-10 lg:flex" style={{ background: PANEL_BG }}>
        <BrandMark />
        <div>
          <Sparkle className="size-12 text-white/90 drop-shadow-[0_0_24px_rgb(200_160_255/0.8)]" />
          <p className="display mt-8 text-[clamp(44px,4.6vw,72px)]">
            Research that
            <br />
            <span className="text-[#b9a3e6]/75">answers first</span>
          </p>
          <p className="mt-6 max-w-sm text-[14.5px] leading-relaxed text-white/70">
            Every answer is built only from the sources you upload — and every claim points back to a file and a page.
          </p>
        </div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase">Sources · Evidence · Gaps · Brief</p>
      </aside>
      <section className="flex flex-col px-4 py-6 sm:px-10">
        <div className="lg:hidden">
          <BrandMark />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="m-auto w-full max-w-[400px] py-10"
        >
          <h1 className="display text-[40px]">{title}</h1>
          <p className="mt-3 text-sm text-white/55">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </motion.div>
      </section>
    </main>
  );
}
