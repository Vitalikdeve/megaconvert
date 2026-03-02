# MegaConvert Sprint 3 Execution Issues

Ready-to-create issues for Sprint 3 from `docs/PLATFORM_ROLLOUT_SPRINT_PLAN.md`.

## Sprint Goal

Enable fast incident diagnostics with job snapshots, replay, and debug bundle export.

## Ticket Template Legend

- Priority: `P1` high, `P2` normal.
- Estimate: story points (`SP`).
- Owner: suggested role (`BE1`, `BE2`, `FE1`, `QA1`, `SRE1`).

## Issues

### S3-001 Snapshot Capture on Job Lifecycle

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `BE1`
- Scope:
  - Capture `job_snapshots` on `create`, `start`, `failure`.
  - Store payload/settings/inputs/correlation id.
  - Avoid storing sensitive plaintext by policy.
- Acceptance criteria:
  - Snapshot rows created for all three trigger types.
  - Sensitive fields are masked/redacted.
  - Snapshot insertion failures are logged and non-blocking to core flow.

### S3-002 Replay Endpoint (Requeue from Snapshot)

- Priority: `P1`
- Estimate: `8 SP`
- Owner: `BE2`
- Scope:
  - Implement `POST /admin/jobs/:id/replay`.
  - Use latest or selected snapshot to recreate job request.
  - Preserve correlation chain (`parent_correlation_id`).
- Acceptance criteria:
  - Replay creates a new job with link to source job/snapshot.
  - Idempotency guards prevent duplicate side effects.
  - Replay request/response contracts covered by integration tests.

### S3-003 Snapshots Query API

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `BE1`
- Scope:
  - Implement `GET /admin/jobs/:id/snapshots`.
  - Add pagination and basic filtering by trigger type.
- Acceptance criteria:
  - Snapshot list is returned sorted by time desc.
  - Empty state returns clean 200 with empty list.

### S3-004 Debug Bundle Assembly Service

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `BE2`
- Scope:
  - Build debug bundle payload from snapshot + effective config + log refs + trace ids.
  - Provide sanitized JSON export format.
- Acceptance criteria:
  - Bundle contains required sections and schema version.
  - Sensitive data redacted consistently.
  - Export completes within timeout budget.

### S3-005 Debug Bundle Download Endpoint

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `BE1`
- Scope:
  - Implement `GET /admin/jobs/:id/debug-bundle`.
  - Support JSON download with content-disposition.
- Acceptance criteria:
  - Endpoint returns downloadable file for authorized user.
  - Unauthorized requests return `403`.

### S3-006 RBAC Guardrails for Replay/Export

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `BE2`
- Scope:
  - Restrict replay/export to privileged roles.
  - Add audit entries for replay and export actions.
- Acceptance criteria:
  - Every replay/export action is audited with actor + timestamp.
  - Negative tests verify RBAC denial paths.

### S3-007 Admin UI: Replay Action on Job Details

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `FE1`
- Scope:
  - Add `Replay` button with confirmation and loading state.
  - Show success link to new replayed job.
- Acceptance criteria:
  - Replay action is clickable and produces visible outcome.
  - Errors are displayed with retry option.

### S3-008 Admin UI: Snapshot Timeline

- Priority: `P2`
- Estimate: `3 SP`
- Owner: `FE1`
- Scope:
  - Show snapshot timeline/list in job details.
  - Display trigger type, time, and correlation id.
- Acceptance criteria:
  - Timeline reflects API data and supports empty state.
  - No layout regressions on tablet/mobile.

### S3-009 Admin UI: Debug Bundle Download Action

- Priority: `P2`
- Estimate: `2 SP`
- Owner: `FE1`
- Scope:
  - Add `Download debug bundle` action.
  - Show progress, success, and error states.
- Acceptance criteria:
  - Download starts on click and returns valid JSON.
  - UI clearly reports failures.

### S3-010 Replay Observability Metrics

- Priority: `P2`
- Estimate: `2 SP`
- Owner: `SRE1`
- Scope:
  - Add counters: replay requests, replay success, replay failures.
  - Add latency metric for bundle export.
- Acceptance criteria:
  - Metrics visible in staging dashboards.
  - Alerts optional but dashboard panels present.

### S3-011 QA Validation Pack (Replay + Export)

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `QA1`
- Scope:
  - Validate replay correctness (payload parity + status path).
  - Validate debug bundle completeness and redaction.
  - Validate RBAC and audit coverage.
- Acceptance criteria:
  - One failed job successfully replayed end-to-end.
  - QA evidence includes exported bundle sample and audit entries.

## Suggested Sprint Capacity Split

- Backend total: `27 SP`
- Frontend total: `8 SP`
- QA total: `5 SP`
- SRE total: `2 SP`
- Total: `42 SP`

## Sprint Exit Checklist

- Replay from admin works for failed jobs.
- Debug bundle export is available and sanitized.
- Replay/export actions are RBAC-protected and audited.
- No regressions in upload -> convert -> download flow.
