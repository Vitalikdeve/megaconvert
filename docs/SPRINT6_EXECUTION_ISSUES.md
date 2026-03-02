# MegaConvert Sprint 6 Execution Issues

Ready-to-create issues for Sprint 6 from `docs/PLATFORM_ROLLOUT_SPRINT_PLAN.md`.

## Sprint Goal

Complete isolated sandbox routing and finalize admin control-plane workflows.

## Ticket Template Legend

- Priority: `P1` high, `P2` normal.
- Estimate: story points (`SP`).
- Owner: suggested role (`BE1`, `BE2`, `FE1`, `QA1`, `SRE1`).

## Issues

### S6-001 Orchestrator Sandbox Routing

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `BE1`
- Scope:
  - Add routing branch: `sandbox=true` -> sandbox queue namespace.
  - Preserve default production routing when sandbox flag is absent.
  - Include routing decision in job events/logs.
- Acceptance criteria:
  - Sandbox jobs always enter sandbox queue.
  - Production jobs are not rerouted accidentally.

### S6-002 Storage Namespace Isolation for Sandbox

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `BE2`
- Scope:
  - Add dedicated storage prefix/bucket namespace for sandbox inputs/results.
  - Enforce namespace at read/write paths.
- Acceptance criteria:
  - Sandbox artifacts never appear in production namespace.
  - Namespace policy covered by integration tests.

### S6-003 Sandbox Safety Quotas

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `BE2`
- Scope:
  - Add quota limits for sandbox jobs (count/size/runtime).
  - Emit clear errors when limits are exceeded.
- Acceptance criteria:
  - Over-limit sandbox requests fail gracefully.
  - Quota violations are observable in logs and metrics.

### S6-004 Replay-to-Sandbox Support

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `BE1`
- Scope:
  - Extend replay endpoint with optional `sandbox=true`.
  - Audit replay target environment.
- Acceptance criteria:
  - Admin can replay failed job directly to sandbox.
  - Replay audit includes target environment.

### S6-005 Admin UI: Sandbox Toggle for Job/Replay Actions

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `FE1`
- Scope:
  - Add sandbox toggle on relevant admin job actions.
  - Show explicit target environment before confirm.
- Acceptance criteria:
  - Toggle state is reflected in API request.
  - UI prevents ambiguous target execution.

### S6-006 Admin UI: Sandbox Job Labeling and Filters

- Priority: `P2`
- Estimate: `3 SP`
- Owner: `FE1`
- Scope:
  - Label sandbox jobs in lists/details.
  - Add filter by environment (`prod`, `sandbox`).
- Acceptance criteria:
  - Users can quickly distinguish sandbox vs production jobs.
  - Filtering works with pagination.

### S6-007 Provision Isolated Sandbox Worker Pool

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `SRE1`
- Scope:
  - Provision separate worker deployment/namespace for sandbox.
  - Apply queue and storage credentials scoped to sandbox.
- Acceptance criteria:
  - Sandbox workers cannot read production queue/storage credentials.
  - Deployment runbook updated.

### S6-008 Namespace Policies and Access Controls

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `SRE1`
- Scope:
  - Enforce network/storage policies that block cross-environment access.
  - Add policy validation checks in CI or deployment gate.
- Acceptance criteria:
  - Cross-env access attempts are blocked.
  - Policy checks produce pass/fail artifact.

### S6-009 Observability Split by Environment

- Priority: `P2`
- Estimate: `2 SP`
- Owner: `SRE1`
- Scope:
  - Add environment dimension to dashboards/metrics/log queries.
  - Provide quick view for sandbox error/latency trends.
- Acceptance criteria:
  - Dashboards can filter and compare `prod` vs `sandbox`.

### S6-010 QA Isolation Validation Pack

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `QA1`
- Scope:
  - Validate queue and storage isolation end-to-end.
  - Validate sandbox replay and admin flows.
  - Validate no regressions in production critical flows.
- Acceptance criteria:
  - QA evidence confirms zero cross-contamination.
  - Production upload -> convert -> download remains green.

## Suggested Sprint Capacity Split

- Backend total: `16 SP`
- Frontend total: `6 SP`
- QA total: `5 SP`
- SRE total: `10 SP`
- Total: `37 SP`

## Sprint Exit Checklist

- Sandbox jobs are isolated at queue and storage levels.
- Admin can intentionally route jobs/replays to sandbox.
- Environment-specific observability is available.
- Full pre-release smoke suite passes.

