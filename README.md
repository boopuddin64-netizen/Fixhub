# Fixhub

Fixhub is a phone-repair marketplace for Nigeria: customers describe a broken device, get quotes from nearby verified
technicians, pay through Paystack (held by the platform until the repair is confirmed) and track the repair with a
warranty passport.

- **Frontend:** React 19 + Vite 6 + Tailwind 4 (PWA), source in `src/`
- **Backend:** Express 4 (`server.ts`, `server/`), JWT auth, Paystack payments, SMS + ID-verification providers
- **Database:** PostgreSQL (production) with an in-memory `pg-mem` fallback for local development and tests.
  Schema: `server/db/schema.sql` (applied idempotently at boot).

See also [`SETUP.md`](SETUP.md) for the Docker/PostgreSQL walkthrough.

## Quick start

```bash
bun install            # or: npm install   (bun.lock is the committed lockfile)
cp .env.example .env   # then edit; see "Environment variables"
npm run dev            # API + Vite dev server on http://localhost:3000 (pg-mem, demo data)
```

Optional local PostgreSQL: `docker-compose up -d` then set
`FIXHUB_USE_POSTGRES=true` and `DATABASE_URL=postgresql://fixhub_user:fixhub_password@localhost:5432/fixhub_db`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Express + Vite middleware (HMR) via `tsx server.ts` |
| `npm run build` | `vite build` (frontend → `dist/`) and bundles the server to `dist/server.cjs` |
| `npm start` | Runs the production bundle (`node dist/server.cjs`); needs `NODE_ENV=production` env vars below |
| `npm test` | Full test suite (`src/tests/run_all_tests.ts`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config in `eslint.config.js`; warnings allowed, errors fail) |
| `npm run check` | typecheck + lint |

`VITE_*` variables are inlined into the frontend at **build** time, so set them before `npm run build`.

### Tests

`npm test` uses pg-mem and passes fully except one test (`resolveAccountNumber ... OPay`) that calls the live Paystack
API and therefore needs a real key + network. Set `SKIP_LIVE_NETWORK_TESTS=1` to skip it (CI does). Setting
`DATABASE_URL` + `FIXHUB_USE_POSTGRES=true` runs the same suite against real PostgreSQL.

## Environment variables

### Required in production (`NODE_ENV=production` — the server refuses to boot otherwise)

| Variable | Notes |
| --- | --- |
| `JWT_SECRET` | **32+ characters**, random (e.g. `openssl rand -hex 32`). The dev placeholder is rejected. |
| `PAYSTACK_SECRET_KEY` | **Live** key (`sk_live_…`). Empty / `mock` / `sk_test…` keys are rejected. |
| `DATABASE_URL` (or `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT`) | PostgreSQL connection. In-memory storage is refused in production. |
| `SMS_PROVIDER_API_KEY` | SMS key (Sendchamp: `SENDCHAMP_API_KEY`, optional `SENDCHAMP_SENDER_NAME`, `SENDCHAMP_ROUTE`; `TERMII_API_KEY` / `AFRICASTALKING_API_KEY` also accepted by the validator). Used for phone verification and OTPs. |
| `ALLOWED_ORIGINS` | Comma-separated exact origins allowed by CORS, e.g. `https://app.example.com,https://*.example.com`. Also set `APP_URL`. Without it, cross-origin browser calls are blocked (same-origin is unaffected). |

### Strongly recommended in production

| Variable | Notes |
| --- | --- |
| `IDENTITYPASS_API_KEY` (alias `PREMBLY_API_KEY`) and `IDENTITYPASS_APP_ID` | IdentityPass / Prembly key for NIN / BVN / driver-licence / CAC verification of technicians. **Without it technician ID verification cannot be trusted** (see identity service) — configure it before onboarding real technicians. |
| `PAYMENT_MODE` | Must be `live` (or unset) in production; `sandbox` is rejected at boot because it simulates payments. |
| `APP_URL` | Public URL of the app (also allowed as a CORS origin and iframe ancestor). |
| `PORT` | Defaults to `3000`. |
| `CSP_MODE` | `report-only` (default in production) or `enforce`; see below. |
| `SEED_DEMO_DATA` | Demo accounts are never seeded in production unless this is `true`. Leave unset. |
| `PLATFORM_COMMISSION_PERCENT` | Platform fee, default `8.5`. |

### Frontend (build time)

`VITE_GOOGLE_CLIENT_ID` (Google Sign-In; authorise your deployed origin in Google Cloud Console),
`VITE_GOOGLE_MAPS_API_KEY` (Maps / Places, restrict by HTTP referrer), optionally `VITE_APPLE_CLIENT_ID`,
`VITE_FACEBOOK_APP_ID`. The server also reads `GOOGLE_CLIENT_ID` to verify Google ID tokens.

## Deploying

1. Provision PostgreSQL (the schema is created automatically on first boot, under an advisory lock).
2. Build with the `VITE_*` variables set: `npm ci`/`bun install --frozen-lockfile && npm run build`.
3. Start with `NODE_ENV=production npm start` behind a TLS-terminating reverse proxy (Cloud Run, Nginx, …).
   The app sets `trust proxy` to `1` hop, so it must sit behind exactly one proxy for correct client IPs / rate limiting.
4. Health checks: `GET /health` (also reports database reachability).
5. Ship the whole checkout including `server/db/schema.sql` (read at boot from the working directory) and `dist/`.

### Single instance only (important)

Application state is cached in memory per process and written through to PostgreSQL (`entity_store`,
`revoked_tokens`, `bank_otps`, …). Rate limiters (`express-rate-limit`) are in-process as well. Consequently:

- Run **exactly one instance per database** (Cloud Run: `--max-instances=1`, or a single replica).
- A second instance detects the writer advisory lock and **refuses to start in production** (set
  `ALLOW_MULTI_INSTANCE=true` only if you accept that data written by the instances can overwrite each other).
- Horizontal scaling needs shared state (Redis-backed limiters/sessions and row-level persistence); not implemented yet.

### Content-Security-Policy

In production the server sends a CSP that allows the bundled app, Google Sign-In (`accounts.google.com/gsi`), Google
Maps, Paystack (`js.paystack.co`, `checkout.paystack.com`) and Nominatim. It is **report-only by default**
(`Content-Security-Policy-Report-Only`; violations are logged as `[csp-report]` via `POST /api/csp-report`). Once you have
browsed your deployment (login, Google button, map, checkout) with no reports, set `CSP_MODE=enforce`.
`frame-ancestors` defaults to `'self'` plus `ALLOWED_ORIGINS` (add more via `CSP_FRAME_ANCESTORS`). The single inline
script in `index.html` is allowed by SHA-256 hash computed at boot from `dist/index.html`.

## API notes

- List endpoints (`GET /api/technicians`, …) accept `?limit=` and `?offset=`; see "Pagination" below.
- Sensitive account actions (`DELETE /api/account/me`, `POST /api/account/switch-role`) require the current password.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: frozen-lockfile install, typecheck,
lint, build, tests (pg-mem, and again against a PostgreSQL service container) and `bun audit`.
