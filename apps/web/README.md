# IP Track Web

TanStack Start dashboard for project setup, document-load analytics, retention controls, and streamed JSON exports. Authenticated writes require same-origin POST; reads and export downloads enforce project ownership.

See the [root README](../../README.md) for OAuth setup, local migrations and seeding, script installation, data behavior, tests, and deployment.

```bash
pnpm run dev
pnpm run typecheck
pnpm test
pnpm run build
```

Use `.dev.vars` for local secrets, starting from `.dev.vars.example`. The collector origin must match the local or deployed collector. Maps load only in the browser. Event, map, and overview data refresh while the dashboard is visible.
