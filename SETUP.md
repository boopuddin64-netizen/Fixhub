# Fixhub — Database & Local Development Setup Guide

This document provides complete instructions for configuring and running the Fixhub relational PostgreSQL database in local development and production.

---

## 1. Prerequisites

- **Node.js**: v18.x or v20.x+
- **Docker & Docker Compose** (Optional for local containerized Postgres)

---

## 2. Running PostgreSQL Locally via Docker

Fixhub includes a pre-configured `docker-compose.yml` that mounts the PostgreSQL schema automatically at `./server/db/schema.sql`.

### Start the PostgreSQL Container
```bash
docker-compose up -d
```

This starts a PostgreSQL instance with:
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `fixhub_db`
- **Username**: `fixhub_user`
- **Password**: `fixhub_password`

### Stopping the Container
```bash
docker-compose down
```

---

## 3. Environment Variables Configuration

Create or update your `.env` file in the project root:

```env
# Server & Port
PORT=3000
NODE_ENV=development

# Database Connection (PostgreSQL)
DATABASE_URL=postgresql://fixhub_user:fixhub_password@localhost:5432/fixhub_db
# Or specify individual parameters:
# PGHOST=localhost
# PGPORT=5432
# PGUSER=fixhub_user
# PGPASSWORD=fixhub_password
# PGDATABASE=fixhub_db

# Paystack API Configuration
# In development (NODE_ENV !== 'production'), mock sandbox fallback is permitted.
# In production (NODE_ENV === 'production'), a live live key (starting with sk_live_) is strictly enforced.
PAYSTACK_SECRET_KEY=sk_test_mock_or_sandbox_key
PAYSTACK_PUBLIC_KEY=pk_test_mock_or_sandbox_key

# Authentication
# In production, a secure 32+ character JWT secret is required.
JWT_SECRET=fixhub-dev-secret-key-production-change-me
```

---

## 4. Automatic Database Schema & Embedded Engine

- When `DATABASE_URL` or `PGHOST` is set, Fixhub connects directly to your live PostgreSQL database using `pg.Pool`.
- When no external PostgreSQL server is detected in local development, Fixhub automatically runs using its embedded in-memory PostgreSQL engine (`pg-mem`) executing the exact PostgreSQL schema and SQL DDL defined in `server/db/schema.sql`.
- Financial operations (payment verification, booking status transitions, earnings generation, payout distributions, and webhook idempotency) execute in ACID SQL transactions.

---

## 5. Production Deployment Fail-Fast Guardrails

In production (`NODE_ENV=production`):
1. **Paystack Secret Key Validation**: The server fails loudly and refuses to boot if `PAYSTACK_SECRET_KEY` is missing, empty, contains `"mock"`, or begins with `"sk_test"`.
2. **JWT Secret Validation**: The server refuses to boot if `JWT_SECRET` is unset or uses the default development placeholder secret.
