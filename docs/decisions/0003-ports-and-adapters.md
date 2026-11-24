# ADR 0003: Ports and adapters for replaceable integrations

**Status:** accepted

**Date:** 29 August 2026

## Context

The only source available today is a file exported from SEMS+, while the future may offer the GoodWe API, OCPP, Modbus or third-party platforms. Tariffs, payments and analysis may also change provider.

## Decision

Use cases depend on interfaces defined in the application layer. CSV, ANEEL, Mercado Pago, Supabase and future providers are infrastructure adapters wired in the FastAPI application's composition root.

## Consequences

- Adding a new source does not change the session and allocation domain.
- Adapters can share common contract tests.
- External failures are translated into application errors.
- There is a moderate cost in interfaces and mapping, concentrated only on the boundaries that are actually volatile.

## Alternatives considered

- SDKs used directly in services: less code up front, but high coupling.
- A dynamic plugin system: flexible, but unnecessary and risky for an MVP.
- A microservice per integration: maximum isolation with premature operational complexity.
