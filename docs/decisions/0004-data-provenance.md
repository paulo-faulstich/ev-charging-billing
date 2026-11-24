# ADR 0004: Explicit provenance for real, assigned and simulated data

**Status:** accepted

**Date:** 29 August 2026

## Context

SEMS+ provides real energy and timestamps, but the observed history does not provide a reliable identity. The demo has to fill in user and unit without presenting that association as GoodWe telemetry.

## Decision

Persist the source, batch and raw record of every session. Identity fields carry a confidence level, and the interface distinguishes `real`, `assigned`, `simulated`, `derived` and `external` data.

## Consequences

- The solution stays honest about the limits of the integration.
- Invoices and insights can be audited back to their origin.
- The interface has to communicate provenance without overloading the user.
- The model stores additional metadata and assignment events.

## Alternatives considered

- Filling simulated identities directly into the CSV: simple, but mixes evidence with demonstration.
- Ignoring users and billing per charger only: does not solve the shared-building problem.
- Blocking any session without RFID: would prevent demonstrating the flow with the data available.
