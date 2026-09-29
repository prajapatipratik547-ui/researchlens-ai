import * as projects from '../services/project.service.js';

export async function listProjects(req, res) {
  res.json({ projects: await projects.listProjects(req.userId) });
}

export async function createProject(req, res) {
  const project = await projects.createProject(req.userId, req.body);
  res.status(201).json({ project });
}

export async function getProject(req, res) {
  res.json({ project: await projects.getProject(req.validated.params.id, req.userId) });
}

export async function deleteProject(req, res) {
  await projects.deleteProject(req.validated.params.id, req.userId);
  res.status(204).end();
}
