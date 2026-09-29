/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ResearchLens API base, e.g. http://localhost:5000/api */
  readonly VITE_API_URL?: string;
  /** Dev only. "true" mocks every endpoint, "planned" only Phase 4–7 endpoints. */
  readonly VITE_USE_MOCKS?: 'true' | 'planned' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
