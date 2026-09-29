import type {
  Conversation,
  EvidenceMatrix,
  Insight,
  Project,
  ResearchBrief,
  SourceDocument,
  User,
} from '@synapse/shared';

/** Mock-only persistence. Survives reloads so a demo session isn't lost. */
export interface MockUser extends User {
  passwordHash: string;
}

export interface MockDocument extends SourceDocument {
  /** ms timestamp; status is derived from elapsed time to simulate background processing. */
  uploadedAt: number;
  willFail: boolean;
}

export interface MockAnalysis {
  analyzedAt: string;
  insights: Insight[];
  matrix: EvidenceMatrix;
  brief: ResearchBrief | null;
  /** Source ids at analysis time — any change marks the analysis outdated. */
  sourceIds: string[];
}

export interface MockDb {
  users: MockUser[];
  projects: Project[];
  documents: MockDocument[];
  conversations: Conversation[];
  analyses: Record<string, MockAnalysis>;
}

const KEY = 'researchlens.mockdb.v1';

function empty(): MockDb {
  return { users: [], projects: [], documents: [], conversations: [], analyses: {} };
}

export function load(): MockDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    // Fall through to an empty db.
  }
  return empty();
}

export function save(db: MockDb): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // In-memory only.
  }
}

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const now = () => new Date().toISOString();

export async function hashPassword(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`researchlens-mock:${password}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
