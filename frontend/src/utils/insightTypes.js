import { CircleHelp, Layers, Lightbulb, Scale, SearchX } from 'lucide-react';

// Display names, icons and colours for each insight type from the API.
export const INSIGHT_TYPES = {
  key_finding: { label: 'Key finding', plural: 'Key findings', icon: Lightbulb, className: 'bg-brand-50 text-brand-800 ring-brand-200' },
  theme: { label: 'Theme', plural: 'Themes', icon: Layers, className: 'bg-violet-50 text-violet-800 ring-violet-200' },
  contradiction: {
    label: 'Potential contradiction',
    plural: 'Contradictions',
    icon: Scale,
    className: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
  research_gap: { label: 'Research gap', plural: 'Research gaps', icon: SearchX, className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  unanswered_question: {
    label: 'Unanswered question',
    plural: 'Unanswered questions',
    icon: CircleHelp,
    className: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
};
