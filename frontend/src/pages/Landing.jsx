import { Link } from 'react-router';
import {
  ArrowRight,
  FileStack,
  GitCompareArrows,
  Quote,
  SearchX,
  ScrollText,
  Sparkles,
  TableProperties,
} from 'lucide-react';
import Navbar from '../components/Navbar';

const capabilities = [
  {
    icon: FileStack,
    title: 'Multi-source corpus',
    body: 'Upload PDFs, Word documents and text files into one research workspace.',
  },
  {
    icon: Quote,
    title: 'Evidence-grounded answers',
    body: 'Every answer cites the source and page it came from, or says the evidence is insufficient.',
  },
  {
    icon: TableProperties,
    title: 'Evidence matrix',
    body: 'See at a glance which sources support, contradict or stay silent on each claim.',
  },
  {
    icon: GitCompareArrows,
    title: 'Contradiction detection',
    body: 'Surface potential conflicts between sources, with possible explanations.',
  },
  {
    icon: SearchX,
    title: 'Research gaps',
    body: 'Find the questions your corpus does not answer yet.',
  },
  {
    icon: ScrollText,
    title: 'Research brief',
    body: 'Export a structured, decision-ready brief in Markdown.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-40 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-brand-100),transparent)]"
          />
          <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-24 text-center sm:px-6 sm:pt-28">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-medium text-brand-800">
              <Sparkles className="size-3.5" aria-hidden="true" />
              AI for research & knowledge discovery
            </p>
            <h1 className="mt-6 font-display text-4xl leading-[1.1] font-semibold tracking-tight text-slate-900 sm:text-6xl">
              From scattered sources
              <br className="hidden sm:block" /> to{' '}
              <span className="text-brand-700">evidence-backed insights.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
              Research faster. Connect evidence. Discover contradictions. Uncover research gaps.
              Make evidence-based decisions.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register" className="btn-primary px-5 py-3 text-base">
                Start research
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link to="/login" className="btn-secondary px-5 py-3 text-base">
                Explore demo
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
              Built for evidence, not just answers
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              ResearchLens reads across your whole corpus and shows its work, so you can trust what
              it tells you and see where the evidence runs out.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map(({ icon: Icon, title, body }) => (
                <div key={title} className="card p-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-500">
        ResearchLens AI · Built for the AI for Research & Knowledge Discovery hackathon
      </footer>
    </div>
  );
}
