# MegaConvert Sprint 4 Execution Issues

Ready-to-create issues for Sprint 4 from `docs/PLATFORM_ROLLOUT_SPRINT_PLAN.md`.

## Sprint Goal

Enable safe experimentation and proactive outage detection with synthetic monitoring.

## Ticket Template Legend

- Priority: `P1` high, `P2` normal.
- Estimate: story points (`SP`).
- Owner: suggested role (`BE1`, `BE2`, `FE1`, `QA1`, `SRE1`).

## Issues

### S4-001 Experiments CRUD API (Admin)

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `BE1`
- Scope:
  - Implement:
    - `GET /admin/experiments`
    - `POST /admin/experiments`
    - `PATCH /admin/experiments/:id`
  - Support variants, traffic split, status (`draft`, `active`, `paused`, `completed`).
- Acceptance criteria:
  - CRUD operations pass integration tests.
  - Invalid split/variant payloads rejected with clear validation errors.
  - Active experiments are queryable by key.

### S4-002 Assignment Engine (Deterministic Bucketing)

- Priority: `P1`
- Estimate: `8 SP`
- Owner: `BE2`
- Scope:
  - Implement `POST /experiments/assign`.
  - Deterministic assignment by stable hash of subject id + experiment key.
  - Persist assignment in `experiment_assignments`.
- Acceptance criteria:
  - Repeated calls for same subject/experiment return same variant.
  - Traffic split approximates configured percentages under load sample.
  - Assignment failures are logged with correlation id.

### S4-003 Exposure and Outcome Event Tracking

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `BE1`
- Scope:
  - Emit events for experiment exposure and conversion outcomes.
  - Add minimal aggregation endpoint/source for admin metrics panel.
- Acceptance criteria:
  - Exposure and outcome counts are available per experiment/variant.
  - Events include experiment key and variant.

### S4-004 Synthetic Runner Service (Core Scenario)

- Priority: `P1`
- Estimate: `8 SP`
- Owner: `BE2`
- Scope:
  - Implement synthetic flow runner for `upload -> convert -> download`.
  - Persist run results in `synthetic_runs` (status, latency, error).
  - Tag runs with scenario key and environment.
- Acceptance criteria:
  - Manual trigger run completes end-to-end in staging.
  - Failed run stores actionable error details.
  - Runner has timeout guards and cleanup.

### S4-005 Synthetic Scheduler Integration

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `SRE1`
- Scope:
  - Configure scheduled execution (cron/worker schedule).
  - Ensure one active run lock to avoid overlaps.
- Acceptance criteria:
  - Runs execute on schedule in staging.
  - Overlapping runs are prevented.

### S4-006 Synthetic Admin APIs

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `BE1`
- Scope:
  - Implement:
    - `POST /admin/synthetic/run`
    - `GET /admin/synthetic/runs`
    - `GET /admin/synthetic/runs/:id`
- Acceptance criteria:
  - Manual trigger works and returns run id.
  - Runs list supports pagination and latest-first ordering.

### S4-007 Admin UI: Experiments Module

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `FE1`
- Scope:
  - Build experiments table with status and split.
  - Add create/edit flows and activate/pause controls.
  - Add loading/success/error feedback for all actions.
- Acceptance criteria:
  - No dead controls in experiments UI.
  - State updates without hard reload.
  - Invalid form input is blocked with validation messaging.

### S4-008 Admin UI: Synthetic Health Widget

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `FE1`
- Scope:
  - Show latest synthetic run status, latency, and timestamp.
  - Add quick link to run history page.
- Acceptance criteria:
  - Widget refreshes correctly and reflects latest run.
  - Failure state is visually explicit and readable.

### S4-009 Admin UI: Synthetic Runs History Page

- Priority: `P2`
- Estimate: `3 SP`
- Owner: `FE1`
- Scope:
  - Render runs table with status, duration, started/ended times.
  - Support drill-down to single run details.
- Acceptance criteria:
  - History view handles empty, loading, and error states.
  - Detail page shows error context when run fails.

### S4-010 SRE Dashboards for Experiments and Synthetic

- Priority: `P2`
- Estimate: `3 SP`
- Owner: `SRE1`
- Scope:
  - Add dashboard panels:
    - assignment volume by experiment
    - variant split
    - synthetic success rate
    - synthetic p95 latency
- Acceptance criteria:
  - Panels available and populated in staging.
  - Dashboard links documented for QA and on-call.

### S4-011 QA Validation Pack (Experiments + Synthetic)

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `QA1`
- Scope:
  - Validate deterministic assignment and split behavior.
  - Validate synthetic success/failure paths and admin visibility.
  - Validate critical user flow remains stable with active experiments.
- Acceptance criteria:
  - QA report includes deterministic assignment evidence.
  - Synthetic failure is visible in admin within SLA target.
  - No blocker regressions in conversion flow.

## Suggested Sprint Capacity Split

- Backend total: `27 SP`
- Frontend total: `11 SP`
- QA total: `5 SP`
- SRE total: `6 SP`
- Total: `49 SP`

## Sprint Exit Checklist

- Experiment assignment is deterministic and persisted.
- Synthetic runner executes on schedule and stores results.
- Admin can trigger/view synthetic runs and manage experiments.
- Core upload -> convert -> download remains green.
