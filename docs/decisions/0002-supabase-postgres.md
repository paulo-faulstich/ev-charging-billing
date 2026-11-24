# ADR 0002: Supabase as the managed PostgreSQL platform

**Status:** accepted

**Date:** 29 August 2026

## Context

The demo needs persistence, identity and file storage without running its own infrastructure. It should also be possible to move the database to another provider later.

## Decision

Use Supabase for PostgreSQL, Auth and Storage. The FastAPI backend reaches PostgreSQL through a standard connection with SQLAlchemy. Next.js does not query operational tables directly.

## Consequences

- Relational database, authentication and storage are available quickly.
- Replacing Supabase with another PostgreSQL should require connection and infrastructure changes, not domain changes.
- Business authorization stays in FastAPI. RLS protects the Supabase surfaces.
- The team has to manage connection pooling, migrations and service keys correctly.

## Alternatives considered

- Local PostgreSQL only: simple, but weakens the multi-user demo.
- Direct Next.js to Supabase access: fast, but spreads rules around and couples the product to the platform.
- Firebase: a good managed ecosystem, but it does not preserve the relational model already planned.
