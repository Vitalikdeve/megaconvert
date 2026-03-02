# MegaConvert Sprint 5 Execution Issues

Ready-to-create issues for Sprint 5 from `docs/PLATFORM_ROLLOUT_SPRINT_PLAN.md`.

## Sprint Goal

Reduce MTTR with smart alerting, notification delivery, and hardened observability workflows.

## Ticket Template Legend

- Priority: `P0` critical, `P1` high, `P2` normal.
- Estimate: story points (`SP`).
- Owner: suggested role (`BE1`, `BE2`, `FE1`, `QA1`, `SRE1`).

## Issues

### S5-001 Alert Rules CRUD API

- Priority: `P0`
- Estimate: `5 SP`
- Owner: `BE1`
- Scope:
  - Implement:
    - `GET /admin/alerts/rules`
    - `POST /admin/alerts/rules`
    - `PATCH /admin/alerts/rules/:id`
  - Validate severity, conditions, cooldown, and channel definitions.
- Acceptance criteria:
  - CRUD passes integration tests.
  - Invalid rules are rejected with stable validation errors.

### S5-002 Rules Engine Evaluation Pipeline

- Priority: `P0`
- Estimate: `8 SP`
- Owner: `BE2`
- Scope:
  - Evaluate incoming metrics/events against active rules.
  - Produce `alerts_events` with correlation to source signal.
  - Support threshold and rate-of-change predicates.
- Acceptance criteria:
  - Matching conditions produce alert events reliably.
  - Non-matching signals do not produce false positives.

### S5-003 Alert Dedupe and Cooldown Controls

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `BE2`
- Scope:
  - Add dedupe key strategy.
  - Enforce cooldown windows from rule config.
- Acceptance criteria:
  - Duplicate events within cooldown are suppressed.
  - Suppression behavior is observable in logs/metrics.

### S5-004 Notification Delivery Adapters (Email + Webhook/Slack)

- Priority: `P0`
- Estimate: `5 SP`
- Owner: `BE1`
- Scope:
  - Implement notification fan-out for enabled channels.
  - Add retry with bounded backoff and dead-letter marker.
- Acceptance criteria:
  - Fired alert reaches configured channels.
  - Delivery failures are retried and logged.

### S5-005 Alert Events Query API

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `BE1`
- Scope:
  - Implement `GET /admin/alerts/events` with filters by severity/status/time range.
- Acceptance criteria:
  - Events list is pageable and sorted by fired time desc.
  - Filters return correct subsets.

### S5-006 Admin UI: Alert Rules Management

- Priority: `P1`
- Estimate: `5 SP`
- Owner: `FE1`
- Scope:
  - Build rules list and create/edit form.
  - Add enable/disable toggle and feedback states.
- Acceptance criteria:
  - All rule actions are interactive and persisted.
  - Validation errors are shown inline.

### S5-007 Admin UI: Recent Alert Events Feed

- Priority: `P1`
- Estimate: `3 SP`
- Owner: `FE1`
- Scope:
  - Build events table with severity badges, status, and timestamps.
  - Add quick filters and event detail drawer.
- Acceptance criteria:
  - New alerts appear without full page reload.
  - Event details include source context and correlation id.

### S5-008 System Health Dashboard Summary Cards

- Priority: `P2`
- Estimate: `3 SP`
- Owner: `FE1`
- Scope:
  - Add cards for success rate, queue depth, error rate, and p95 latency.
- Acceptance criteria:
  - Cards render current values with fallback state on API outage.
  - No layout break across desktop/tablet/mobile.

### S5-009 On-Call Notification Routing Setup

- Priority: `P0`
- Estimate: `3 SP`
- Owner: `SRE1`
- Scope:
  - Configure webhook/email routes for staging and production.
  - Document ownership/escalation rules.
- Acceptance criteria:
  - Test alert reaches on-call channels in staging.
  - Routing docs stored and discoverable.

### S5-010 Initial SLO Threshold and Alert Policy Pack

- Priority: `P1`
- Estimate: `2 SP`
- Owner: `SRE1`
- Scope:
  - Define initial threshold values for latency, error rate, and synthetic failures.
  - Create baseline alert rules in staging.
- Acceptance criteria:
  - Baseline rules are active and versioned.
  - Threshold rationale documented.

### S5-011 QA Validation Pack (Alerts + Notifications)

- Priority: `P0`
- Estimate: `5 SP`
- Owner: `QA1`
- Scope:
  - Trigger synthetic/API failure conditions and verify alert creation.
  - Verify channel delivery and dedupe behavior.
  - Verify admin visibility for rules/events.
- Acceptance criteria:
  - At least one auto-fired alert is delivered to channel.
  - QA evidence includes fired event id and delivery proof.

## Suggested Sprint Capacity Split

- Backend total: `24 SP`
- Frontend total: `11 SP`
- QA total: `5 SP`
- SRE total: `5 SP`
- Total: `45 SP`

## Sprint Exit Checklist

- Alert rules are manageable from admin.
- Alert firing pipeline works from signal to notification.
- Dedupe/cooldown prevents alert storms.
- System health summary and alert events are visible in admin.

