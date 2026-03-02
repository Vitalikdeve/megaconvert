# MegaConvert Engineering Platform Architecture

Unified production architecture for product delivery, reliability, and engineering operations.

## 0. Architecture Principles

- Event-driven: all critical actions emit domain events.
- Async-first: heavy workloads run through queues/workers.
- Config-driven: feature flags, limits, and experiments are runtime-configurable.
- Observability-by-default: metrics, logs, and traces are first-class.
- Isolation-first: conversion execution can be routed to sandboxed resources.

## 1. High-Level Topology

`Client -> API Gateway -> Core Services -> Queue/Orchestrator -> Workers -> Storage -> Event Bus -> Observability + Dev Platform -> Admin/Dev Console`

## 2. Domains and Services

### 2.1 Core Platform

- Auth Service
- User Service
- File Service
- Job Service
- Preset/Workflow Service

Primary data stores:
- PostgreSQL for operational entities.
- Object storage for source/result files.

### 2.2 Processing Layer

- Queue: Redis/Kafka/Rabbit-compatible abstraction.
- Orchestrator: routing, retries, idempotency, priority.
- Worker pool: isolated converter executors.

Mandatory runtime controls:
- Retry policy with exponential backoff.
- Idempotency key support for job creation.
- Resource limits per job and per worker.

## 3. Dev Platform Services

### 3.1 Feature Flags Service

- Flags API + DB (`feature_flags` table).
- Frontend/backend SDK with local cache.
- Targeting by environment, user segment, and rollout percentage.

### 3.2 Experimentation Service (A/B)

- Experiment config registry (`experiments`).
- Assignment engine (`experiment_assignments`).
- Metrics collector for experiment outcomes.

### 3.3 Job Replay Service

- Snapshot capture on job create/start (`job_snapshots`).
- Replay endpoint to rerun with historical payload/settings.
- Snapshot references to logs/traces for postmortem.

### 3.4 Sandbox Environment

- Dedicated queue namespace for sandbox jobs.
- Dedicated worker pool and storage namespace.
- Routing rule: `sandbox=true` -> sandbox queue path.

## 4. Observability Stack

- Metrics service: success rate, latency, queue depth, error rate.
- Logging service: structured logs with `correlation_id`.
- Distributed tracing: end-to-end request/job spans.
- Alerting engine: rules + notifications + dedupe windows.

## 5. Synthetic Monitoring

- Periodic synthetic E2E: `upload -> convert -> download`.
- Track uptime, SLA/SLO conformance, and p95 performance.
- Persist run artifacts in `synthetic_runs`.

## 6. Smart Alerts

Pipeline:
- Metrics/Events -> Rules Engine -> Alert Events -> Notification service.

Channels:
- Email
- Slack/webhooks

## 7. Internal Dev Tools

- Dev Console modules: live state, toggles, replay launch, debug drill-down.
- Debug bundle export: job payload + effective config + logs + trace references.

## 8. Audit and Compliance

- Audit log service for who/what/when.
- Append-only DB records + optional immutable object storage export.
- Admin actions, security-sensitive operations, and config changes must be audited.

## 9. Rate Limit and Quota

- Per-user and per-API-key budgets.
- Burst control via Redis counters.
- Policy engine (`rate_limit_policies`) for tier-specific limits.

## 10. Content/CMS and Team Profiles

- Content modules: blocks, pages, team.
- Team profile service: CRUD, slug routes, social links.
- Media assets stored in object storage; metadata in PostgreSQL.

## 11. Admin and Dev Console

Modules:
- Dashboard
- Operations
- Analytics
- Feature Flags
- Experiments
- Team
- Content
- System Health
- Logs
- Security

Implementation shape:
- Frontend SPA (`frontend/src/admin/*`).
- Admin API with RBAC enforcement.

## 12. Security Layer

- RBAC permissions for admin/dev operations.
- API key lifecycle management and revocation.
- Secret storage via environment/secret manager.
- WAF + API-level rate limiting.

## 13. Data Flow (Job + Observability)

`Upload -> Job Service -> Queue -> Worker -> Result -> Event Bus -> Metrics/Logs/Alerts/Replay Snapshot`

## 14. Deployment and Scale

- Containerized services (Docker).
- Orchestrated deployment (Kubernetes target).
- CI/CD with blue-green or canary rollout.
- Horizontal worker autoscaling by queue depth.
- CDN-backed file/result delivery.

## 15. Reliability Patterns

- Retries with bounded backoff.
- Circuit breakers for unstable dependencies.
- Bulkheads between critical subsystems.
- Graceful degradation for non-critical failures.

## 16. Rollout Plan (Pragmatic)

1. Platform foundation:
   - Add DB extension tables and service contracts.
   - Standardize event envelope and correlation ID.
2. Controls layer:
   - Implement feature flags + rate limits.
   - Introduce audit logging for admin mutations.
3. Observability layer:
   - Emit metrics/logs/traces for all job lifecycle events.
   - Add synthetic monitoring scheduler and alert rules.
4. Dev productivity layer:
   - Add replay endpoints and debug bundle export.
   - Expand admin console with flags/experiments/health.
5. Hardening:
   - Enable sandbox routing.
   - Validate SLOs and run pre-release smoke suite.

## 17. Success Criteria

- No dead interactive paths in critical user flows.
- Runtime flags can control risky feature rollout.
- On incident, engineers can replay jobs and inspect full context quickly.
- Health, synthetic runs, and alerts catch regressions before user impact.
