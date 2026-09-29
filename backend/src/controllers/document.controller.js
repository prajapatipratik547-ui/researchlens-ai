import * as documents from '../services/document.service.js';

export async function uploadDocuments(req, res) {
  const created = await documents.createDocuments(req.project, req.userId, req.files);
  // 202: accepted, still processing. The client polls the list for progress.
  res.status(202).json({ documents: created });
}

export async function listDocuments(req, res) {
  res.json({ documents: await documents.listDocuments(req.project._id) });
}

export async function getDocument(req, res) {
  const doc = await documents.getOwnedDocument(req.validated.params.id, req.userId, {
    withText: true,
  });
  res.json({ document: doc });
}

export async function deleteDocument(req, res) {
  await documents.deleteDocument(req.validated.params.id, req.userId);
  res.status(204).end();
}
