# @synapse/shared — ResearchLens API contract

Zod schemas and TypeScript types for every request and response in the
ResearchLens integration guide (base URL `http://localhost:5000/api`).

- `limits.ts` — validation limits and timings from the guide.
- `schemas/*` — one file per resource. Response schemas describe what the
  backend sends; request schemas mirror its validation so forms can use them.

Contract changes go through a `shared/<change>` branch + PR, reviewed by both
apps. Never change a schema silently.
