# ResearchLens AI

> From scattered sources to evidence-backed insights.

An AI research intelligence platform: upload multiple documents, ask grounded questions, and get cited findings, an evidence matrix, potential contradictions, research gaps and an exportable research brief.

_Full documentation (architecture, API reference, deployment, demo flow) is added in a later phase._

## Stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Frontend | React 19, Vite, React Router, Tailwind CSS v4, Axios, Lucide |
| Backend  | Node.js, Express 5, Mongoose, Zod, JWT, bcrypt              |
| Database | MongoDB Atlas                                               |
| AI       | Google Gemini (server-side only)                            |

## Local setup

Requires Node.js 20.19+ and a MongoDB connection string (a free Atlas M0 cluster works).

```bash
# Backend
cd backend
npm install
cp .env.example .env      # set MONGODB_URI and JWT_SECRET
npm run dev               # http://localhost:5000/api/health

# Frontend (second terminal)
cd frontend
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api
npm run dev               # http://localhost:5173
```

**No Atlas cluster yet?** Run `npm run dev:local` in `backend/` instead of `npm run dev`. It starts a MongoDB server on your machine and keeps its data in `backend/.local-db` between runs. Use Atlas for deployment.

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Tests

```bash
cd backend && npm test    # API tests against an in-memory MongoDB (no Atlas needed)
cd frontend && npm test   # component and auth-flow tests
```

## Security notes

- The Gemini API key is read only by the backend. It never appears in any `VITE_*` variable or the browser bundle.
- `.env` files are gitignored; only `.env.example` files are committed.
- Passwords are hashed with bcrypt; protected routes require a JWT and resolve the user server-side.
