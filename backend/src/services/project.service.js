import { Project } from '../models/Project.js';
import { Document } from '../models/Document.js';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { Conversation } from '../models/Conversation.js';
import { Insight } from '../models/Insight.js';
import { Analysis } from '../models/Analysis.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Loads a project only if it belongs to userId. Every project-scoped route
 * (documents, research, insights) goes through this. Another user's project
 * is reported as 404, not 403, so ids of other users' projects can't be probed.
 */
export async function getOwnedProject(projectId, userId) {
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) throw ApiError.notFound('Research project not found');
  return project;
}

const emptyStats = () => ({ sourceCount: 0, insightCount: 0, gapCount: 0 });

// Counts for many projects in two aggregate queries, not two per project.
// sourceCount counts only ready sources: files still processing or failed
// can't be researched yet.
async function statsFor(projectIds) {
  const stats = new Map(projectIds.map((id) => [id.toString(), emptyStats()]));
  if (!projectIds.length) return stats;

  const [sources, insights] = await Promise.all([
    Document.aggregate([
      { $match: { projectId: { $in: projectIds }, processingStatus: 'ready' } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]),
    Insight.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      {
        $group: {
          _id: '$projectId',
          gaps: { $sum: { $cond: [{ $eq: ['$type', 'research_gap'] }, 1, 0] } },
          other: { $sum: { $cond: [{ $eq: ['$type', 'research_gap'] }, 0, 1] } },
        },
      },
    ]),
  ]);

  for (const row of sources) stats.get(row._id.toString()).sourceCount = row.count;
  for (const row of insights) {
    const entry = stats.get(row._id.toString());
    entry.insightCount = row.other;
    entry.gapCount = row.gaps;
  }
  return stats;
}

const withStats = (project, stats) => ({
  ...project.toJSON(),
  stats: stats.get(project._id.toString()) ?? emptyStats(),
});

export async function listProjects(userId) {
  const projects = await Project.find({ userId }).sort({ updatedAt: -1 });
  const stats = await statsFor(projects.map((p) => p._id));
  return projects.map((p) => withStats(p, stats));
}

export async function getProject(projectId, userId) {
  const project = await getOwnedProject(projectId, userId);
  const stats = await statsFor([project._id]);
  return withStats(project, stats);
}

export async function createProject(userId, { title, researchQuestion, description }) {
  // userId always comes from the verified token, never the request body.
  const project = await Project.create({ userId, title, researchQuestion, description });
  return withStats(project, new Map());
}

const readySourceIds = (projectId) =>
  Document.find({ projectId, processingStatus: 'ready' }).distinct('_id');

/** True when the ids are the same set (order ignored). */
export function sameIdSet(a, b) {
  if (a.length !== b.length) return false;
  const set = new Set(a.map(String));
  return b.every((id) => set.has(String(id)));
}

/**
 * Whether the project's latest analysis still covers exactly its current
 * ready sources. Adding or deleting a source makes it outdated.
 */
export async function isAnalysisOutdated(analysis) {
  if (!analysis) return false;
  return !sameIdSet(analysis.documentIds, await readySourceIds(analysis.projectId));
}

/**
 * Recomputes a project's status after its set of ready sources changed:
 * 'draft' with none, 'analyzed' when the latest analysis covers exactly the
 * ready sources, otherwise 'active'. Also bumps updatedAt, so the dashboard
 * shows the project as recently active.
 */
export async function syncProjectAfterSourceChange(projectId) {
  const [ready, analysis] = await Promise.all([
    readySourceIds(projectId),
    Analysis.findOne({ projectId }).select('documentIds'),
  ]);
  let status = 'draft';
  if (ready.length) status = analysis && sameIdSet(analysis.documentIds, ready) ? 'analyzed' : 'active';
  await Project.updateOne({ _id: projectId }, { $set: { status } });
}

/**
 * Deletes a project and everything derived from it. Children go first, so
 * a failure part-way leaves the project visible and the delete can be retried
 * (standalone MongoDB has no multi-document transactions).
 */
export async function deleteProject(projectId, userId) {
  const project = await getOwnedProject(projectId, userId);
  const filter = { projectId: project._id };

  await Promise.all([
    DocumentChunk.deleteMany(filter),
    Insight.deleteMany(filter),
    Analysis.deleteMany(filter),
    Conversation.deleteMany(filter),
  ]);
  await Document.deleteMany(filter);
  await project.deleteOne();
}
