# IP Track

IP Track records initial document loads for configured sites, with an event history, approximate IP locations, and JSON downloads. The collector stores server receipt time and full visitor IPs. It does not track SPA route changes, sessions, or visitor journeys.

## Local setup

Requires Node.js 22+ and pnpm 10.14+.

```bash
pnpm run setup
cp apps/web/.dev.vars.example apps/web/.dev.vars
pnpm run db:migrate:local
pnpm run db:seed:local
pnpm run dev:web
# In another terminal:
pnpm run dev:collector
```

Set your GitHub OAuth app's client ID/secret and a random auth secret in `apps/web/.dev.vars`. Register `http://localhost:3000/api/auth/callback/github` as its local callback URL. Set `COLLECTOR_ORIGIN=http://localhost:8787` there for local embeds. Both apps use `apps/web/.wrangler/state` for local D1 persistence. The seed is repeatable and creates a sample project owned by a sample user; it does not bypass login. After signing in, create your own project in the dashboard.

To exercise the collector without OAuth, the seed provides project `11111111-1111-4111-8111-111111111111` with `localhost` allowed. Serve a page on localhost with its script tag. Its events are stored locally under the sample user.

## Install on a site

1. Create a project and add your exact hostname in Settings. Wildcards such as `*.example.com` include the apex and subdomains.
2. Copy the script from Settings into your site's HTML once. One event represents one initial document load; repeated copies in the same document and delivery retries use the same event ID.
3. Visit a page on the allowed site, then check Get Started in the project overview. It shows the last received event and domain, identity, clock, or quota rejections for today and yesterday.

The script uses `keepalive` and retries network/5xx failures twice. CSP must allow the collector origin in both `script-src` and `connect-src`. Cross-origin scripts use a JSON POST. Browser extensions and network blocking can prevent collection. Origin matching prevents accidental browser installations on unlisted domains; it is not authentication against non-browser senders.

## Enrichment and classification

Location and network organization come directly from Cloudflare request metadata, so recording an event requires no external lookup. Locations are approximate. Local requests may have no location metadata. Missing network flags remain unknown.

For optional proxy/mobile/hosting classification, configure an **ip-api Pro** key on the collector:

```bash
cd apps/collector
pnpm exec wrangler secret put IP_API_KEY
```

This sends raw IPs to ip-api over HTTPS. The event is stored first. Its row acts as a durable enrichment outbox: the scheduled handler processes at most 10 events each minute, with a three-second per-request timeout, five attempts with backoff, a 24-hour cache, and provider throttling handling. Enable this only if you want that data sharing and have a suitable provider subscription. Without a key, geo capture continues and classification remains unknown. The dashboard preserves independent flags (a mobile visitor can also use a proxy). Legacy hosting rows are marked unknown by the migration because the previous flags cannot be recovered.

## Privacy, retention, and limits

Full IPs support IP search, unique-IP counts, and event exports. Unique IPs do not mean unique people. Do not describe this deployment as storing no personal information. The dashboard includes the actual capture/storage behavior; disclose it appropriately to visitors.

Each project retains events for 30 days by default, configurable to 1–365 days. Reports and exports hide expired events immediately. Collector cron removes up to 5,000 expired rows per minute; large backlogs take multiple runs. Rejection diagnostics contain counts and reasons, no IPs, and expire after 30 days. Optional classification cache entries expire after 24 hours and are removed by cron. Deleting events or projects also removes associated diagnostics and matching cache entries. Deletion affects application storage, not database/provider backup policies.

A single atomic database statement limits accepted traffic to 1,000 events per project and 60 events per project/IP in a rolling minute. Requests are capped at 2 KB. New script event IDs suppress duplicate delivery. Client timestamps, when supplied, must be integer milliseconds within five minutes of server time; analytics always use server receipt time. Avoid Cloudflare transforms that remove client IP headers. Pseudo IPv4 overwrite mode is supported using the preserved IPv6 header.

## Checks

```bash
pnpm run check
pnpm exec playwright install chromium
pnpm run test:e2e
```

`check` builds shared code, generates binding types, typechecks both apps, runs unit/component/D1 integration tests, builds the production web bundle, and bundles the collector with a deployment dry run. Browser tests use a separate local D1 database and a dedicated test Worker config; they do not use GitHub OAuth or production data. `test:e2e` builds test-configured artifacts, so rebuild normally before deploying. CI runs both sets of checks.

## Deployment

Update the Worker routes and shared D1 identifiers in `apps/web/wrangler.jsonc` and `apps/collector/wrangler.jsonc`. Configure web secrets using `wrangler secret put` for `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET`. Keep secrets out of checked-in vars. Set the web `COLLECTOR_ORIGIN` to your HTTPS collector.

Back up the database and apply the checked-in migrations before deploying either app:

```bash
pnpm run db:migrate:remote
pnpm run deploy:collector
pnpm run deploy:web
```

Both apps must use the same migrated D1 database. Existing deployments that previously used Drizzle's HTTP migrator have a different migration ledger: reconcile applied filenames with D1's `d1_migrations` ledger before running Wrangler migrations on that existing database. Do not rerun CREATE/ALTER statements against tables that already exist. `0004_ancient_black_bird.sql` is the new migration for an existing database through `0003`; fresh local databases apply the full history automatically.

Deploy the collector cron trigger along with its code, and monitor cleanup/enrichment errors in Worker logs. Deployment commands run the release checks first. No deployment or remote migration is performed by local test commands.

## Layout

- `apps/web`: TanStack Start dashboard, authenticated server functions, streamed export route.
- `apps/collector`: Hono ingestion Worker, initial-load script, enrichment outbox and scheduled cleanup.
- `packages/data-ops`: shared auth, database schema, migrations, and validation.
- `CODE_REVIEW.md`: original review and remediation verification notes.
