import { SmoothScroll } from '../components/motion/SmoothScroll';
import { Navbar } from '../components/landing/Navbar';
import { SurfacesScene } from '../components/landing/SurfacesScene';
import { BeyondScene } from '../components/landing/BeyondScene';
import { WorkScene } from '../components/landing/WorkScene';
import { LibraryScene } from '../components/landing/LibraryScene';
import { CtaFooter } from '../components/landing/CtaFooter';

export function LandingPage() {
  return (
    <SmoothScroll>
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-white px-4 py-2 text-sm text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <SurfacesScene />
        <BeyondScene />
        <WorkScene />
        <LibraryScene />
        <CtaFooter />
      </main>
    </SmoothScroll>
  );
}
