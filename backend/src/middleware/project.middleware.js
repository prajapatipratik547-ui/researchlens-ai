import { getOwnedProject } from '../services/project.service.js';

/**
 * Loads the project named by a route param onto req.project, or 404s if it
 * is missing or belongs to someone else. Runs before any upload is read, so
 * a request for another user's project never buffers its files.
 */
export function requireOwnedProject(param = 'id') {
  return async (req, _res, next) => {
    req.project = await getOwnedProject(req.validated.params[param], req.userId);
    next();
  };
}
