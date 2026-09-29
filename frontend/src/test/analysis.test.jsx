import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { storage } from '../utils/storage';
import { renderAt, setupFakeServer } from './fakeServer';

const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' };
const now = new Date().toISOString();

const makeProject = (overrides = {}) => ({
  id: 'p1',
  title: 'AI and productivity',
  researchQuestion: 'How does AI affect productivity?',
  description: '',
  status: 'analyzed',
  createdAt: now,
  updatedAt: now,
  analyzedAt: now,
  analysisInProgress: false,
  stats: { sourceCount: 2, insightCount: 3, gapCount: 1 },
  ...overrides,
});

const ev = (claim, documentId, filename, pageNumber, quote, support = 'supporting') => ({
  claim,
  documentId,
  filename,
  pageNumber,
  quote,
  support,
});

const insights = [
  {
    id: 'i1',
    projectId: 'p1',
    type: 'key_finding',
    title: 'Routine tasks got faster',
    description: 'A field study reports faster routine work.',
    confidence: 75,
    evidence: [ev('Routine tasks finished faster', 'd1', 'field-study.pdf', 4, 'finished routine tasks faster')],
    details: null,
    sourceReferences: [],
    createdAt: now,
  },
  {
    id: 'i2',
    projectId: 'p1',
    type: 'theme',
    title: 'Task complexity',
    description: 'Gains depend on the task.',
    confidence: 50,
    evidence: [ev('Complex tasks gained less', 'd1', 'field-study.pdf', 5, '')],
    details: null,
    sourceReferences: [],
    createdAt: now,
  },
  {
    id: 'i3',
    projectId: 'p1',
    type: 'contradiction',
    title: 'Whether AI speeds up work',
    description: 'Measured and reported speed differ.',
    confidence: 62,
    evidence: [
      ev('Developers were faster', 'd1', 'field-study.pdf', 4, 'finished routine tasks faster'),
      ev('No change in speed', 'd2', 'survey.txt', null, 'reported no change', 'contradicting'),
    ],
    details: {
      claimA: { text: 'Developers were faster', documentId: 'd1', filename: 'field-study.pdf', pageNumber: 4 },
      claimB: { text: 'Respondents saw no change', documentId: 'd2', filename: 'survey.txt', pageNumber: null },
      possibleExplanation: 'Measured versus self-reported speed.',
    },
    sourceReferences: [],
    createdAt: now,
  },
];

const gap = {
  id: 'g1',
  projectId: 'p1',
  type: 'research_gap',
  title: 'Long-term effects',
  description: 'Matters for adoption.',
  confidence: 60,
  evidence: [],
  details: { rationale: 'Both sources ran for under a month.' },
  sourceReferences: [],
  createdAt: now,
};

const question = {
  ...gap,
  id: 'q1',
  type: 'unanswered_question',
  title: 'Does code quality change?',
  description: 'Needs defect data.',
  confidence: 40,
  details: null,
};

const matrix = {
  sources: [
    { documentId: 'd1', filename: 'field-study.pdf' },
    { documentId: 'd2', filename: 'survey.txt' },
  ],
  rows: [
    {
      id: 'row-1',
      claim: 'AI speeds up routine work',
      cells: [
        { documentId: 'd1', status: 'supporting', note: 'Tasks were faster.', quote: 'finished routine tasks faster', pageNumber: 4 },
        { documentId: 'd2', status: 'contradicting', note: 'No change reported.', quote: 'reported no change', pageNumber: null },
      ],
    },
    {
      id: 'row-2',
      claim: 'Complex work benefits less',
      cells: [
        { documentId: 'd1', status: 'unclear', note: 'Smaller gains.', quote: '', pageNumber: 5 },
        { documentId: 'd2', status: 'no_evidence', note: '', quote: '', pageNumber: null },
      ],
    },
  ],
};

const brief = {
  title: 'AI and productivity',
  markdown: [
    '# Research Brief: AI and productivity',
    '',
    '## Executive Summary',
    '',
    'Evidence suggests routine work got faster [S1, p. 4; S2].',
    '',
    '## Evidence',
    '',
    '| Claim | S1 | S2 |',
    '| --- | :---: | :---: |',
    '| AI speeds up routine work | Supports, p. 4 | Contradicts |',
    '',
    '## Sources',
    '',
    '- **S1**: field-study.pdf',
    '- **S2**: survey.txt',
  ].join('\n'),
  sources: [
    { label: 'S1', documentId: 'd1', filename: 'field-study.pdf' },
    { label: 'S2', documentId: 'd2', filename: 'survey.txt' },
  ],
  generatedAt: now,
};

const sourceDoc = {
  id: 'd1',
  filename: 'field-study.pdf',
  fileType: 'pdf',
  fileSize: 1000,
  summary: '',
  metadata: { pageCount: 5, chunkCount: 2 },
  extractedText: '--- Page 4 ---\nDevelopers finished routine tasks faster.\n\n--- Page 5 ---\nComplex tasks gained less.',
};

