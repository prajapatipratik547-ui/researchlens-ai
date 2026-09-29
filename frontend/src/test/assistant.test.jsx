import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { storage } from '../utils/storage';
import { locateQuote } from '../utils/quotes';
import { renderAt, setupFakeServer } from './fakeServer';

const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' };
const now = new Date().toISOString();

const makeProject = (sourceCount = 2) => ({
  id: 'p1',
  title: 'AI and productivity',
  researchQuestion: 'How does AI affect productivity?',
  description: '',
  status: 'active',
  createdAt: now,
  updatedAt: now,
  stats: { sourceCount, insightCount: 0, gapCount: 0 },
});

const answered = (id, question) => ({
  id,
  projectId: 'p1',
  question,
  createdAt: now,
  response: {
    answer: 'Evidence suggests routine tasks were faster.\n\nGains were smaller on complex work.',
    keyFindings: ['Routine work sped up.'],
    evidence: [
      { claim: 'Routine tasks finished faster', sourceId: 'd1', sourceName: 'field-study.pdf', page: 4, quote: 'finished routine tasks faster', support: 'supporting' },
      { claim: 'No clear change in defects', sourceId: 'd2', sourceName: 'review.docx', page: null, quote: '', support: 'contradicting' },
    ],
    confidence: 78,
    limitations: ['The study ran for four weeks.'],
    insufficientEvidence: false,
  },
  sources: [
    { documentId: 'd1', filename: 'field-study.pdf', pageNumber: 4 },
    { documentId: 'd2', filename: 'review.docx', pageNumber: null },
  ],
});

const insufficient = {
  ...answered('c9', 'What about salaries?'),
  response: {
    answer: 'Insufficient evidence in the current research corpus.',
    keyFindings: [],
    evidence: [],
    confidence: 0,
    limitations: ['No source discusses salaries.'],
    insufficientEvidence: true,
  },
  sources: [],
};

const server = setupFakeServer();

beforeEach(() => {
  storage.setToken('valid-token');
  server.on('GET /auth/me', () => [200, { user: ada }]);
  server.on('GET /projects/p1', () => [200, { project: makeProject() }]);
  server.on('GET /ai/status', () => [200, { ai: { configured: true, provider: 'gemini', model: 'gemini-2.5-flash' } }]);
});

describe('locateQuote', () => {
  it('finds a quote across line breaks and punctuation differences', () => {
    const text = 'Intro. Developers finished\nroutine tasks — faster. End.';
    const [start, end] = locateQuote(text, 'finished routine tasks faster');
    expect(text.slice(start, end)).toBe('finished\nroutine tasks — faster');
    expect(locateQuote(text, 'not in the text')).toBeNull();
  });
});

