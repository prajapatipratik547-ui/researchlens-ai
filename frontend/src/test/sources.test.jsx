import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { storage } from '../utils/storage';
import { renderAt, setupFakeServer } from './fakeServer';

const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' };
const now = new Date().toISOString();

const project = {
  id: 'p1',
  title: 'AI and productivity',
  researchQuestion: 'How does AI affect productivity?',
  description: '',
  status: 'active',
  createdAt: now,
  updatedAt: now,
  stats: { sourceCount: 1, insightCount: 0, gapCount: 0 },
};

function makeDoc(overrides = {}) {
  return {
    id: 'd1',
    projectId: 'p1',
    filename: 'field-study.pdf',
    fileType: 'pdf',
    fileSize: 482113,
    processingStatus: 'ready',
    processingError: '',
    summary: '',
    metadata: { pageCount: 14, wordCount: 6120, chunkCount: 11 },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const server = setupFakeServer();

beforeEach(() => {
  storage.setToken('valid-token');
  server.on('GET /auth/me', () => [200, { user: ada }]);
  server.on('GET /projects/p1', () => [200, { project }]);
});

const file = (name, size = 20, type = 'application/octet-stream') =>
  new File([new Uint8Array(size)], name, { type });

describe('sources page', () => {
  it('lists sources with their status, details and failure reasons', async () => {
    server.on('GET /projects/p1/documents', () => [
      200,
      {
        documents: [
          makeDoc(),
          makeDoc({
            id: 'd2',
            filename: 'scan.pdf',
            processingStatus: 'failed',
            processingError: 'No readable text found. Scanned PDFs (images of pages) are not supported.',
            metadata: { pageCount: null, wordCount: null, chunkCount: null },
          }),
        ],
      },
    ]);
    renderAt('/research/p1/sources');

    const ready = (await screen.findByText('field-study.pdf')).closest('li');
    expect(within(ready).getByText('Ready')).toBeInTheDocument();
    expect(within(ready).getByText(/14 pages · 6,120 words/)).toBeInTheDocument();

    const failed = screen.getByText('scan.pdf').closest('li');
    expect(within(failed).getByText('Failed')).toBeInTheDocument();
    expect(within(failed).getByText(/Scanned PDFs/)).toBeInTheDocument();
    expect(within(failed).getByRole('button', { name: /view scan.pdf/i })).toBeDisabled();
  });

  it('shows an empty state before any upload', async () => {
    server.on('GET /projects/p1/documents', () => [200, { documents: [] }]);
    renderAt('/research/p1/sources');
    expect(await screen.findByText('No sources yet')).toBeInTheDocument();
  });

  it('rejects unsupported and oversized files before uploading, and uploads the rest', async () => {
    const user = userEvent.setup({ applyAccept: false });
    let uploaded = false;
    server.on('GET /projects/p1/documents', () => [
      200,
      { documents: uploaded ? [makeDoc({ id: 'd9', filename: 'notes.txt', fileType: 'txt' })] : [] },
    ]);
    server.on('POST /projects/p1/documents', () => {
      uploaded = true;
      return [202, { documents: [makeDoc({ id: 'd9', filename: 'notes.txt', processingStatus: 'processing' })] }];
    });
    renderAt('/research/p1/sources');

    await user.upload(await screen.findByLabelText('Choose files to upload'), [
      file('notes.txt'),
      file('virus.exe'),
      file('huge.pdf', 10 * 1024 * 1024 + 1),
    ]);

    const alert = (await screen.findByText('2 files weren’t uploaded')).closest('[role="alert"]');
    expect(alert).toHaveTextContent('virus.exe: Only PDF, DOCX and TXT files are supported');
    expect(alert).toHaveTextContent('huge.pdf: Files must be 10 MB or smaller');

    expect(await screen.findByText('notes.txt')).toBeInTheDocument();
    const sent = server.callsTo('POST /projects/p1/documents')[0].body;
    expect(sent.getAll('files').map((f) => f.name)).toEqual(['notes.txt']);
  });

  it('splits more than five files into several uploads', async () => {
    const user = userEvent.setup();
    server.on('GET /projects/p1/documents', () => [200, { documents: [] }]);
    server.on('POST /projects/p1/documents', () => [202, { documents: [] }]);
    renderAt('/research/p1/sources');

    const seven = Array.from({ length: 7 }, (_, i) => file(`s${i}.txt`, 10, 'text/plain'));
    await user.upload(await screen.findByLabelText('Choose files to upload'), seven);

    await waitFor(() => expect(server.callsTo('POST /projects/p1/documents')).toHaveLength(2));
    const sizes = server.callsTo('POST /projects/p1/documents').map((c) => c.body.getAll('files').length);
    expect(sizes).toEqual([5, 2]);
  });

  it('shows server-side file errors next to the file name', async () => {
    const user = userEvent.setup();
    server.on('GET /projects/p1/documents', () => [200, { documents: [] }]);
    server.on('POST /projects/p1/documents', () => [
      400,
      {
        error: {
          message: 'fake.pdf: This file is not a valid PDF',
          code: 'FILE_TYPE_NOT_ALLOWED',
          details: [{ field: 'fake.pdf', message: 'This file is not a valid PDF' }],
        },
      },
    ]);
    renderAt('/research/p1/sources');

    await user.upload(await screen.findByLabelText('Choose files to upload'), [file('fake.pdf')]);
    const box = (await screen.findByText('This file wasn’t uploaded')).closest('[role="alert"]');
    expect(box).toHaveTextContent('fake.pdf: This file is not a valid PDF');
  });

  it('polls while files are processing and refreshes the project when they finish', async () => {
    let polls = 0;
    server.on('GET /projects/p1/documents', () => {
      polls += 1;
      return [200, { documents: [makeDoc({ processingStatus: polls < 2 ? 'processing' : 'ready' })] }];
    });
    renderAt('/research/p1/sources');

    expect(await screen.findByText('Processing')).toBeInTheDocument();
    expect(await screen.findByText('Ready', {}, { timeout: 5000 })).toBeInTheDocument();
    await waitFor(() => expect(server.callsTo('GET /projects/p1').length).toBeGreaterThanOrEqual(2));
  }, 10_000);

  it('opens a source and shows its extracted text', async () => {
    const user = userEvent.setup();
    server.on('GET /projects/p1/documents', () => [200, { documents: [makeDoc()] }]);
    server.on('GET /documents/d1', () => [
      200,
      { document: { ...makeDoc(), extractedText: '--- Page 1 ---\nDevelopers finished tasks faster.' } },
    ]);
    renderAt('/research/p1/sources');

    await user.click(await screen.findByRole('button', { name: /view field-study.pdf/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Source text' });
    expect(await within(dialog).findByText(/Developers finished tasks faster/)).toBeInTheDocument();
  });

  it('removes a source after confirmation', async () => {
    const user = userEvent.setup();
    let removed = false;
    server.on('GET /projects/p1/documents', () => [200, { documents: removed ? [] : [makeDoc()] }]);
    server.on('DELETE /documents/d1', () => {
      removed = true;
      return [204, ''];
    });
    renderAt('/research/p1/sources');

    await user.click(await screen.findByRole('button', { name: /delete field-study.pdf/i }));
    const dialog = screen.getByRole('dialog', { name: /remove this source/i });
    await user.click(within(dialog).getByRole('button', { name: /remove source/i }));

    expect(await screen.findByText('No sources yet')).toBeInTheDocument();
    expect(removed).toBe(true);
  });
});
