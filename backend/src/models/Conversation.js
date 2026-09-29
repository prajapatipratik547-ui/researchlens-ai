import mongoose from 'mongoose';

// One research question and the grounded answer it received.
const conversationSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true, trim: true, maxlength: 2000 },
    // Structured answer: { answer, keyFindings, evidence, confidence, limitations }
    response: { type: mongoose.Schema.Types.Mixed, required: true },
    sources: [
      {
        _id: false,
        documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
        filename: String,
        pageNumber: Number,
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

conversationSchema.index({ projectId: 1, createdAt: 1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
