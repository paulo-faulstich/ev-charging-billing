# EV ChargeOps API

FastAPI backend responsible for authentication, organizational scope, persistence and
querying of SEMS+ imports. The backend is the only component that accesses the operational
tables and the storage of original files.

## Run modes

### Local/test

The `local/test` mode uses SQLite, fixture authentication and filesystem storage. It needs
no Supabase or other external account. Copy `.env.example` to `.env`, install the
dependencies at the repository root and run:

```bash
pnpm db:upgrade
uv run --project apps/api python apps/api/scripts/seed_operational_foundation.py
pnpm dev:api
```

The local API listens on `http://127.0.0.1:8407`.

The root script `db:upgrade` runs
`uv run --project apps/api alembic -c apps/api/alembic.ini upgrade head`.
The seed can be repeated without duplicating the organization, the site, the charger or the
four units.

### Demo

The `demo` mode requires Supabase PostgreSQL, Auth and Storage. Use direct PostgreSQL when
the host has IPv6. For an IPv4-only backend, select **Supavisor session** on port `5432`;
transaction mode is not the documented connection for this persistent backend.

The backend's configuration inventory is:

- `APP_ENV`
- `AUTH_MODE`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_JWT_AUDIENCE`
- `ORIGINAL_FILE_STORE`
- `DEMO_MANAGER_EMAIL`
- `ORIGINAL_FILES_ROOT` and `FIXTURE_AUTH_TOKEN` only in `local/test`
- `SUPABASE_SERVICE_ROLE_KEY` only in the backend, in `demo`

Set the values only in `apps/api/.env`, which must not be versioned. In demo, use Supabase
authentication, PostgreSQL and Supabase storage; fixture auth is rejected.
`SUPABASE_SERVICE_ROLE_KEY` is exclusive to the backend and must never reach the frontend,
logs or documentation. This guide publishes only variable names, never credentials or
connection strings.

## Migrations, seed and remote Storage

The local and remote commands are the same:

```bash
pnpm db:upgrade
uv run --project apps/api python apps/api/scripts/seed_operational_foundation.py
pnpm db:check
```

When `DATABASE_URL` points to a remote project, migration and seed are external writes.
Confirm the project and the commands at the moment you run them. Before the first remote
import, an operator must separately create the private bucket `sems-imports`, restrict the
MIME type to `text/csv` and limit each object to 10 MB. Creating the bucket and confirming
the first import are also external writes and require explicit authorization.

The seed does not create Auth users. The operator creates or identifies the account whose
value matches `DEMO_MANAGER_EMAIL`; the first authenticated request to `/v1/me` creates only
the allowlisted profile and membership.

## Routes

The full contract is the generated OpenAPI document in
[`packages/api-client/openapi.json`](../../packages/api-client/openapi.json). The import
routes, as an example:

- `GET /health`: API health, no authentication.
- `GET /v1/me`: scope of the authenticated user.
- `POST /v1/import-batches/preview`: validates and classifies the CSV without persisting.
- `POST /v1/import-batches`: confirms an idempotent import.
- `GET /v1/import-batches`: lists the authenticated organization's batches.
- `GET /v1/import-batches/{batch_id}`: returns a batch and its raw records.

Every operational endpoint receives a verified bearer token and derives the organization
from the authorized scope, never from an identifier supplied by the client. CSV is only a
read adapter; there is no command path to the charger.

## Verify

At the repository root:

```bash
pnpm typecheck:api
pnpm test:api
pnpm test:integration
pnpm db:check
pnpm check
```
