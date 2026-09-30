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
| `WRITER_LOCK_WAIT_MS`, `ALLOW_MULTI_INSTANCE` | Single-writer guard tuning; see "Single instance only". |
| `CSP_MODE` | `report-only` (default in production) or `enforce`; see below. |
| `SEED_DEMO_DATA` | Demo accounts are never seeded in production unless this is `true`. Leave unset. |
| `PLATFORM_COMMISSION_PERCENT` | Platform fee, default `8.5`. |
| `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD` | Optional one-boot creation of the **first admin** on platforms without shell access (see "Admin portal"). Both must be set; the admin is created with "must change password"; an existing admin is never modified. **Remove both after the first sign-in.** `ADMIN_BOOTSTRAP_NAME`, `ADMIN_BOOTSTRAP_PROMOTE=true` (promote an existing non-admin account) are optional. |
| `ADMIN_REQUIRE_REAUTH` | Default on: destructive admin actions (suspend, refunds, payouts, force-status, review removal, broadcasts, ...) demand the admin's password again. `false` disables the prompt. |
| `PAYOUT_APPROVAL_REQUIRED` | `true` = technician payout requests are held as `PENDING` (money reserved, nothing sent to Paystack) until an admin approves them in the portal. Default off (payouts go straight to Paystack as before). |

### Frontend (build time)

`VITE_GOOGLE_CLIENT_ID` (Google Sign-In; authorise your deployed origin in Google Cloud Console),
`VITE_GOOGLE_MAPS_API_KEY` (Maps / Places, restrict by HTTP referrer), optionally `VITE_APPLE_CLIENT_ID`,
`VITE_FACEBOOK_APP_ID`. The server also reads `GOOGLE_CLIENT_ID` to verify Google ID tokens.

## Admin portal

