import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

export const MAX_FILES = 5;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Files are kept in memory only while they are processed: the extracted text
// and chunks go to MongoDB, and Render's disk does not survive restarts.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES, fields: 10, parts: MAX_FILES + 10 },
  // Browsers send UTF-8 filenames; multer's default (latin1) garbles "é" etc.
  defParamCharset: 'utf8',
  fileFilter(req, file, cb) {
    // Remember names in arrival order: when the size limit trips, the file
    // being streamed is the last one seen, so the error can name it.
    (req.uploadNames ??= []).push(file.originalname);
    cb(null, true);
  },
}).array('files', MAX_FILES);

function translate(err, req) {
  if (!(err instanceof multer.MulterError)) {
    return ApiError.badRequest('The upload could not be read. Please try again.', {
      code: 'VALIDATION_ERROR',
    });
  }
  switch (err.code) {
    case 'LIMIT_FILE_SIZE': {
      const name = req.uploadNames?.at(-1) ?? 'A file';
      return new ApiError(413, `${name} is larger than 10 MB`, {
        code: 'FILE_TOO_LARGE',
        details: [{ field: name, message: 'Files must be 10 MB or smaller' }],
      });
    }
    case 'LIMIT_FILE_COUNT':
      return ApiError.badRequest(`Upload up to ${MAX_FILES} files at a time`, { code: 'TOO_MANY_FILES' });
    case 'LIMIT_UNEXPECTED_FILE':
      // .array() reports going over its count as an unexpected file too.
      return err.field === 'files'
        ? ApiError.badRequest(`Upload up to ${MAX_FILES} files at a time`, { code: 'TOO_MANY_FILES' })
        : ApiError.badRequest('Send files in the "files" form field', { code: 'VALIDATION_ERROR' });
    default:
      return ApiError.badRequest('The upload could not be read. Please try again.', {
        code: 'VALIDATION_ERROR',
      });
  }
}

export function uploadFiles(req, res, next) {
  upload(req, res, (err) => next(err ? translate(err, req) : undefined));
}
