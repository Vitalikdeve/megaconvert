# MegaConvert Enterprise Feature Map

## Overview
This document maps the "20 production features" into the current MegaConvert stack and the API contracts added in this iteration.

## Core Architecture
- Frontend: `frontend/src` (converter UI, account, admin, assistant UX, batch, history, status pages)
- API Gateway: `api/src/index.js`
- Queue + orchestrator: BullMQ queue `convert` + worker processors
- Worker isolation: `worker/src/worker.js` with per-job timeout, format checks, synthetic checks
- Data: Redis + PostgreSQL + S3/MinIO

## Newly Added Contracts

### 1) Job idempotency
- `POST /jobs`
- Accepts `Idempotency-Key` header or `idempotency_key` body field.
- Repeated request with same key returns the same `jobId` (`idempotency_reused: true`).

### 2) Job dedupe by checksum
- `POST /jobs`
- Supports `checksum` / `inputHash` for single job, and `items[].checksum` for batch.
- If same user submits same tool+settings+checksum set within dedupe TTL, existing `jobId` is reused (`dedupe_reused: true`).

### 3) Realtime progress over SSE
- `GET /jobs/:id/events`
- Server-Sent Events stream with `event: job`.
- Payload includes `status`, `progress`, `downloadUrl`, `error`, `outputMeta`.
- Stream closes automatically on terminal state.

### 4) Upload hash cache (file dedupe)
- `POST /uploads/resolve-hash` with `{ sha256 }`
- `POST /uploads/register-hash` with `{ sha256, inputKey }`
- Proxy uploads (`POST /uploads/proxy`) now register hash cache automatically.

### 5) Tool-based assistant endpoint
- `POST /account/assistant/respond`
- Returns:
  - recommended `tool`, `target_format`, `settings`
  - estimates (`duration_sec`, `output_size`)
  - explicit tool actions (`recommend_settings`, `estimate_job`, `list_formats`, `create_job`, `get_job_status`, `explain_error`)
- Supports `auto_create_job: true` for direct action.

### 6) Smart file intelligence + preset generation
- `POST /account/file-intelligence/analyze`
- `POST /account/presets/generate`
- Input can include: extension, dimensions, codec, bitrate, duration, pages, alpha channel.
- Output includes intent, category, target format, recommended tool, settings, constraints, estimated output size.

### 7) Queue-aware autoscaling recommendation
- `GET /health/queue`
- `GET /internal/autoscaler/recommendation`
- Returns queue depth and calculated `desired_workers` with policy metadata (`min/max`, backlog targets).

### 8) Worker recovery + adaptive compression
- `worker/src/worker.js`
- Adaptive compression:
  - `compress-video` now uses multi-pass CRF selection toward target size.
  - `compress-pdf` now evaluates multiple Ghostscript profiles and picks best candidate.
- Automatic recovery strategies:
  - fallback ffmpeg profile for media failures,
  - fallback Ghostscript rasterization for PDF image extraction,
  - fallback text-extraction path for PDF->DOCX,
  - fallback rasterization path for SVG conversions.

### 9) Massive parallel batch execution
- `worker/src/worker.js`
- Batch items are processed in parallel with configurable worker-side limit (`WORKER_BATCH_CONCURRENCY`).
- Per-item isolated temp dirs + numbered outputs to avoid collisions.
- Job response metadata includes batch parallelism and recovered item count.

## Frontend Integration Added
- Conversion payload now includes deterministic `idempotency_key`.
- Single conversion payload now forwards `checksum`.
- Job creation sends `Idempotency-Key` header.
- Job polling now attempts SSE first (`/jobs/:id/events`) with automatic fallback to polling.
- Upload adapter now:
  - computes SHA-256 (bounded by size limit),
  - tries `/uploads/resolve-hash` before upload,
  - registers hash via `/uploads/register-hash` after upload.

## Feature Coverage (20-point list)
- Covered in stack (existing + current update):
  - unified pipeline, batch, queue priorities, idempotency, dedupe, preview, version-safe history, team workspaces/RBAC, signed delivery, TTL primitives, telemetry/audit, integrations, Telegram bot path, entitlements/billing, assistant actions.
- Operationally present:
  - worker health, synthetic checks, status/metrics pages, automation rules, API usage tracking.

## Notes
- SSE is enabled by default in frontend adapter; can be disabled via `VITE_DISABLE_JOB_SSE=1`.
- Upload hash dedupe is bounded by `VITE_UPLOAD_HASH_DEDUPE_MAX_BYTES` on client and `UPLOAD_HASH_COMPUTE_MAX_BYTES` on API.
