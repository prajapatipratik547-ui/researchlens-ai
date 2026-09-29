import { Router } from 'express';
import {
  uploadDocuments,
  listDocuments,
  getDocument,
  deleteDocument,
} from '../controllers/document.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireOwnedProject } from '../middleware/project.middleware.js';
import { uploadFiles } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { projectIdParams } from '../validators/project.validator.js';
import { documentIdParams } from '../validators/document.validator.js';

// Mounted at /api. Auth is applied per route (not router-wide) so unknown
// /api paths still fall through to the 404 handler.
const router = Router();

const ownProject = [requireAuth, validate({ params: projectIdParams }), requireOwnedProject('id')];
const ownDocument = [requireAuth, validate({ params: documentIdParams })];

// Ownership is checked before multer reads the body.
router.post('/projects/:id/documents', ...ownProject, uploadFiles, uploadDocuments);
router.get('/projects/:id/documents', ...ownProject, listDocuments);
router.get('/documents/:id', ...ownDocument, getDocument);
router.delete('/documents/:id', ...ownDocument, deleteDocument);

export default router;
