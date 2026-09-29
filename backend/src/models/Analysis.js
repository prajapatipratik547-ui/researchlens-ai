import mongoose from 'mongoose';

// The latest corpus analysis of a project (one per project; a new run
// replaces it). Insights are stored separately in the Insight collection.
const analysisSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    // Every ready source when the analysis ran. If the project's ready
    // sources differ from this set, the analysis is outdated.
    documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
    // Sources the model actually read, in order; S1 in the brief is the first.
    sources: [
      {
        _id: false,
        documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
        filename: String,
      },
    ],
    // 'full-corpus' when the model read every chunk, 'ranked' when the
    // corpus was too big and it read the most relevant part of each source.
    coverage: { type: String, default: 'full-corpus' },
    // { sources, rows } in the API shape (see the integration guide).
    matrix: { type: mongoose.Schema.Types.Mixed, default: null },
    counts: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    // Written on first request, then reused: { title, markdown, generatedAt }.
    brief: { type: mongoose.Schema.Types.Mixed, default: null },
    analyzedAt: { type: Date, required: true },
  },
  { minimize: false },
);

export const Analysis = mongoose.model('Analysis', analysisSchema);
