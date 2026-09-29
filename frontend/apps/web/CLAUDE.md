# apps/web — Frontend rules (Prasad)

Read `/CLAUDE.md` first. The backend contract is the **ResearchLens Integration Guide** (Pratik's artifact); `packages/shared` mirrors it as Zod schemas.

- Designs come from Claude Design. Implement them faithfully; pull shared values into Tailwind v4 `@theme` tokens in `src/styles/` instead of hard-coding colours or spacing.
- Server state: TanStack Query hooks in `src/hooks/`. Components never call Axios directly.
- HTTP: the Axios instance in `src/lib/api.ts` (Bearer token, 30 s timeout, 90 s for /analyze and /brief via `LONG_REQUEST`). Typed calls live in `src/lib/endpoints.ts`. The assistant is plain JSON — there is no streaming endpoint.
- Auth: `AuthProvider` restores the session with GET /auth/me; any 401 on a protected request logs out with a notice. Guards: `RequireAuth` / `GuestOnly` in `src/components/app/RouteGuards.tsx`.
- Forms: react-hook-form + zodResolver using schemas from `@synapse/shared`.
- Mocks: `VITE_USE_MOCKS=true` mocks every endpoint (seeded demo account in `src/mocks/handlers.ts`), `planned` mocks only Phase 4–7 endpoints. Handlers `parse()` every response with the shared schemas — keep them in sync when the contract changes.
- AI output: evidence colours/labels and confidence labels come from `src/components/ui/Evidence.tsx` only. Always pair colour with an icon + word, and show a file + page next to every claim.
- Animation: `motion` (Framer Motion). Put reusable wrappers in `src/components/motion/`. Animate `transform`/`opacity` only, and honour `prefers-reduced-motion`.
- Every data view needs loading (skeleton), empty, and error states.
- Must be responsive down to 375px wide.
- Never put any AI API key in frontend code or `VITE_*` variables.

## Routes
`/` landing · `/login` `/register` · `/dashboard` · `/research/new` · `/research/:id` (Overview) + `/sources` `/assistant` `/evidence` `/insights` `/gaps` `/brief`

## Landing page notes
- Scroll scenes live in `src/components/landing/*Scene.tsx`; each is a tall section with a sticky stage driven by `useSectionProgress`.
- Scene timelines are the constants at the top of each file — tweak those, not the JSX.
- Every scene has a reduced-motion path (static layout, no pinning).
- `ChromeStar` lazy-imports three.js so it stays out of the main chunk.
