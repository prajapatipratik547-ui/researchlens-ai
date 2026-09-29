import mongoose from 'mongoose';

export const INSIGHT_TYPES = [
  'key_finding',
  'contradiction',
  'research_gap',
  'theme',
  'unanswered_question',
];

const insightSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    type: { type: String, enum: INSIGHT_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: '' },
    // [{ claim, documentId, filename, pageNumber, quote, support }], all
    // checked against the sources before saving.
    evidence: { type: mongoose.Schema.Types.Mixed, default: () => [] },
    // Type-specific: { claimA, claimB, possibleExplanation } for a
    // contradiction, { rationale } for a research gap, otherwise null.
    details: { type: mongoose.Schema.Types.Mixed, default: null },
    // 0–100; the UI maps it to Low / Medium / High.
    confidence: { type: Number, min: 0, max: 100, default: 50 },
    sourceReferences: [
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
    minimize: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

insightSchema.index({ projectId: 1, type: 1 });

export const Insight = mongoose.model('Insight', insightSchema);
