import mongoose from 'mongoose';

export const PROCESSING_STATUSES = ['uploading', 'processing', 'analyzing', 'ready', 'failed'];
export const FILE_TYPES = ['pdf', 'docx', 'txt'];

const documentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true, trim: true, maxlength: 255 },
    fileType: { type: String, enum: FILE_TYPES, required: true },
    fileSize: { type: Number, required: true, min: 0 },
    // Can be large; only loaded when explicitly requested. No default, so it
    // is absent (not '') until extraction succeeds.
    extractedText: { type: String, select: false },
    summary: { type: String, default: '' },
    // pageCount is null for formats without fixed pages (DOCX, TXT).
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ pageCount: null, wordCount: null, chunkCount: null }),
    },
    // 'uploading' is shown by the client during transfer; the server starts at 'processing'.
    processingStatus: { type: String, enum: PROCESSING_STATUSES, default: 'processing' },
    processingError: { type: String, default: '' },
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.userId;
        return ret;
      },
    },
  },
);

documentSchema.index({ projectId: 1, createdAt: -1 });

export const Document = mongoose.model('Document', documentSchema);
