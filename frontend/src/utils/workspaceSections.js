import {
  FileText,
  LayoutGrid,
  Lightbulb,
  MessageSquareText,
  ScrollText,
  SearchX,
  Table2,
} from 'lucide-react';

// Sections of a research workspace, in sidebar order. `needs` says what must
// exist before the section has content: 'sources' or a completed 'analysis'.
export const workspaceSections = [
  { path: '', label: 'Overview', icon: LayoutGrid },
  {
    path: 'sources',
    label: 'Sources',
    icon: FileText,
    summary: 'Upload PDFs, Word documents and text files to build your research corpus.',
  },
  {
    path: 'assistant',
    label: 'AI Assistant',
    icon: MessageSquareText,
    needs: 'sources',
    summary: 'Ask questions answered only from your sources, with a citation for every claim.',
  },
  {
    path: 'evidence',
    label: 'Evidence Matrix',
    icon: Table2,
    needs: 'analysis',
    summary: 'See which sources support, contradict or say nothing about each claim.',
  },
  {
    path: 'insights',
    label: 'Insights',
    icon: Lightbulb,
    needs: 'analysis',
    summary: 'Key findings, themes and potential contradictions across your sources.',
  },
  {
    path: 'gaps',
    label: 'Research Gaps',
    icon: SearchX,
    needs: 'analysis',
    summary: 'Questions your corpus does not answer yet, and how confident we are.',
  },
  {
    path: 'brief',
    label: 'Research Brief',
    icon: ScrollText,
    needs: 'analysis',
    summary: 'A structured, exportable brief of findings, evidence, conflicts and gaps.',
  },
];
