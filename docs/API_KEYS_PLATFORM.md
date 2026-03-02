# MegaConvert API Keys Platform

## Goals
- Secure API access for external applications
- Request control via rate limits and monthly quotas
- Usage tracking for analytics/billing
- User and admin lifecycle management (create/revoke/regenerate/limit updates)

## Implemented Endpoints

### User account API keys
- `GET /account/api-keys`
- `POST /account/api-keys`
- `POST /account/api-keys/:id/revoke`
- `POST /account/api-keys/:id/regenerate`
- `PATCH /account/api-keys/:id/allowlist`

### User webhooks (per API key)
- `GET /account/api-webhooks`
- `GET /account/api-webhooks/deliveries?api_key_id=&limit=`
- `POST /account/api-webhooks`
- `PATCH /account/api-webhooks/:id`
- `DELETE /account/api-webhooks/:id`
- `POST /account/api-webhooks/:id/test`

### External API (API key auth required)
- `GET /api/keys/me`
- `POST /api/uploads/sign`
- `POST /api/convert`
- `GET /api/jobs/:id`

Auth header:
- `Authorization: Bearer mk_live_xxx` (or `x-api-key`)

### Admin API key operations
- `GET /admin/api-keys`
- `GET /admin/api-usage?range=24h|7d|30d`
- `PATCH /admin/api-keys/:id/limits`
- `POST /admin/api-keys/:id/revoke`
- `GET /admin/api-webhooks`
- `GET /admin/api-webhook-deliveries`
- `PATCH /admin/api-webhooks/:id`
- `DELETE /admin/api-webhooks/:id`

## Data model (file-backed runtime stores)
- `api_keys.json`
  - `id`, `user_id`, `key_hash`, `key_prefix`, `name`, `plan`
  - `rate_limit_per_min`, `quota_monthly`
  - `allowed_ips`
  - `created_at`, `last_used_at`, `revoked_at`, `expires_at`
- `api_usage.json`
  - `id`, `api_key_id`, `endpoint`, `status`
  - `response_time_ms`, `bytes_processed`, `month`, `created_at`
- `api_webhooks.json`
  - `id`, `api_key_id`, `user_id`, `url`, `events`, `is_active`, `secret`
  - `created_at`, `updated_at`
- `api_webhook_deliveries.json`
  - `id`, `webhook_id`, `api_key_id`, `event`, `status`, `error`, `dedupe_key`, `created_at`

## Security
- Tokens are never stored in plaintext (`sha256` hash only)
- Token value is returned once on create/regenerate
- Revoked/expired key checks on each request
- Optional per-key IP allowlist enforcement
- Signed webhook delivery (`x-megaconvert-signature`)
- Usage/audit logging on key lifecycle actions

## Limits
- Plan defaults:
  - `free`: `60 req/min`, `5000 / month`
  - `pro`: `300 req/min`, `100000 / month`
  - `enterprise`: `1200 req/min`, `1000000 / month`
- Per-key overrides supported from admin limits endpoint

## Request flow
1. API key extraction (`Authorization`/`x-api-key`)
2. Hash lookup and validity checks
3. Rate-limit and monthly quota checks
4. Route processing
5. Usage event append + key `last_used_at` update

## Frontend integration
- Account page `API` section: full key management UI
- Admin `API Usage` page: usage metrics + key controls
