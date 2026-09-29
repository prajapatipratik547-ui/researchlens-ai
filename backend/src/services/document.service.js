import path from 'node:path';
import { Document } from '../models/Document.js';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { chunkPages } from './chunking.service.js';
import { detectFileType, extractDocument, ExtractionError } from './extraction.service.js';
import { syncProjectAfterSourceChange } from './project.service.js';
import { aiStatus, generateJSON } from './llm.service.js';
import { buildSummaryPrompt } from './prompts/summary.prompt.js';

// ---------------------------------------------------------------------------
// Background processing queue
//
// Uploads return 202 immediately; files are then processed one at a time in
// this process. One at a time keeps memory and CPU predictable on a small
// Render instance. If the process restarts mid-way, recoverInterruptedDocuments
// marks unfinished files as failed so they never look stuck.
// ---------------------------------------------------------------------------
let queue = Promise.resolve();

function enqueue(task) {
  queue = queue.then(task).catch((err) => logger.error('Document job crashed', { error: err.message }));
  return queue;
}

/** Resolves once every queued document has been processed (used by tests). */
export async function whenIdle() {
  let current;
  do {
    current = queue;
    await current;
  } while (current !== queue);
}

/** Marks documents left mid-processing by a previous run as failed. */
export async function recoverInterruptedDocuments() {
  const { modifiedCount } = await Document.updateMany(
    { processingStatus: { $in: ['uploading', 'processing', 'analyzing'] } },
    {
      $set: {
        processingStatus: 'failed',
        processingError: 'Processing was interrupted. Delete this file and upload it again.',
      },
    },
  );
  if (modifiedCount) logger.warn('Marked interrupted documents as failed', { count: modifiedCount });
}

// ---------------------------------------------------------------------------

/** Keeps a display-safe base name: no paths, control characters or huge names. */
export function cleanFilename(name) {
  const base = path.basename(String(name ?? '').replace(/\\/g, '/'));
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned) return 'untitled';
  if (cleaned.length <= 255) return cleaned;
  const ext = path.extname(cleaned).slice(0, 10);
  return cleaned.slice(0, 255 - ext.length) + ext;
}

/**
 * A short AI summary for the source card. Optional: if the AI is not
 * configured or fails, the document is still usable, just without a summary.
 */
async function summarize(filename, text) {
  if (!aiStatus().configured) return '';
  try {
    const { summary } = await generateJSON(buildSummaryPrompt({ filename, text }));
    return summary;
  } catch (err) {
    logger.warn('Summary skipped', { filename, error: err.message });
    return '';
  }
}

async function processDocument(documentId, buffer, fileType) {
  // The document or its whole project may be deleted while it waits in the
  // queue; every write below is conditional on it still existing.
  if (!(await Document.exists({ _id: documentId }))) return;

  try {
    const extracted = await extractDocument(buffer, fileType);
    const chunks = chunkPages(extracted.pages);
    const doc = await Document.findById(documentId).select('projectId filename');
    if (!doc) return;

    await DocumentChunk.insertMany(
      chunks.map((chunk) => ({ ...chunk, documentId, projectId: doc.projectId })),
      { ordered: false },
    );

    // Text is saved now so "View" works while the AI writes the summary.
    const analyzing = await Document.findOneAndUpdate(
      { _id: documentId },
      {
        $set: {
          extractedText: extracted.text,
          metadata: {
            pageCount: extracted.pageCount,
            wordCount: extracted.wordCount,
            chunkCount: chunks.length,
          },
          processingStatus: 'analyzing',
        },
      },
    );
    if (!analyzing) {
      await DocumentChunk.deleteMany({ documentId });
      return;
    }

    const summary = await summarize(doc.filename, extracted.text);

    const updated = await Document.findOneAndUpdate(
      { _id: documentId },
      { $set: { summary, processingStatus: 'ready', processingError: '' } },
      { returnDocument: 'after' },
    );

    if (!updated) {
      // Deleted while we were chunking: remove the orphaned chunks.
      await DocumentChunk.deleteMany({ documentId });
      return;
    }
    await syncProjectAfterSourceChange(updated.projectId);
  } catch (err) {
    const userMessage =
      err instanceof ExtractionError
        ? err.message
        : 'Something went wrong while processing this file. Try uploading it again.';
    if (!(err instanceof ExtractionError)) {
      logger.error('Document processing failed', { documentId: String(documentId), error: err.message });
    }
    await DocumentChunk.deleteMany({ documentId });
    await Document.updateOne(
      { _id: documentId },
      { $set: { processingStatus: 'failed', processingError: userMessage } },
    );
  }
}

/**
 * Validates every file first; if any is unacceptable, nothing is saved and
 * the error lists each bad file. Otherwise creates the documents in the
 * 'processing' state and queues them.
 */
export async function createDocuments(project, userId, files = []) {
  if (!files.length) {
    throw ApiError.badRequest('Choose at least one file to upload', {
      code: 'VALIDATION_ERROR',
      details: [{ field: 'files', message: 'Choose at least one file to upload' }],
    });
  }

  const checked = files.map((file) => {
    const filename = cleanFilename(file.originalname);
    return { file, filename, ...detectFileType(filename, file.buffer) };
  });

  const problems = checked.filter((c) => c.error);
  if (problems.length) {
    throw ApiError.badRequest(
      problems.length === 1
        ? `${problems[0].filename}: ${problems[0].error}`
        : `${problems.length} files could not be uploaded`,
      {
        code: 'FILE_TYPE_NOT_ALLOWED',
        details: problems.map((p) => ({ field: p.filename, message: p.error })),
      },
    );
  }

  const documents = await Document.insertMany(
    checked.map(({ file, filename, fileType }) => ({
      projectId: project._id,
      userId,
      filename,
      fileType,
      fileSize: file.size,
      processingStatus: 'processing',
    })),
  );

  documents.forEach((doc, i) => {
    enqueue(() => processDocument(doc._id, checked[i].file.buffer, checked[i].fileType));
  });

  return documents;
}

export function listDocuments(projectId) {
  return Document.find({ projectId }).sort({ createdAt: -1, _id: -1 });
}

/** A document the user owns, or 404. */
export async function getOwnedDocument(documentId, userId, { withText = false } = {}) {
  const query = Document.findOne({ _id: documentId, userId });
  if (withText) query.select('+extractedText');
  const doc = await query;
  if (!doc) throw ApiError.notFound('Document not found');
  return doc;
}

export async function deleteDocument(documentId, userId) {
  const doc = await getOwnedDocument(documentId, userId);
  const wasReady = doc.processingStatus === 'ready';

  await DocumentChunk.deleteMany({ documentId: doc._id });
  await doc.deleteOne();
  // Removing a ready source changes what an analysis covered.
  if (wasReady) await syncProjectAfterSourceChange(doc.projectId);
}
