# IP Track

IP Track is a modern and scalable IP analytics platform.

## Overview

- Web app: authentication, project management, and analytics UI.
- Collector: event ingestion, domain validation, and IP enrichment.
- Shared data-ops: database setup, auth configuration, Drizzle schema, and Zod validation.

## Quickstart

```bash
pnpm run setup
pnpm run dev:web
pnpm run dev:collector
```

## Scripts

- `pnpm run setup`: install deps and build shared data-ops.
- `pnpm run build:data-ops`: compile `@repo/data-ops`.
- `pnpm run dev:web`: start the web app locally.
- `pnpm run dev:collector`: start the collector locally.
- `pnpm run deploy:web`: build data-ops and deploy the web app.
- `pnpm run deploy:collector`: build data-ops and deploy the collector.

## Deployment

Both apps deploy to Cloudflare Workers via Wrangler. Update `apps/web/wrangler.jsonc` and `apps/collector/wrangler.jsonc` with your account settings, routes, and D1 database IDs before deploying.

```bash
pnpm run deploy:web
pnpm run deploy:collector
```

## Environment Variables

Web app (Workers vars):
- `BETTER_AUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `COLLECTOR_ORIGIN` (also set in `apps/web/wrangler.jsonc`)

Collector:
- D1 binding named `DB` (configured in `apps/collector/wrangler.jsonc`)

## Source Layout

- `apps/web`: TanStack Start dashboard and server functions.
- `apps/collector`: Hono-based ingestion worker.
- `packages/data-ops`: shared auth, database setup, Drizzle schema, and Zod schemas.
