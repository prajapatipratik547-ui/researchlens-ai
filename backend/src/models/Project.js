import mongoose from 'mongoose';

// draft: no ready sources · active: has ready sources · analyzed: an analysis
// covers exactly the current ready sources
export const PROJECT_STATUSES = ['draft', 'active', 'analyzed'];

// An analysis that hasn't finished after this long is assumed to have died
// with the server, so its lock no longer blocks a new run.
export const ANALYSIS_LOCK_MS = 5 * 60 * 1000;

const projectSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    researchQuestion: { type: String, required: true, trim: true, maxlength: 600 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: PROJECT_STATUSES, default: 'draft' },
    analyzedAt: { type: Date, default: null },
    // Set while an analysis runs; doubles as a lock against parallel runs.
    analysisStartedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.analyzedAt = ret.analyzedAt ?? null;
        ret.analysisInProgress = Boolean(
          ret.analysisStartedAt && Date.now() - new Date(ret.analysisStartedAt).getTime() < ANALYSIS_LOCK_MS,
        );
        delete ret.analysisStartedAt;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Dashboard query: a user's projects, most recently updated first.
projectSchema.index({ userId: 1, updatedAt: -1 });

export const Project = mongoose.model('Project', projectSchema);