The admin console lives at **`/admin`** (lazy-loaded; the customer/technician bundle is not downloaded there). API: `/api/admin/*`.
It is a separate, hardened sign-in: admin accounts (`role: "admin"`) cannot sign in through the public `/auth/login`, cannot use
social login / password reset / switch-role / delete-account, and receive **8-hour** tokens that are revocable (sign out, "sign out
everywhere", suspension and password changes all invalidate them immediately).

**Features:** dashboard (users, technicians, jobs by status, GMV, escrow held, platform fees, refunds, payouts, disputes, 14-day
trend, "needs attention" queue) - users and technicians (search / filter / sort / paginate, detail drawer without secrets, suspend /
reactivate, sign-out-everywhere, KYC approve / reject) - jobs (detail with timeline, payments, chat transcript, force-cancel with
automatic refund, open / resolve disputes) - payments, escrow (technician earnings), refunds and payouts ledgers (admin refunds,
reconcile, payout approve / reject) - reviews moderation (hide / restore / remove) - risk events - audit-log viewer - announcements
(broadcast notifications by audience) - admin management - CSV export of every ledger (BOM'd UTF-8, spreadsheet-formula safe,
account numbers masked). Every admin mutation writes an audit-log entry with the acting admin. List endpoints use the same
`limit` / `offset` / `X-Total-Count` convention as the rest of the API; no response ever carries a password hash, token or full bank
account number.

### Creating the first admin (there is no default admin and no seeded password, in any environment)

```bash
# stop the app first (Fixhub keeps a single writer per database), then, with the same DATABASE_URL as the app:
npm run admin:create -- --email you@example.com --name "Your Name"
#   prompts twice for the password (hidden input). Extra options:
#   --promote          turn an EXISTING customer/technician account into an admin
#   --reset-password   set a new password for an existing admin (signs out all its sessions)
#   --password-stdin   read the password from stdin (automation); the admin must then choose their own at first sign-in
```

* The password is never accepted as a command-line argument. Policy: **12+ characters with upper- and lower-case letters, a digit and a symbol**.
  Admins created through stdin / `ADMIN_PASSWORD` / the env bootstrap are forced to choose their own password at first sign-in
  (until then only `/admin/me` and change-password work).
* No shell access (Cloud Run, PaaS)? Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` for **one deploy**, sign in at `/admin`,
  choose a new password, then remove both variables. The env values are only ever used to *create* an admin - a leftover variable
  cannot reset an existing admin's password, and the server logs a warning while they remain set.
* The script is idempotent (`created` / `promoted` / `password_reset` / `exists`) and refuses to run while the app holds the database
  writer lock.

### Admin security controls

* Login is rate-limited per IP (10 failed attempts / 15 min) **and** locks the admin account after 5 failures (15 min, shared with the
  password prompts of destructive actions). Failed attempts against unknown e-mails answer identically to wrong passwords and are not
  written to the audit log (no log flooding / account enumeration).
* Destructive actions require the admin's password again (`adminPassword` in the JSON body; `ADMIN_REQUIRE_REAUTH=false` turns it off).
* The last active admin cannot be suspended; admins cannot suspend themselves.
* Legacy `POST /payments/refund` and `POST /admin/technicians/:id/verify` now also require the admin password and are audited.

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
- A second instance detects the writer advisory lock, waits up to `WRITER_LOCK_WAIT_MS` (default 30000, lets a rolling
  deploy hand over) and then **refuses to start in production**. A heartbeat re-acquires the lock if the DB connection drops
  and exits the process if another instance took it meanwhile. `ALLOW_MULTI_INSTANCE=true` downgrades this to a warning
  (unsupported: instances overwrite each other's data; rate limits are per instance).
- Horizontal scaling needs shared state (Redis-backed limiters/sessions and row-level persistence); not implemented yet.

### Content-Security-Policy

In production the server sends a CSP that allows the bundled app, Google Sign-In (`accounts.google.com/gsi`), Google
Maps, Paystack (`js.paystack.co`, `checkout.paystack.com`) and Nominatim. It is **report-only by default**
(`Content-Security-Policy-Report-Only`; violations are logged as `[csp-report]` via `POST /api/csp-report`). Once you have
browsed your deployment (login, Google button, map, checkout) with no reports, set `CSP_MODE=enforce`.
`frame-ancestors` defaults to `'self'` plus `ALLOWED_ORIGINS` (add more via `CSP_FRAME_ANCESTORS`). The single inline
script in `index.html` is allowed by SHA-256 hash computed at boot from `dist/index.html`.

## Code layout

- `server.ts` – Express bootstrap (helmet, CSP, CORS, static/Vite, health, graceful shutdown)
- `server/routes/modules/adminPortal.ts`, `server/services/adminAuthService.ts` – admin API + admin auth; `src/admin/*` – the `/admin` UI;
- `server/routes/api.ts` – assembles the API; the routes live in `server/routes/modules/*.ts` (auth, devices,
  technicians, repairs, quotes, payments, jobs, reviews, technicianAccount, messaging, admin). **Import order in
  `api.ts` is route registration order** — don't reorder it.
- `server/services/*` – business logic; `server/db.ts` + `server/db/*` – persistence (entity store write-through)
- `src/` – React app; `src/tests/` – the test suite

## API notes

- **Pagination:** list endpoints (technicians, jobs, requests, quotes, reviews, parts, inventory, notifications, warranties,
  messages, admin disputes, customer devices) accept `?limit=` (default 200, max 500; messages 1000) and `?offset=`. The body
  stays a plain JSON array; `X-Total-Count`, `X-Limit`, `X-Offset` response headers describe the window.
- **Technician phone numbers are private:** public technician endpoints never include `phone`; a customer sees it (job detail
  `GET /api/jobs/:id`, quotes) only while they have a paid, not-yet-closed job with that technician.
- Sensitive account actions (`DELETE /api/account/me`, `POST /api/auth/switch-role`) require the current password in the JSON
  body (`{ "password": "..." }`); wrong/missing password → `403`. Social-login-only accounts (no password) get
  `403 PASSWORD_NOT_SET` and must set a password first: `POST /api/auth/set-password` `{ "newPassword": "..." }`
  (authenticated; only for accounts with no password, otherwise `409 PASSWORD_ALREADY_SET`; same rules as registration -
  min 8 chars incl. a digit; bcrypt cost 12; audit-logged as `PASSWORD_SET`). It signs other sessions out and returns a fresh
  `token` (the web client stores it). `POST /api/auth/change-password` now also returns a fresh `token` for the same reason.
  The public user object gained `hasPassword` (never the hash); the Profile > Account & Security screens show a
  "Set a Password" form for Google-only accounts and the delete-account dialog offers it when the API answers `PASSWORD_NOT_SET`.
- Password-reset, e-mail and phone verification codes are stored as HMACs in `verification_codes` and survive restarts.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: frozen-lockfile install, typecheck,
lint, build, tests (pg-mem, and again against a PostgreSQL service container) and `bun audit`.
