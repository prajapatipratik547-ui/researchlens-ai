# ResearchLens — shared rules for every Claude Code session

Read `docs/ARCHITECTURE.md` before starting any task. It is the source of truth.

## Who owns what
- `apps/web/` → Prasad (frontend). `apps/api/` → Friend (backend).
- `packages/shared/` (`@synapse/shared`) → the API contract (Zod schemas + types), mirroring the ResearchLens Integration Guide. Both own it.
- Only edit files inside your own app folder. If a task needs a contract change, stop and make a separate `shared/<change>` branch + PR. Never change a schema silently.

## Stack (hackathon-mandated, do not swap)
React + Vite + React Router + Tailwind + Axios | Node + Express + JWT + bcrypt + Zod + Multer | PostgreSQL + pgvector (Drizzle) | Google Gemini (key ONLY in apps/api env).

## Conventions
- TypeScript everywhere, strict mode. No `any` without a comment explaining why.
- Import contract types from `@synapse/shared`; never redefine them locally.
- API envelope: success `{ data }`, error `{ error: { code, message, details? } }`.
- Conventional commits: `feat(web): …`, `fix(api): …`, `chore(shared): …`.
- Branches: `web/*`, `api/*`, `shared/*`. Never push directly to `main`.
- Never commit `.env`; update the matching `.env.example` when adding a variable.

## Commands (from repo root)
- `npm install` — installs all workspaces
- `npm run dev -w apps/web` / `npm run dev -w apps/api`
- `npm run typecheck` / `npm run lint` / `npm run build` — must pass before a PR
