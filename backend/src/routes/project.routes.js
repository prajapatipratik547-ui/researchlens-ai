import { Router } from 'express';
import {
  listProjects,
  createProject,
  getProject,
  deleteProject,
} from '../controllers/project.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createProjectSchema, projectIdParams } from '../validators/project.validator.js';

const router = Router();

router.use(requireAuth);

router.get('/', listProjects);
router.post('/', validate({ body: createProjectSchema }), createProject);
router.get('/:id', validate({ params: projectIdParams }), getProject);
router.delete('/:id', validate({ params: projectIdParams }), deleteProject);

export default router;
