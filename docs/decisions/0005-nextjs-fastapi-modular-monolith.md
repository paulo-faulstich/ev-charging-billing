# ADR 0005: Next.js and FastAPI as a modular monolith

**Status:** accepted

**Date:** 29 August 2026

**Supersedes:** [ADR 0001](0001-nextjs-nestjs-monorepo.md)

## Context

The initial research planned ingestion, cost allocation and three analytical capabilities in Python: anomaly detection, consumption/demand forecasting and segmentation by clustering. The first decision, NestJS, treated models as a later evolution and anticipated an eventual second Python service.

When the PRD for the prototype was consolidated, those three capabilities became part of the main demo. Keeping NestJS would have meant implementing part of the domain in TypeScript and adding a Python service, or reproducing in Node.js a data flow already planned around `pandas` and `scikit-learn`.

## Decision

Use Next.js and TypeScript on the frontend and a single Python backend with FastAPI, Pydantic, SQLAlchemy and Alembic. The backend is a modular monolith deployed as one unit, with internal boundaries organized by domain and ports/adapters.

Anomaly detection, forecasting and segmentation initially live in the same backend, behind their own ports. The frontend consumes the REST API through a TypeScript client generated from, or validated against, the OpenAPI contract.

Supabase continues to provide PostgreSQL, Auth and Storage. The backend validates the JWT, applies business authorization and is the only path to operational tables.

## Consequences

- The implementation stack matches the analysis plan from the research phase.
- Ingestion, allocation and analysis share canonical models with no network hop between services.
- The demo needs a single backend deploy and one observability chain.
- Frontend and backend use different languages, with the OpenAPI contract as the typed boundary.
- Modular discipline has to be enforced by structure, imports and tests, because there is no process isolation.
- A module can be extracted into its own service without changing the use cases that consume it, as long as it keeps its ports.

## Alternatives considered

- **NestJS plus a Python analysis service:** separates runtimes, but adds two deploys, network failures, contract versioning and distributed observability before independent scaling is needed.
- **A backend entirely in Node.js:** keeps TypeScript end to end, but moves away from the data tooling already planned.
- **Full-stack Next.js:** less setup, but mixes interface, authorization, domain, ingestion and analytical processing in one runtime.
- **Python microservices from the start:** maximum isolation, at an operational cost that does not fit the current stage.

## Criteria for future extraction

A separate analysis service is created only if there is at least one observable driver: a need for independent scaling, jobs that hurt the transactional API, its own deploy cycle, separate ownership or incompatible runtime requirements. Until then, the boundaries are logical, inside the modular monolith.
