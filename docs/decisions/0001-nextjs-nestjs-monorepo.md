# ADR 0001: Next.js and NestJS in a TypeScript monorepo

**Status:** superseded by [ADR 0005](0005-nextjs-fastapi-modular-monolith.md)

**Date:** 29 August 2026

**Superseded on:** 29 August 2026

## Context

The product needs a convincing web experience and a backend with explicit boundaries for ingestion, cost allocation, payments and insights. Next.js Route Handlers would be enough for a BFF layer, but they would put UI and domain in the same runtime and weaken the architecture.

## Decision

Use Next.js for the frontend and NestJS for the backend, in a pnpm monorepo with shared TypeScript contracts. The backend exposes REST/OpenAPI and owns rules, authorization and integrations.

## Consequences

- Consistent typing and tooling across frontend and backend.
- NestJS modules make dependencies and responsibilities visible.
- Frontend and backend can be deployed separately.
- More initial setup than a single Next.js application.

## Alternatives considered

- Full-stack Next.js: less setup, but tighter coupling between interface and domain.
- Fastify without NestJS: less overhead, but conventions and modules have to be defined by hand.
- React with a Python backend: a good fit for ML, but adds a second stack before advanced models are needed.

## Why it was superseded

Once it became explicit that anomaly detection, consumption forecasting and clustering were core capabilities of the prototype rather than future extensions, the premise of this decision no longer held. [ADR 0005](0005-nextjs-fastapi-modular-monolith.md) keeps the Next.js frontend and replaces NestJS with a modular FastAPI monolith, avoiding a second service whose only job would be to run the data and analysis layer already planned in Python.