const server = setupFakeServer();

beforeEach(() => {
  storage.setToken('valid-token');
  server.on('GET /auth/me', () => [200, { user: ada }]);
  server.on('GET /projects/p1', () => [200, { project: makeProject() }]);
  server.on('GET /ai/status', () => [200, { ai: { configured: true, provider: 'gemini', model: 'gemini-3.5-flash-lite' } }]);
  server.on('GET /documents/d1', () => [200, { document: sourceDoc }]);
  server.on('GET /research/p1/insights', (config) => [
    200,
    {
      insights: config.params?.type === 'unanswered_question' ? [question] : [...insights, gap, question],
      analyzedAt: now,
      outdated: false,
    },
  ]);
});

describe('Run analysis', () => {
  const unanalyzed = makeProject({ status: 'active', analyzedAt: null, stats: { sourceCount: 2, insightCount: 0, gapCount: 0 } });

  it('runs from an empty section, shows progress, then loads the results', async () => {
    const user = userEvent.setup();
    let project = unanalyzed;
    let finish;
    server.on('GET /projects/p1', () => [200, { project }]);
    server.on('POST /research/p1/analyze', () => new Promise((resolve) => {
      finish = () => {
        project = makeProject();
        resolve([200, { analysis: { analyzedAt: now, sourceCount: 2, counts: { key_finding: 1, theme: 1, contradiction: 1, research_gap: 1, unanswered_question: 1 } } }]);
      };
    }));
    renderAt('/research/p1/insights');

    expect(await screen.findByText('No insights yet')).toBeInTheDocument();
    expect(server.callsTo('GET /research/p1/insights')).toHaveLength(0); // nothing to fetch yet

    const [headerButton] = screen.getAllByRole('button', { name: /run analysis/i });
    await user.click(headerButton);
    expect(await screen.findByText(/Analyzing 2 sources/)).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /analyzing/i })) expect(button).toBeDisabled();

    finish();
    expect(await screen.findByText('Routine tasks got faster')).toBeInTheDocument();
    expect(await screen.findByText(/Analysis complete: 3 insights and 1 research gap/)).toBeInTheDocument();
    expect(screen.queryByText(/Analyzing 2 sources/)).not.toBeInTheDocument();
  });

  it('shows the error and keeps the button usable when the AI fails', async () => {
    const user = userEvent.setup();
    server.on('GET /projects/p1', () => [200, { project: unanalyzed }]);
    server.on('POST /research/p1/analyze', () => [
      429,
      { error: { message: 'The AI service is busy right now. Please try again in a minute.', code: 'AI_RATE_LIMITED' } },
    ]);
    renderAt('/research/p1/evidence');

    await user.click((await screen.findAllByRole('button', { name: /run analysis/i }))[0]);
    expect(await screen.findByText('The AI service is busy right now. Please try again in a minute.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /run analysis/i })[0]).toBeEnabled());
  });

  it('shows an analysis already running and disables Run analysis', async () => {
    server.on('GET /projects/p1', () => [200, { project: { ...unanalyzed, analysisInProgress: true } }]);
    renderAt('/research/p1');

    expect(await screen.findByText(/Analyzing 2 sources/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyzing/i })).toBeDisabled();
  });

  it('is disabled when the AI is not configured', async () => {
    server.on('GET /projects/p1', () => [200, { project: unanalyzed }]);
    server.on('GET /ai/status', () => [200, { ai: { configured: false, provider: 'gemini', model: null } }]);
    renderAt('/research/p1');

    await waitFor(() => expect(screen.getByRole('button', { name: /run analysis/i })).toBeDisabled());
    expect(screen.getByRole('button', { name: /run analysis/i })).toHaveAttribute('title', expect.stringMatching(/not configured/));
  });
});

