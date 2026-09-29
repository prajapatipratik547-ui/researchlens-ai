# ResearchLens AI

> From scattered sources to evidence-backed insights.

An AI research intelligence platform: upload multiple documents (PDF, DOCX, TXT), ask grounded questions, and get cited findings, an evidence matrix, potential contradictions, research gaps and an exportable research brief.

## What it does

- **Sources:** upload up to 5 files at a time. Text is extracted, split into searchable sections and summarized.
- **AI Research Assistant:** answers only from your sources. Every claim cites its file and page, and quotes are checked word for word against the source. When the sources don't cover a question, it says "Insufficient evidence" instead of guessing.
- **Run analysis:** one click produces key findings, themes, potential contradictions (with both sides and a possible explanation), research gaps and unanswered questions.
- **Evidence Matrix:** the central claims checked against every source (supports, contradicts, unclear, no evidence).
- **Research Brief:** a structured Markdown report with citations, ready to copy or download.

### How hallucinations are kept out

- File names and page numbers come from the stored documents, never from the AI.
- A citation to a source the AI was not given is removed, and so is a quote that isn't in the source.
- An answer left without valid evidence becomes "Insufficient evidence in the current research corpus."
- Confidence is capped by how many independent sources back a claim.
- The brief is written only from the verified analysis, and its source list is built from the uploaded files.

## Stack

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS v4, Motion, Three.js |
| Backend  | Node.js, Express 5, Mongoose, Zod, JWT, bcrypt, Multer               |
| Database | MongoDB Atlas                                                        |
| AI       | Google Gemini (server-side only), pluggable: Groq or any OpenAI-compatible API |

```
backend/            Express API (src/), tests (tests/)
frontend/           npm workspaces: apps/web (React app), packages/shared (API contract as Zod schemas)
render.yaml         Render deployment for the backend
```

## Local setup

Requires Node.js 20.19+.

```bash
# Backend
cd backend
npm install
cp .env.example .env      # set GEMINI_API_KEY (free at aistudio.google.com/apikey) and JWT_SECRET
npm run dev:local         # local MongoDB, no Atlas needed; http://localhost:5000/api/health
                          # (or set MONGODB_URI and run `npm run dev`)

# Frontend (second terminal)
cd frontend
npm install
cp apps/web/.env.example apps/web/.env.local   # VITE_API_URL=http://localhost:5000/api, VITE_USE_MOCKS=false
npm run dev -w apps/web   # http://localhost:5173
```

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Deployment

- **Backend (Render):** New → Blueprint → this repo (uses `render.yaml`). Set `MONGODB_URI`, `GEMINI_API_KEY`, and `CLIENT_URL` (the Vercel URL).
- **Frontend (Vercel):** import the repo with Root Directory `frontend` (uses `frontend/vercel.json`). Set `VITE_API_URL` to the Render URL followed by `/api`.
- **Database:** MongoDB Atlas free M0 cluster; allow network access from `0.0.0.0/0` for Render.

## Tests

```bash
cd backend && npm test    # 158 API tests against an in-memory MongoDB (no Atlas needed)
```

## Security notes

- The Gemini API key is read only by the backend. It never appears in any `VITE_*` variable or the browser bundle.
- `.env` files are gitignored; only `.env.example` files are committed.
- Passwords are hashed with bcrypt; protected routes require a JWT, and every project, document and insight is checked against the signed-in user.
- Uploads are validated by content (not just extension) and size; inputs are validated with Zod.
- Sample files used in demos are labelled DEMO DATA. The app never generates citations to papers that were not uploaded.
