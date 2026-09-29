/** Cards in the hero + 3D carousel, in ring order. */
export type SurfaceId = 'live' | 'sources' | 'evidence' | 'contradictions' | 'insights' | 'gaps' | 'brief';

export interface SurfaceMeta {
  id: SurfaceId;
  tag: string;
  domain?: string;
  title?: string;
  body?: string;
  background: string;
  dark: boolean;
}

export const SURFACES: SurfaceMeta[] = [
  {
    id: 'live',
    tag: 'Ask your sources',
    background:
      'radial-gradient(60% 40% at 70% 22%, rgb(235 215 255 / 0.85), rgb(168 110 240 / 0.35) 45%, transparent 70%), radial-gradient(70% 45% at 45% 78%, rgb(150 40 190 / 0.55), transparent 70%), linear-gradient(170deg, #3d0f8f 0%, #22074f 45%, #120428 100%)',
    dark: true,
  },
  {
    id: 'sources',
    tag: 'Sources',
    domain: 'PDF · DOCX · TXT',
    background:
      'radial-gradient(circle at 60% 50%, rgb(255 255 255 / 0.5), transparent 35%), conic-gradient(from 30deg at 60% 50%, #8b8b92, #f4f4f6, #9a9aa1, #e3e3e7, #6d6d73, #dadade, #85858b, #f7f7f9, #8b8b92)',
    dark: false,
  },
  {
    id: 'evidence',
    tag: 'Evidence matrix',
    domain: 'claims × sources',
    title: 'Every claim, every source, one grid',
    body: 'See at a glance which sources support, contradict or stay unclear.',
    background:
      'radial-gradient(55% 40% at 55% 30%, rgb(200 170 255 / 0.55), transparent 70%), linear-gradient(165deg, #6a22d8 0%, #3c0c93 45%, #1c0645 100%)',
    dark: true,
  },
  {
    id: 'contradictions',
    tag: 'Contradictions',
    domain: 'side by side',
    title: 'See where sources disagree',
    body: 'Both claims, both citations and a possible explanation — never hidden.',
    background:
      'radial-gradient(40% 30% at 25% 72%, rgb(182 211 74 / 0.75), transparent 70%), radial-gradient(50% 40% at 70% 25%, rgb(60 120 70 / 0.5), transparent 70%), linear-gradient(170deg, #1d2a22 0%, #0f1612 60%, #0b0f0d 100%)',
    dark: true,
  },
  {
    id: 'insights',
    tag: 'Insights',
    domain: 'themes · findings',
    title: 'Themes that surface themselves',
    body: 'Key findings, themes and open questions, each with a confidence label.',
    background:
      'radial-gradient(60% 35% at 60% 55%, rgb(120 50 200 / 0.6), transparent 70%), linear-gradient(170deg, #1a1030 0%, #150a2a 50%, #0e0a18 100%)',
    dark: true,
  },
  {
    id: 'gaps',
    tag: 'Research gaps',
    domain: 'what’s missing',
    title: 'Find what nobody has studied',
    body: 'Gaps with the rationale behind them, ready to scope your next read.',
    background:
      'repeating-linear-gradient(115deg, rgb(255 255 255 / 0.08) 0 1px, transparent 1px 7px), radial-gradient(60% 50% at 65% 45%, rgb(160 190 255 / 0.9), transparent 75%), linear-gradient(160deg, #c9cdf2 0%, #7f8fd6 50%, #3b4a9a 100%)',
    dark: true,
  },
  {
    id: 'brief',
    tag: 'Research brief',
    domain: 'research-brief.md',
    title: 'A brief you can hand in',
    body: 'Cited Markdown, every section in order. Copy it or download it.',
    background:
      'radial-gradient(45% 35% at 45% 30%, rgb(63 165 140 / 0.85), transparent 70%), linear-gradient(170deg, #173a33 0%, #0e211d 55%, #0a1311 100%)',
    dark: true,
  },
];
