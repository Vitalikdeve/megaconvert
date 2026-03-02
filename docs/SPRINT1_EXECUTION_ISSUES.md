# MegaConvert Sprint 1 Execution Issues

Ready-to-create issues for Sprint 1 from `docs/PLATFORM_ROLLOUT_SPRINT_PLAN.md`.

## Sprint Goal

Ship platform foundation: DB extension, event envelope, correlation IDs, base repositories, and admin placeholders without regressions in core conversion flow.

## Ticket Template Legend

- Priority: `P0` critical, `P1` high.
- Estimate: story points (`SP`).
- Owner: suggested role (`BE1`, `BE2`, `FE1`, `QA1`, `SRE1`).

## Issues

### S1-001 Apply Platform DB Extension Migration

- Priority: `P0`
- Estimate: `5 SP`
- Owner: `BE1`
- Scope:
  - Add migration for `docs/DB_SCHEMA_PLATFORM_EXTENSION_V2.sql`.
  - Ensure idempotent and reversible migration scripts.
  - Validate index creation and foreign keys.
- Acceptance criteria:
  - Migration applies successfully on clean and existing DB.
  - Rollback script restores pre-migration state without orphan objects.
  - Migration execution documented in runbook.

### S1-002 Define and Enforce Event Envelope Standard

- Priority: `P0`
- Estimate: `5 SP`
- Owner: `BE2`
- Scope:
  - Introduce shared event schema with fields: `event_id`, `correlation_id`, `event_type`, `payload`, `ts`.
  - Update event publishers (API + worker-facing producers) to use standard envelope.
  - Add schema validation for event publish path.
- Acceptance criteria:
  - All new emitted events match schema.
  - Invalid envelope is rejected with clear error.
  - Unit tests cover valid/invalid event payloads.

### S1-003 Correlation ID Middleware for API

- Priority: `P0`
- Estimate: `3 SP`
- Owner: `BE1`
- Scope:
  - Add request middleware that accepts incoming `x-correlation-id` or generates new UUID.
  - Attach correlation id to request context and structured logs.
  - Return correlation id in response headers.
- Acceptance criteria:
  - Every API request log contains `correlation_id`.
  - Response includes `x-correlation-id`.
  - Existing endpoints behavior unchanged.

### S1-004 Correlation ID Propagation to Worker Jobs

- Priority: `P0`
- Estimate: `3 SP`
- Owner: `BE2`
- Scope:
  - Propagate correlation id from API job creation into queue payload.
  - Ensure worker logs include same correlation id across job lifecycle.
- Acceptance criteria:
  - One job traceable end-to-end by single correlation id.
  - Worker logs and API logs can be joined by `correlation_id`.

### S1-005 Base Repository Layer for Platform Tables

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `BE1`
- Scope:
  - Implement minimal repository methods for:
    - `feature_flags`
    - `experiments`
    - `job_snapshots`
    - `alerts_rules`
    - `rate_limit_policies`
  - Add basic CRUD/insertion operations used in later sprints.
- Acceptance criteria:
  - Repositories covered by unit tests for happy path + not-found handling.
  - No direct SQL usage outside repository for these entities in new code.

### S1-006 Admin Navigation Placeholders (Flags/Experiments/Health)

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `FE1`
- Scope:
  - Add left-nav entries in admin SPA:
    - Feature Flags
    - Experiments
    - System Health
  - Add placeholder pages with loading/error empty states.
- Acceptance criteria:
  - Routes open without 404.
  - Navigation works on desktop and mobile breakpoints.
  - Placeholder pages are RBAC-protected.

### S1-007 Shared Admin API Client Contracts (Type Stubs)

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `FE1`
- Scope:
  - Add typed client interfaces for upcoming endpoints:
    - `/admin/flags`
    - `/admin/experiments`
    - `/admin/alerts/*`
    - `/admin/synthetic/*`
  - Add response and error types for consistent UI handling.
- Acceptance criteria:
  - Types compile and are imported by placeholder pages.
  - No `any` usage for new admin platform payloads.

### S1-008 Provision Env/Secrets for Platform Foundation

- Priority: `P0`
- Estimate: `3 SP`
- Owner: `SRE1`
- Scope:
  - Add environment variables and secret placeholders for platform services.
  - Update deployment config templates for all environments.
  - Document secure secret rotation path.
- Acceptance criteria:
  - Dev/staging/prod config keys defined and versioned in templates.
  - Secrets are not committed in plaintext.

### S1-009 Migration Runbook and Rollback Procedure

- Priority: `P1`
- Estimate: `2 SP`
- Owner: `SRE1`
- Scope:
  - Write step-by-step migration runbook with prechecks/postchecks.
  - Include rollback flow and safety conditions.
- Acceptance criteria:
  - Runbook can be executed by on-call without tribal knowledge.
  - Includes explicit verification SQL checks.

### S1-010 QA Foundation Validation Pack

- Priority: `P0`
- Estimate: `5 SP`
- Owner: `QA1`
- Scope:
  - Validate no regressions in critical flow `upload -> convert -> download`.
  - Validate correlation id presence across API and worker logs.
  - Execute pre-release smoke subset for routes and core actions.
- Acceptance criteria:
  - Core conversion path passes.
  - Correlation id trace collected for at least one successful and one failed job.
  - QA report attached with pass/fail and blockers.

## Suggested Sprint Capacity Split

- Backend total: `16 SP`
- Frontend total: `6 SP`
- QA total: `5 SP`
- SRE total: `5 SP`
- Total: `32 SP`

## Sprint Exit Checklist

- All `P0` issues completed.
- No blocker regression in conversion flow.
- Migration and rollback tested in staging.
- Correlation id visible in logs for API + worker.
