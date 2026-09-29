// Mirrors the backend upload rules, so bad files are caught before upload.
export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const FILES_PER_REQUEST = 5;

/** Document states that will still change; the Sources page polls while any exist. */
export const PENDING_STATUSES = ['uploading', 'processing', 'analyzing'];

export function extensionOf(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

/** Splits files into those we can upload and those we can't, with reasons. */
export function checkFiles(files) {
  const accepted = [];
  const rejected = [];
  for (const file of files) {
    if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) {
      rejected.push({ name: file.name, reason: 'Only PDF, DOCX and TXT files are supported' });
    } else if (file.size === 0) {
      rejected.push({ name: file.name, reason: 'This file is empty' });
    } else if (file.size > MAX_FILE_SIZE) {
      rejected.push({ name: file.name, reason: 'Files must be 10 MB or smaller' });
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}

export function inBatches(items, size = FILES_PER_REQUEST) {
  const batches = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
