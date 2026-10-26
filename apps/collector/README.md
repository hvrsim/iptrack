# IP Track Collector

Hono Worker with `GET /` health, `GET /main.js` initial-document-load script, and `POST /events` ingestion. Accepts `{ projectId, eventId?, timestamp? }` (legacy `project_id` is supported). Events use server receipt time. Request bodies are limited to 2 KB; domain validation, atomic rolling quotas, and event IDs protect ingestion.

Immediate location enrichment uses Cloudflare request metadata. Optional `IP_API_KEY` enables HTTPS ip-api Pro classification through a durable outbox processed by cron. Cron also enforces per-project retention. Missing classification remains unknown.

See the [root README](../../README.md) for local migrations/seeding, installation, privacy behavior, optional provider setup, limits, tests, and deployment.

```bash
pnpm run dev
pnpm test
pnpm run typecheck
```

Local D1 state is shared with the web app under `apps/web/.wrangler/state`. Secrets belong in `.dev.vars` locally and Wrangler secrets in production. No production database access is needed for tests.
