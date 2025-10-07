# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Node.js Express API with `src/` for config, routes, services, models; `scripts/` for maintenance tasks; `logs/` for runtime output.
- `frontend/`: Vite + Vue 3 client; `src/api`, `src/stores`, `src/views` map to HTTP clients, Pinia stores, and page components.
- `database/`: canonical SQL schema (`schema.sql`, `seed.sql`) and stored procedures; keep migration scripts idempotent.
- `models/`: packaged inference assets consumed by backend services.
- `doc/`: product briefs and API references; update when endpoints change.

## Build, Test, and Development Commands
Backend (run inside `backend/`):
```bash
npm install
npm run dev         # hot-reload API with nodemon
npm test            # Jest suite with coverage report
npm run lint        # ESLint over src/**/*.js
```
Frontend (run inside `frontend/`):
```bash
npm install
npm run dev         # Vite dev server on localhost:5173
npm run build       # Production bundle under dist/
npm run preview     # Serve built assets for smoke tests
npm run lint        # ESLint + Prettier integration
```
Database utilities live under `backend/scripts/` (e.g., `node scripts/run-migrations.js`).

## Coding Style & Naming Conventions
- Prefer two-space indentation in JavaScript and Vue files, matching existing sources.
- Use CommonJS modules on the backend (`require`, `module.exports`) and ES modules on the frontend.
- Name REST handlers as `verbEntity` (e.g., `getPatientRecord`) and Pinia stores as `useXStore`.
- Run `npm run lint` before committing; lint rules extend ESLint recommended and Prettier formatting, so avoid manual reflow.

## Testing Guidelines
- Jest + Supertest cover backend routes; place specs alongside code with `.test.js` suffix or under `__tests__/`.
- Maintain >=80% branch coverage; address regressions before merging.
- Database scripts include smoke tests (`test-db-connection.js`); execute them after schema changes.
- Frontend currently relies on manual QA; document verification steps in PRs until Vitest suite is introduced.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `docs:`) as seen in recent history.
- Limit each commit to a single concern; include English summaries even if body uses Chinese context.
- Open PRs with: scope summary, testing checklist, affected endpoints/UI, and linked issue IDs.
- Attach screenshots or terminal output for UI or API changes; mention required env vars and migration steps.

## Configuration & Security Tips
- Duplicate `backend/.env.example` to `.env`; never commit secrets.
- Sanitize logs before sharing; rotate files in `backend/logs/`.
- For local DB, apply `database/schema_local.sql` then `seed.sql`; use read-only credentials in demos.