describe('AI assistant', () => {
  it('shows each answer with evidence, sources, confidence and limitations', async () => {
    server.on('GET /research/p1/conversations', () => [200, { conversations: [answered('c1', 'Did work get faster?')] }]);
    renderAt('/research/p1/assistant');

    expect(await screen.findByText('Did work get faster?')).toBeInTheDocument();
    const card = screen.getByText(/routine tasks were faster/).closest('article');
    expect(within(card).getByText('Gains were smaller on complex work.')).toBeInTheDocument();
    expect(within(card).getByText('Evidence · 2')).toBeInTheDocument();
    expect(within(card).getByText('Supports')).toBeInTheDocument();
    expect(within(card).getByText('Contradicts')).toBeInTheDocument();
    expect(within(card).getAllByText('· p. 4').length).toBeGreaterThan(0);
    expect(within(card).getByText('78%')).toBeInTheDocument();
    expect(within(card).getByText(/High confidence/)).toBeInTheDocument();
    expect(within(card).getByText('The study ran for four weeks.')).toBeInTheDocument();
  });

  it('shows insufficient evidence as its own neutral state', async () => {
    server.on('GET /research/p1/conversations', () => [200, { conversations: [insufficient] }]);
    renderAt('/research/p1/assistant');

    expect(await screen.findByText('Insufficient evidence in the current research corpus.')).toBeInTheDocument();
    expect(screen.getByText('No source discusses salaries.')).toBeInTheDocument();
    expect(screen.queryByText(/confidence ·/)).not.toBeInTheDocument();
  });

  it('asks a question, shows progress, then the answer', async () => {
    const user = userEvent.setup();
    let release;
    server.on('GET /research/p1/conversations', () => [200, { conversations: [] }]);
    server.on('POST /research/p1/ask', () => new Promise((resolve) => {
      release = () => resolve([200, { conversation: answered('c2', 'What changed?') }]);
    }));
    renderAt('/research/p1/assistant');

    const input = await screen.findByLabelText('Ask a question about your sources');
    await user.type(input, 'What changed?{Enter}');

    expect(await screen.findByText(/Reading your sources/)).toBeInTheDocument();
    expect(server.callsTo('POST /research/p1/ask')[0].body).toEqual({ question: 'What changed?' });
    expect(input).toHaveValue('');

    release();
    expect(await screen.findByText('Evidence · 2')).toBeInTheDocument();
    expect(screen.queryByText(/Reading your sources/)).not.toBeInTheDocument();
  });

  it('offers suggested questions when the conversation is empty', async () => {
    const user = userEvent.setup();
    server.on('GET /research/p1/conversations', () => [200, { conversations: [] }]);
    server.on('POST /research/p1/ask', () => [200, { conversation: answered('c3', 'Where do the sources disagree?') }]);
    renderAt('/research/p1/assistant');

    await user.click(await screen.findByRole('button', { name: 'Where do the sources disagree?' }));
    expect(server.callsTo('POST /research/p1/ask')[0].body.question).toBe('Where do the sources disagree?');
  });

  it('keeps the question and offers a retry when the AI fails', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    server.on('GET /research/p1/conversations', () => [200, { conversations: [] }]);
    server.on('POST /research/p1/ask', () => {
      attempts += 1;
      return attempts === 1
        ? [429, { error: { message: 'The AI service is busy right now. Please try again in a minute.', code: 'AI_RATE_LIMITED' } }]
        : [200, { conversation: answered('c4', 'Any risks?') }];
    });
    renderAt('/research/p1/assistant');

    await user.type(await screen.findByLabelText('Ask a question about your sources'), 'Any risks?{Enter}');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The AI service is busy right now');

    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Evidence · 2')).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('asks the user to add sources first when there are none', async () => {
    server.on('GET /projects/p1', () => [200, { project: makeProject(0) }]);
    server.on('GET /research/p1/conversations', () => [200, { conversations: [] }]);
    renderAt('/research/p1/assistant');

    expect(await screen.findByText('Add sources to start asking questions')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ask a question about your sources')).not.toBeInTheDocument();
  });

  it('explains when AI is not configured and disables asking', async () => {
    server.on('GET /ai/status', () => [200, { ai: { configured: false, provider: 'gemini', model: null } }]);
    server.on('GET /research/p1/conversations', () => [200, { conversations: [] }]);
    renderAt('/research/p1/assistant');

    expect(await screen.findByText(/AI service is not configured/)).toBeInTheDocument();
    expect(screen.getByLabelText('Ask a question about your sources')).toBeDisabled();
  });

  it('opens the cited source with the quoted passage highlighted', async () => {
    const user = userEvent.setup();
    server.on('GET /research/p1/conversations', () => [200, { conversations: [answered('c1', 'Did work get faster?')] }]);
    server.on('GET /documents/d1', () => [
      200,
      {
        document: {
          id: 'd1',
          filename: 'field-study.pdf',
          fileType: 'pdf',
          fileSize: 1000,
          summary: '',
          metadata: { pageCount: 5, chunkCount: 2 },
          extractedText: '--- Page 4 ---\nDevelopers finished\nroutine tasks faster than before.',
        },
      },
    ]);
    renderAt('/research/p1/assistant');

    const evidenceRow = (await screen.findByText('Routine tasks finished faster')).closest('li');
    await user.click(within(evidenceRow).getByRole('button', { name: /field-study.pdf/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Source text' });
    expect(await within(dialog).findByText(/cited passage is highlighted/)).toBeInTheDocument();
    expect(dialog.querySelector('mark')).toHaveTextContent('finished routine tasks faster');
  });
});
