# MegaConvert Platform Rollout Sprint Plan

Execution plan for implementing the engineering platform architecture in production increments.

## Planning Assumptions

- Sprint length: 2 weeks.
- Team: 2 backend, 1 frontend, 1 QA, 1 DevOps/SRE (shared).
- Priority scale: `P0` critical, `P1` high, `P2` normal.
- Release rule: each sprint ships behind feature flags when risk is medium/high.

## Sprint 1: Platform Foundation (P0)

Goal: create base contracts and persistence for platform services.

Backend:
- [P0] Apply DB extension: `docs/DB_SCHEMA_PLATFORM_EXTENSION_V2.sql`.
- [P0] Add event envelope standard (`event_id`, `correlation_id`, `event_type`, `payload`, `ts`).
- [P0] Add correlation-id middleware for API and worker.
- [P1] Add minimal repository layer for new tables.

Frontend:
- [P1] Add admin navigation placeholders for `Feature Flags`, `Experiments`, `System Health`.
- [P1] Add shared API client typing for new admin endpoints.

DevOps/SRE:
- [P0] Provision env vars and secrets for new services.
- [P1] Add migration runbook and rollback script.

QA:
- [P0] Smoke checks for migration + app boot + existing critical flows.

Definition of done:
- Migrations are reversible.
- Existing upload/convert/download flow is green.
- Correlation ID appears in API logs for all job endpoints.

## Sprint 2: Feature Flags + Rate Limits + Audit (P0)

Goal: runtime controls and security guardrails.

Backend:
- [P0] Implement `feature_flags` CRUD admin API.
- [P0] Add flag evaluation endpoint + SDK-ready response.
- [P0] Implement `rate_limit_policies` service (per user, per API key, burst).
- [P0] Enforce audit logging on all admin mutations (`audit_logs`).

Frontend:
- [P1] Build admin pages for flags list/edit/toggle.
- [P1] Add flag-aware rendering helper (`isEnabled(flagKey)`).
- [P1] Show rate-limit error states in UI with retry/backoff hint.

QA:
- [P0] Negative tests for unauthorized admin writes.
- [P0] Rate-limit behavior tests (allowed, throttled, reset window).

Definition of done:
- Flags can be toggled at runtime without deploy.
- Rate limit headers/errors are consistent.
- Admin write actions produce audit trail.

## Sprint 3: Replay + Debug Bundle (P1)

Goal: faster incident diagnosis and deterministic reruns.

Backend:
- [P1] Capture `job_snapshots` on create/start/failure.
- [P1] Implement replay endpoint to requeue from snapshot.
- [P1] Implement debug bundle export (snapshot + config + logs refs + trace ids).

Frontend:
- [P1] Add admin job details action: `Replay`.
- [P2] Add debug bundle download action in job details.

QA:
- [P1] Replay correctness tests (payload parity, idempotency, status path).
- [P1] Security test: replay/export restricted to permitted roles.

Definition of done:
- Failed job can be replayed in one click from admin.
- Debug bundle contains enough data for postmortem without DB access.

## Sprint 4: Experiments + Synthetic Monitoring (P1)

Goal: safe experimentation and proactive outage detection.

Backend:
- [P1] Implement `experiments` + `experiment_assignments` APIs.
- [P1] Add assignment engine (stable bucketing by subject id).
- [P1] Add synthetic scheduler for `upload -> convert -> download`.
- [P1] Persist synthetic outcomes to `synthetic_runs`.

Frontend:
- [P1] Admin experiments table (status, variants, traffic split).
- [P2] Basic experiment metrics panel (assignment and conversion counters).
- [P1] Health page widget for latest synthetic run status.

DevOps/SRE:
- [P1] Add cron/worker schedule for synthetic checks.

QA:
- [P1] Bucket consistency tests.
- [P1] Synthetic run failure and recovery tests.

Definition of done:
- Active experiment assignment is deterministic.
- Synthetic run failures are visible in admin within 1 minute.

## Sprint 5: Alerts + Observability Hardening (P0)

Goal: detect issues quickly and reduce MTTR.

Backend:
- [P0] Implement `alerts_rules` and `alerts_events` APIs.
- [P0] Add rules engine wiring from metrics/events to alert events.
- [P0] Add notification adapters (email + webhook/Slack).
- [P1] Add dedupe/cooldown to prevent alert storms.

Frontend:
- [P1] Admin alerts rules UI and recent events feed.
- [P2] System health dashboard summary cards (latency, success rate, queue depth).

DevOps/SRE:
- [P0] Configure notification channels and on-call routing.
- [P1] Set initial SLO thresholds and alert policies.

QA:
- [P0] Alert trigger tests from synthetic failures and API error spikes.

Definition of done:
- At least one synthetic failure automatically triggers notification.
- Alert history is queryable in admin.

## Sprint 6: Sandbox Routing + Admin Completion (P1)

Goal: isolated execution path and complete control-plane UX.

Backend:
- [P1] Add `sandbox=true` routing in orchestrator.
- [P1] Separate queue namespace + storage prefix for sandbox jobs.
- [P1] Add safety quotas for sandbox resources.

Frontend:
- [P1] Add sandbox launch toggle in admin/dev tools.
- [P2] Add clear labeling for sandbox job state and artifacts.

DevOps/SRE:
- [P1] Provision isolated worker pool and namespace policies.

QA:
- [P1] Validate prod and sandbox isolation (queue, storage, permissions).

Definition of done:
- Sandbox jobs never touch production queue/storage namespace.
- Admin can route replay/job to sandbox without code change.

## API Contracts (v1 Draft)

### Feature Flags

- `GET /admin/flags`
- `POST /admin/flags`
- `PATCH /admin/flags/:id`
- `DELETE /admin/flags/:id`
- `POST /flags/evaluate`

Request example:
```json
{
  "keys": ["ai_recommendations_v2", "sandbox_replay"],
  "subject": { "type": "user", "id": "u_123" },
  "env": "production"
}
```

Response example:
```json
{
  "flags": {
    "ai_recommendations_v2": true,
    "sandbox_replay": false
  }
}
```

### Experiments

- `GET /admin/experiments`
- `POST /admin/experiments`
- `PATCH /admin/experiments/:id`
- `POST /experiments/assign`

### Replay

- `POST /admin/jobs/:id/replay`
- `GET /admin/jobs/:id/snapshots`
- `GET /admin/jobs/:id/debug-bundle`

### Alerts

- `GET /admin/alerts/rules`
- `POST /admin/alerts/rules`
- `PATCH /admin/alerts/rules/:id`
- `GET /admin/alerts/events`

### Synthetic

- `POST /admin/synthetic/run`
- `GET /admin/synthetic/runs`
- `GET /admin/synthetic/runs/:id`

### Rate Limits

- `GET /admin/rate-limits/policies`
- `POST /admin/rate-limits/policies`
- `PATCH /admin/rate-limits/policies/:id`

## Cross-Sprint QA Gates

- Gate A (S2): no dead buttons in admin flags/rate-limit modules.
- Gate B (S4): replay + experiments + synthetic smoke pass.
- Gate C (S6): full pre-release smoke pass (`docs/SMOKE_TESTS_PRE_RELEASE.md`).

## Delivery Risks and Mitigations

- Risk: alert noise too high.
  - Mitigation: cooldown + dedupe + staged rule rollout by flag.
- Risk: replay causes duplicate side effects.
  - Mitigation: idempotency keys and side-effect guard markers.
- Risk: sandbox/prod cross-contamination.
  - Mitigation: strict queue/storage namespace checks in integration tests.

