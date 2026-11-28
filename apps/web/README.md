# EV ChargeOps Web

Next.js interface of the operational product. The default authenticated route is
`/dashboard`; the SEMS+ import lives at `/settings/data-sources` as a secondary setting.

## Requirements and local run

Use Node.js `>=22.13.0 <23` and pnpm `11.19.0`. From the repository root:

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev:web
```

The application is available at `http://localhost:3407`. The local proxy forwards `/api/*`
to the ChargeOps API at `http://127.0.0.1:8407`.

In `local/test` mode, set `AUTH_MODE` to fixture in the local file. That mode uses a token
restricted to the non-production environment and needs no Supabase account. Next.js forwards
`/api/*` to the FastAPI API and keeps the bearer token out of URLs.

## Demo mode

In `demo` mode, use Supabase authentication and a real signed session. Set only in
`apps/web/.env.local`:

- `AUTH_MODE`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `API_PROXY_TARGET`

Only the publishable key may be exposed to the browser. Never put `DATABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, passwords or tokens in that file or in any `NEXT_PUBLIC_*`
variable.

## Product routes

- `/login`: password authentication in demo mode.
- `/dashboard`: consumption and operational overview.
- `/sessions`: sessions and assignment to units.
- `/charging-cards`: card registry.
- `/closing`: closing opinion and monthly closing.
- `/invoices`: issued invoices and access to the PDF.
- `/settings/data-sources`: import preview, confirmation and history.
- `/imports/new`: compatibility; redirects to the data-source settings.

The Next.js proxy refreshes the session and protects the routes. A missing session redirects
to `/login`; an authenticated user who opens the root or the login is sent to `/dashboard`.

## Language and formats

The interface is in English. Amounts are in US dollars (`$1,234.56`) and numbers use a
decimal point (`204.29 kWh`). Dates are month-first (`mm/dd/yyyy`) and times use a 12-hour
clock (`6:29 PM`). The charger export itself stays day-first with a 24-hour clock, because
that is how the equipment writes it; the import reads it as such.

## Verify

At the repository root:

```bash
pnpm lint:web
AUTH_MODE=supabase pnpm --dir apps/web exec next build --webpack
pnpm test:web
```

The Playwright tests start isolated local servers, use SQLite and fixture auth, and do not
access Supabase.

The production build blocks fixture authentication. The override above applies only to that
check; the local demonstration and the tests keep using fixture. The full walkthrough is in
the [main README](../../README.md#run-it-locally).
