# IP Track Web

Main web application for  project management with an analytics UI backed by D1.

## Development

From the repo root:

```bash
pnpm run dev:web
```

Or within this folder:

```bash
pnpm run dev
```

## Build

```bash
pnpm run build
```

## Deployment

The web worker uses a custom server entry at `src/server.ts` for auth and database bootstrapping. Update `apps/web/wrangler.jsonc` with your Worker name, route, and D1 database binding, then deploy:

```bash
pnpm run deploy:web
```

Or within this folder:

```bash
pnpm run deploy
```

## Environment Variables

Set these as Cloudflare Worker vars (or in `apps/web/wrangler.jsonc`):

- `BETTER_AUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `COLLECTOR_ORIGIN`

The D1 binding `DB` is configured in `apps/web/wrangler.jsonc`.

## Source Layout

- `apps/web/src/server.ts`: custom server entry for auth + DB setup.
- `apps/web/src/routes`: route modules and pages.
- `apps/web/src/core/functions`: server functions and database queries.
- `apps/web/src/components`: UI and page sections.
