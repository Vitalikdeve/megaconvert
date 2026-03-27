# ADR 0001: Modular Monolith with Internal Event Transport

## Status

Accepted

## Context

The product needs rich chat, meetings, notifications, search, files, and security workflows. Building these as separate services immediately would multiply operational complexity before domain contracts and scaling characteristics are proven.

## Decision

Use a modular monolith for synchronous product logic with three runtime processes:

- `apps/web`
- `apps/api`
- `apps/worker`

Inside the API, split functionality by bounded context and enforce layering. Use a PostgreSQL outbox plus worker processing for asynchronous effects.

## Consequences

### Positive

- domain changes remain fast while boundaries are still forming
- operational footprint remains manageable
- extraction remains possible because contracts and events are explicit

### Negative

- the API process still carries multiple bounded contexts initially
- strong discipline is required to prevent module entanglement

## Guardrails

- no cross-context repository imports
- no direct writes from worker into unrelated modules without an application-level use case
- no bypass of contracts for websocket payloads