describe('Insights', () => {
  it('shows findings, themes and contradictions with confidence labels and a type filter', async () => {
    const user = userEvent.setup();
    renderAt('/research/p1/insights');

    expect(await screen.findByText('Routine tasks got faster')).toBeInTheDocument();
    expect(screen.getByText('Task complexity')).toBeInTheDocument();
    expect(screen.queryByText('Long-term effects')).not.toBeInTheDocument(); // gaps have their own page
    expect(screen.getByText('High confidence')).toBeInTheDocument();
    expect(screen.getAllByText('Medium confidence')).toHaveLength(2);

    const contradiction = screen.getByText('Whether AI speeds up work').closest('article');
    expect(within(contradiction).getByText('Potential contradiction')).toBeInTheDocument();
    expect(within(contradiction).getByText('Respondents saw no change')).toBeInTheDocument();
    expect(within(contradiction).getByText(/Possible explanation \(AI interpretation\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Contradictions 1/ }));
    expect(screen.queryByText('Routine tasks got faster')).not.toBeInTheDocument();
    expect(screen.getByText('Whether AI speeds up work')).toBeInTheDocument();
  });

  it('opens a cited source at the quoted passage', async () => {
    const user = userEvent.setup();
    renderAt('/research/p1/insights');

    const card = (await screen.findByText('Routine tasks got faster')).closest('article');
    await user.click(within(card).getByRole('button', { name: /field-study.pdf/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Source text' });
    await waitFor(() => expect(dialog.querySelector('mark')).toHaveTextContent('finished routine tasks faster'));
  });

  it('flags an outdated analysis and offers a re-run', async () => {
    const user = userEvent.setup();
    server.on('GET /research/p1/insights', () => [200, { insights, analyzedAt: now, outdated: true }]);
    server.on('POST /research/p1/analyze', () => [
      200,
      { analysis: { analyzedAt: now, sourceCount: 3, counts: { key_finding: 1, theme: 0, contradiction: 0, research_gap: 0, unanswered_question: 0 } } },
    ]);
    renderAt('/research/p1/insights');

    expect(await screen.findByText('This analysis is outdated.')).toBeInTheDocument();
    const banner = screen.getByText('This analysis is outdated.').closest('div');
    await user.click(within(banner).getByRole('button', { name: /re-run analysis/i }));
    await waitFor(() => expect(server.callsTo('POST /research/p1/analyze')).toHaveLength(1));
  });
});

describe('Evidence Matrix', () => {
  beforeEach(() => {
    server.on('GET /research/p1/evidence', () => [200, { matrix, analyzedAt: now, outdated: false }]);
  });

  it('shows each claim against each source, with coverage', async () => {
    renderAt('/research/p1/evidence');

    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Claim', 'field-study.pdf', 'survey.txt', 'Coverage']);

    const row = within(table).getByRole('row', { name: /Complex work benefits less/ });
    expect(within(row).getByText('Unclear')).toBeInTheDocument();
    expect(within(row).getByText('No evidence')).toBeInTheDocument();
    expect(within(row).getByText('1 of 2')).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /AI speeds up routine work/ })).toHaveTextContent('2 of 2');
  });

  it('opens the source at the cited passage from a cell', async () => {
    const user = userEvent.setup();
    renderAt('/research/p1/evidence');

    await user.click(await screen.findByRole('button', { name: /field-study.pdf supports “AI speeds up routine work”, page 4/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Source text' });
    await waitFor(() => expect(dialog.querySelector('mark')).toHaveTextContent('finished routine tasks faster'));
  });
});

describe('Research Gaps', () => {
  it('lists gaps with their rationale, and unanswered questions', async () => {
    server.on('GET /research/p1/gaps', () => [200, { gaps: [gap], analyzedAt: now, outdated: false }]);
    renderAt('/research/p1/gaps');

    expect(await screen.findByText('Long-term effects')).toBeInTheDocument();
    expect(screen.getByText('Both sources ran for under a month.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Unanswered questions/ })).toBeInTheDocument();
    expect(screen.getByText('Does code quality change?')).toBeInTheDocument();
  });
});

describe('Research Brief', () => {
  it('renders the brief with clickable citations', async () => {
    const user = userEvent.setup();
    server.on('GET /research/p1/brief', () => [200, { brief, outdated: false }]);
    renderAt('/research/p1/brief');

    expect(await screen.findByRole('heading', { level: 1, name: 'Research Brief: AI and productivity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Executive Summary' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('Supports, p. 4');

    await user.click(screen.getByRole('button', { name: 'S1, p. 4' }));
    const dialog = await screen.findByRole('dialog', { name: 'Source text' });
    expect(await within(dialog).findByText(/Showing page 4/)).toBeInTheDocument();
    expect(dialog.querySelector('mark')).toHaveTextContent(/^Page 4$/);
  });

  it('copies and downloads the Markdown', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const createObjectURL = vi.fn(() => 'blob:brief');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    server.on('GET /research/p1/brief', () => [200, { brief, outdated: false }]);
    renderAt('/research/p1/brief');

    await user.click(await screen.findByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(brief.markdown);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /download/i }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clicked.mock.contexts[0].download).toBe('research-brief.md');
  });

  it('shows progress while the brief is being written', async () => {
    server.on('GET /research/p1/brief', () => new Promise(() => {}));
    renderAt('/research/p1/brief');
    expect(await screen.findByText('Writing your research brief…')).toBeInTheDocument();
  });

  it('asks for an analysis before writing a brief', async () => {
    server.on('GET /projects/p1', () => [200, { project: makeProject({ status: 'active', analyzedAt: null }) }]);
    renderAt('/research/p1/brief');
    expect(await screen.findByText('No research brief yet')).toBeInTheDocument();
    expect(server.callsTo('GET /research/p1/brief')).toHaveLength(0);
  });
});
