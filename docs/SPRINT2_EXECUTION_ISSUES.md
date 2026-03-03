# MegaConvert Sprint 2 Execution Issues

Ready-to-create issues for Sprint 2 from `docs/PLATFORM_ROLLOUT_SPRINT_PLAN.md`.

## Sprint Goal

Deliver runtime controls and security guardrails: feature flags, rate limits, and mandatory audit logging for admin mutations.

## Ticket Template Legend

- Priority: `P0` critical, `P1` high.
- Estimate: story points (`SP`).
- Owner: suggested role (`BE1`, `BE2`, `FE1`, `QA1`, `SRE1`).

## Issues

### S2-001 Feature Flags CRUD API (Admin)

- Priority: `P0`
- Estimate: `5 SP`
- Owner: `BE1`
- Scope:
  - Implement endpoints:
    - `GET /admin/flags`
    - `POST /admin/flags`
    - `PATCH /admin/flags/:id`
    - `DELETE /admin/flags/:id`
  - Support environment scoping and rollout percentage.
  - Validate payloads and prevent duplicate flag keys.
- Acceptance criteria:
  - CRUD operations pass integration tests.
  - Invalid payload returns validation errors with stable format.
  - Deleted flags are not returned by list endpoint.

### S2-002 Flags Evaluation Endpoint (Runtime)

- Priority: `P0`
- Estimate: `5 SP`
- Owner: `BE2`
- Scope:
  - Implement `POST /flags/evaluate`.
  - Accept keys + subject context (`type`, `id`) + environment.
  - Return deterministic evaluation for same input and flag config.
- Acceptance criteria:
  - Endpoint responds within agreed SLO for p95.
  - Deterministic behavior verified by repeat tests.
  - Unknown keys return explicit false/absent policy.

### S2-003 Feature Flag Cache Layer

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `BE2`
- Scope:
  - Add in-memory/Redis-backed cache for flag reads.
  - Add cache invalidation on flag mutation.
  - Add cache metrics (`hit`, `miss`, `stale`).
- Acceptance criteria:
  - Cache hit ratio visible in metrics.
  - Mutated flags become visible without restart.
  - No stale config beyond configured TTL.

### S2-004 Rate Limit Policy Engine (Per User/API Key/Burst)

- Priority: `P0`
- Estimate: `8 SP`
- Owner: `BE1`
- Scope:
  - Implement policy lookup from `rate_limit_policies`.
  - Enforce limits using Redis counters/window semantics.
  - Support per-user and per-API key scopes.
  - Add burst handling and fallback behavior when Redis is degraded.
- Acceptance criteria:
  - Limited requests return `429` with clear error payload.
  - Allow/deny behavior matches configured policy windows.
  - Fallback mode is explicit and logged.

### S2-005 Standard Rate Limit Headers and Error Contract

- Priority: `P0`
- Estimate: `3 SP`
- Owner: `BE2`
- Scope:
  - Add response headers on protected endpoints (`X-RateLimit-*`, `Retry-After`).
  - Standardize `429` error body for frontend handling.
- Acceptance criteria:
  - Headers present and correct on both allowed and limited responses.
  - Frontend can reliably parse retry timeout.

### S2-006 Audit Log Enforcement for Admin Mutations

- Priority: `P0`
- Estimate: `5 SP`
- Owner: `BE1`
- Scope:
  - Wrap admin mutation handlers with audit write middleware/hook.
  - Persist who/what/when and target metadata into `audit_logs`.
  - Include correlation id for traceability.
- Acceptance criteria:
  - Every admin write action creates one audit record.
  - Audit record includes actor, action, target, timestamp.
  - Missing actor context is rejected or marked by policy.

### S2-007 Admin Feature Flags UI (List/Edit/Toggle)

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `FE1`
- Scope:
  - Build flags list table with search/filter by env.
  - Add create/edit modal and enable toggle.
  - Show save loading, success, and error states.
- Acceptance criteria:
  - User can create, edit, toggle, and delete flags from UI.
  - UI reflects backend updates without hard reload.
  - No dead buttons in flags module.

### S2-008 Frontend Flag Evaluation Helper Integration

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `FE1`
- Scope:
  - Implement `isEnabled(flagKey, context)` helper using evaluate endpoint.
  - Add fallback for API timeout/unavailable scenarios.
  - Wire helper into at least one non-critical gated feature.
- Acceptance criteria:
  - Feature gate behavior matches backend evaluation.
  - API failure falls back safely without UI crash.

### S2-009 Rate Limit UX Handling

- Priority: `P1`
- Estimate: `2 SP`
- Owner: `FE1`
- Scope:
  - Add standardized UI handling for `429` responses.
  - Show retry timing and action guidance.
- Acceptance criteria:
  - Users see clear limit feedback (not generic failure).
  - Retry becomes available after timeout window.

### S2-010 Security/RBAC Hardening for New Admin Endpoints

- Priority: `P0`
- Estimate: `3 SP`
- Owner: `BE2`
- Scope:
  - Enforce RBAC on all new `/admin/flags` operations.
  - Add role-based negative tests.
- Acceptance criteria:
  - Unauthorized users receive `403`.
  - No privilege escalation path for flag mutations.

### S2-011 Observability for Controls Layer

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `SRE1`
- Scope:
  - Add dashboards for flag evaluate latency and rate-limit reject count.
  - Add logs/alerts for sudden `429` spikes.
- Acceptance criteria:
  - Dashboard panels available in staging.
  - Spike alert triggers under load-test threshold.

### S2-012 QA Validation Pack for Controls Layer

- Priority: `P0`
- Estimate: `5 SP`
- Owner: `QA1`
- Scope:
  - End-to-end tests for flag CRUD + evaluate + UI behavior.
  - Rate-limit scenarios: below limit, at limit, above limit, after reset.
  - Audit completeness checks for admin writes.
- Acceptance criteria:
  - All `P0` flows pass in staging.
  - QA report includes proof for audit coverage and rate-limit contracts.

## Suggested Sprint Capacity Split

- Backend total: `29 SP`
- Frontend total: `10 SP`
- QA total: `5 SP`
- SRE total: `3 SP`
- Total: `47 SP`

## Sprint Exit Checklist

- All `P0` issues completed.
- Feature flag runtime toggling works without deploy.
- Rate-limit enforcement and headers validated.
- Admin write actions are fully audited.
- No blocker defects in controls layer modules.
