import * as research from '../services/research.service.js';
import * as analysis from '../services/analysis.service.js';

export async function ask(req, res) {
  const conversation = await research.askQuestion(req.project, req.userId, req.body.question);
  res.json({ conversation });
}

export async function listConversations(req, res) {
  res.json({ conversations: await research.listConversations(req.project._id) });
}

export async function analyze(req, res) {
  res.json({ analysis: await analysis.runAnalysis(req.project) });
}

export async function listInsights(req, res) {
  res.json(await analysis.listInsights(req.project, req.validated.query.type));
}

export async function listGaps(req, res) {
  const { insights, analyzedAt, outdated } = await analysis.listInsights(req.project, 'research_gap');
  res.json({ gaps: insights, analyzedAt, outdated });
}

export async function getEvidence(req, res) {
  res.json(await analysis.getEvidenceMatrix(req.project));
}

export async function getBrief(req, res) {
  res.json(await analysis.getBrief(req.project));
}
