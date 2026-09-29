import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { storage } from '../utils/storage';
import { renderAt, setupFakeServer } from './fakeServer';

const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' };
const now = new Date().toISOString();

function makeProject(overrides = {}) {
  return {
    id: 'p1',
    title: 'Impact of Generative AI on Software Developer Productivity',
    researchQuestion: 'How does generative AI affect developer productivity?',
    description: 'Demo project',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    stats: { sourceCount: 3, insightCount: 5, gapCount: 2 },
    ...overrides,
  };
}

const server = setupFakeServer();

beforeEach(() => {
  storage.setToken('valid-token');
  server.on('GET /auth/me', () => [200, { user: ada }]);
});

describe('dashboard', () => {
  it('shows project cards and totals across projects', async () => {
    server.on('GET /projects', () => [
      200,
      {
        projects: [
          makeProject(),
          makeProject({
            id: 'p2',
            title: 'Remote work study',
            status: 'draft',
            stats: { sourceCount: 1, insightCount: 0, gapCount: 1 },
          }),
        ],
      },
    ]);
    renderAt('/dashboard');

    const card = (await screen.findByRole('heading', { name: /generative ai/i })).closest('a');
    expect(card).toHaveAttribute('href', '/research/p1');
    expect(within(card).getByText('3 sources')).toBeInTheDocument();
    expect(within(card).getByText('5 insights')).toBeInTheDocument();
    expect(screen.getByText('Remote work study')).toBeInTheDocument();

    const tile = (label) => screen.getByText(label, { selector: 'dt' }).closest('div');
    expect(within(tile('Research projects')).getByText('2')).toBeInTheDocument();
    expect(within(tile('Sources')).getByText('4')).toBeInTheDocument();
    expect(within(tile('Research gaps')).getByText('3')).toBeInTheDocument();
  });

  it('shows an empty state with a way to start', async () => {
    server.on('GET /projects', () => [200, { projects: [] }]);
    renderAt('/dashboard');

    expect(await screen.findByText('No research projects yet')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /new research/i });
    expect(links[0]).toHaveAttribute('href', '/research/new');
  });

  it('shows an error with a working retry', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    server.on('GET /projects', () => {
      attempts += 1;
      return attempts === 1
        ? [500, { error: { message: 'Database unavailable' } }]
        : [200, { projects: [makeProject()] }];
    });
    renderAt('/dashboard');

    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('heading', { name: /generative ai/i })).toBeInTheDocument();
  });
});

describe('create research project', () => {
  it('validates required fields before calling the API', async () => {
    const user = userEvent.setup();
    renderAt('/research/new');

    await user.click(await screen.findByRole('button', { name: /create project/i }));
    expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();
    expect(screen.getByText('Research question must be at least 10 characters')).toBeInTheDocument();
    expect(server.callsTo('POST /projects')).toHaveLength(0);
  });

  it('fills the example, creates the project and opens its workspace', async () => {
    const user = userEvent.setup();
    const created = makeProject({ id: 'new1', status: 'draft', stats: { sourceCount: 0, insightCount: 0, gapCount: 0 } });
    server.on('POST /projects', () => [201, { project: created }]);
    server.on('GET /projects/new1', () => [200, { project: created }]);
    renderAt('/research/new');

    await user.click(await screen.findByRole('button', { name: /use example/i }));
    expect(screen.getByLabelText('Project title')).toHaveValue(
      'Impact of Generative AI on Software Developer Productivity',
    );
    await user.click(screen.getByRole('button', { name: /create project/i }));

    expect(await screen.findByText('Research question')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(created.title);
    const body = server.callsTo('POST /projects')[0].body;
    expect(body.researchQuestion).toMatch(/developer productivity, code quality/);
  });

  it('shows server-side field errors inline', async () => {
    const user = userEvent.setup();
    server.on('POST /projects', () => [
      400,
      {
        error: {
          message: 'Validation failed',
          details: [{ field: 'title', message: 'Title must be at most 150 characters' }],
        },
      },
    ]);
    renderAt('/research/new');

    await user.type(await screen.findByLabelText('Project title'), 'Valid title');
    await user.type(screen.getByLabelText('Research question'), 'Is this a valid question?');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    expect(await screen.findByText('Title must be at most 150 characters')).toBeInTheDocument();
    expect(screen.getByLabelText('Project title')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('research workspace', () => {
  it('shows the project, its question and every workspace section', async () => {
    server.on('GET /projects/p1', () => [200, { project: makeProject() }]);
    renderAt('/research/p1');

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/generative ai/i);
    expect(screen.getByText('How does generative AI affect developer productivity?')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Research workspace' });
    for (const label of [
      'Overview',
      'Sources',
      'AI Assistant',
      'Evidence Matrix',
      'Insights',
      'Research Gaps',
      'Research Brief',
    ]) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('points empty sections back to sources when the project has none', async () => {
    const empty = makeProject({ status: 'draft', stats: { sourceCount: 0, insightCount: 0, gapCount: 0 } });
    server.on('GET /projects/p1', () => [200, { project: empty }]);
    renderAt('/research/p1/evidence');

    expect(await screen.findByText('No evidence matrix yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to sources/i })).toHaveAttribute(
      'href',
      '/research/p1/sources',
    );
    expect(screen.getByRole('button', { name: /run analysis/i })).toBeDisabled();
  });

  it("shows not-found for a project that doesn't exist or isn't yours", async () => {
    server.on('GET /projects/missing', () => [404, { error: { message: 'Research project not found' } }]);
    renderAt('/research/missing');

    expect(await screen.findByText('Research project not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('deletes the project after confirmation and returns to the dashboard', async () => {
    const user = userEvent.setup();
    let deleted = false;
    server.on('GET /projects/p1', () => [200, { project: makeProject() }]);
    server.on('DELETE /projects/p1', () => {
      deleted = true;
      return [204, ''];
    });
    server.on('GET /projects', () => [200, { projects: deleted ? [] : [makeProject()] }]);
    renderAt('/research/p1');

    await user.click(await screen.findByRole('button', { name: /^delete project$/i }));
    const dialog = screen.getByRole('dialog', { name: /delete this research project/i });
    expect(deleted).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: /delete project/i }));

    expect(await screen.findByText('No research projects yet')).toBeInTheDocument();
    expect(deleted).toBe(true);
  });

  it('cancelling the confirmation keeps the project', async () => {
    const user = userEvent.setup();
    server.on('GET /projects/p1', () => [200, { project: makeProject() }]);
    renderAt('/research/p1');

    await user.click(await screen.findByRole('button', { name: /^delete project$/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(server.callsTo('DELETE /projects/p1')).toHaveLength(0);
  });
});
