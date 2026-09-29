import mongoose from 'mongoose';

const documentChunkSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    chunkIndex: { type: Number, required: true, min: 0 },
    text: { type: String, required: true },
    pageNumber: { type: Number, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

documentChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
documentChunkSchema.index({ projectId: 1 });

export const DocumentChunk = mongoose.model('DocumentChunk', documentChunkSchema);
