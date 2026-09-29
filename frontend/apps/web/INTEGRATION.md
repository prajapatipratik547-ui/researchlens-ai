# ResearchLens frontend — integration notes

For Pratik (backend). Built against the **ResearchLens Integration Guide**, including the Phase 4–7 "Planned" endpoints.

## What's in this package

```
package.json            npm workspaces root (apps/*, packages/*)
packages/shared/        @synapse/shared — Zod schemas for every model/request/response in the guide
apps/web/               React + Vite frontend
```

`apps/api` is not included. Put your backend in `apps/api/`, or keep it as a separate repo. The frontend only needs its URL.

## Run it against your backend

```bash
npm install                       # from the repo root
cp apps/web/.env.example apps/web/.env.local
# in .env.local:
#   VITE_API_URL=http://localhost:5000/api
#   VITE_USE_MOCKS=false
npm run dev -w apps/web           # http://localhost:5173 (already in CLIENT_URL for CORS)
```

`npm run typecheck`, `npm run lint` and `npm run build` all pass from the root.

## What the frontend expects

Everything follows the guide exactly. There is no `{ data }` wrapper; bodies are `{ user, token }`, `{ projects }`, `{ project }` and so on.

| Area | Calls | Notes |
| --- | --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Token stored in `localStorage` (`researchlens.token`), sent as `Authorization: Bearer`. Any 401 on a protected call logs the user out. |
| Projects | `GET/POST /projects`, `GET/DELETE /projects/:id` | 404 **and** 400 on `/projects/:id` both show "Project not found". |
| Sources | `POST/GET /projects/:id/documents`, `GET/DELETE /documents/:id` | Upload field name `files`, multipart. Polls `GET …/documents` every 2.5 s while any doc is `processing`/`analyzing`. |
| Assistant | `GET …/conversations`, `POST …/ask` | Plain JSON (no streaming). 30 s timeout. |
| Analysis | `POST …/analyze`, `GET …/insights?type=`, `…/evidence`, `…/gaps`, `…/brief` | 90 s timeout for `/analyze` and `/brief`. `409 ANALYSIS_REQUIRED` on `/brief` shows the "Run analysis" state. |

Errors: every non-2xx body must be `{ error: { message, code, details? } }`. `details[].field` must match the request field (`email`, `title`, …) for the message to appear under that input. For uploads, it must be the file name.

Every response is checked against `@synapse/shared`. In dev, a mismatch logs a `[contract] … does not match schema` warning in the browser console but does **not** break the screen. If you see one, either the backend or `packages/shared` needs updating. Please change the schema on a `shared/*` branch so we both see it.

## Testing without the full backend

`VITE_USE_MOCKS=planned` uses your real auth + projects and mocks only the Phase 4–7 endpoints. That's handy while those are still being finished. `VITE_USE_MOCKS=true` mocks everything (the demo account is in `src/mocks/handlers.ts` → `seed()`). Mocks are dev-only and never included in `npm run build`.

## Known differences to settle

These are places where the shared `CLAUDE.md` rules and the integration guide disagree. The frontend follows the **guide**:

1. The root `CLAUDE.md` says PostgreSQL + pgvector; the guide says MongoDB (24-hex ids). The frontend only assumes 24-hex ids.
2. The `apps/api` rules said PDF-only, 20 MB; the guide says PDF/DOCX/TXT, up to 5 files, 10 MB each. The frontend validates the guide's limits before uploading.
3. The rules mention an SSE chat stream; the guide's `/ask` returns JSON, so the frontend uses JSON.
4. The rules mention a `{ data }` success envelope; the guide doesn't use one, and neither does the frontend.
