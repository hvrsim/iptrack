# IP Track Collector

Cloudflare Worker responsible for ingesting site visit events.

## Endpoints

- `GET /`: simple health response.
- `GET /main.js`: embeddable script that posts events to `/events`.
- `POST /events`: ingests `{ projectId, timestamp }` (also accepts `project_id`).

## Request Flow

1. Parse and validate the event payload using shared Zod schemas from `@repo/data-ops`.
2. Resolve the client IP via Cloudflare headers.
3. Verify the request hostname matches a project domain in D1.
4. Enrich with `ip-api.com` data and insert an event row.

## Local Development

From the repo root:

```bash
pnpm run dev:collector
```

Or within this folder:

```bash
pnpm run dev
```

The dev script persists local D1 state under `apps/web/.wrangler/state`.

## Deployment

Ensure `apps/collector/wrangler.jsonc` has the correct Worker name, route, and D1 database binding, then run:

```bash
pnpm run deploy:collector
```

Or within this folder:

```bash
pnpm run deploy
```

## Configuration

- D1 database binding: `DB` (configured in `apps/collector/wrangler.jsonc`).
- External dependency: `ip-api.com` for geo/network enrichment.

## Source Layout

- `apps/collector/src/index.ts`: Worker entrypoint.
- `apps/collector/src/hono/app.ts`: Routes, validation, enrichment, and database writes.
