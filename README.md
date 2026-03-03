# MegaConvert

Production-structured monorepo with separated frontend, API, and worker.

Enterprise + AI baseline blueprint: `ENTERPRISE_PLATFORM_BLUEPRINT.md`
Production checklist: `PRODUCTION_READINESS_CHECKLIST.md`
Implementation rollout blueprint: `IMPLEMENTATION_BLUEPRINT.md`
Engineering platform architecture: `docs/ENGINEERING_PLATFORM_ARCHITECTURE.md`
Platform rollout sprint plan: `docs/PLATFORM_ROLLOUT_SPRINT_PLAN.md`
Sprint 1 execution issues: `docs/SPRINT1_EXECUTION_ISSUES.md`
Sprint 2 execution issues: `docs/SPRINT2_EXECUTION_ISSUES.md`
Sprint 3 execution issues: `docs/SPRINT3_EXECUTION_ISSUES.md`
Sprint 4 execution issues: `docs/SPRINT4_EXECUTION_ISSUES.md`
Sprint 5 execution issues: `docs/SPRINT5_EXECUTION_ISSUES.md`
Sprint 6 execution issues: `docs/SPRINT6_EXECUTION_ISSUES.md`
Jira import CSV (S1-S6): `docs/JIRA_IMPORT_PLATFORM_BACKLOG.csv`
Jira import guide: `docs/JIRA_IMPORT_INSTRUCTIONS.md`
SEO growth package: `docs/SEO_GROWTH_PACKAGE.md`
SEO execution backlog: `docs/SEO_EXECUTION_BACKLOG.md`
Audience growth feature matrix: `docs/AUDIENCE_GROWTH_FEATURE_MATRIX.md`
Audience growth execution issues: `docs/AUDIENCE_GROWTH_EXECUTION_ISSUES.md`
Audience growth Jira CSV: `docs/AUDIENCE_GROWTH_JIRA_IMPORT.csv`
Audience growth Jira import guide: `docs/AUDIENCE_GROWTH_JIRA_IMPORT_INSTRUCTIONS.md`
API keys platform design and endpoints: `docs/API_KEYS_PLATFORM.md`
Admin design package: `docs/ADMIN_DESIGN_PACKAGE.md`
DB schema draft: `docs/DB_SCHEMA_V1.sql`
DB platform extension: `docs/DB_SCHEMA_PLATFORM_EXTENSION_V2.sql`
OpenAPI draft: `docs/openapi.yaml`
User flows: `docs/USER_FLOWS.md`
Design stability spec: `docs/DESIGN_STABILITY_SPEC.md`

## Structure
- `frontend/` Vercel (React/Vite SPA)
- `api/` Fly/Render (API, queue producer)
- `worker/` Fly/Render (queue consumer + converters)
- `shared/` shared schemas/constants

## Local Dev (recommended)
From repo root:
```powershell
powershell -ExecutionPolicy Bypass -File infra/scripts/dev-up.ps1 -WithFrontend
```

Check status:
```powershell
powershell -ExecutionPolicy Bypass -File infra/scripts/dev-status.ps1
```

Stop local services:
```powershell
powershell -ExecutionPolicy Bypass -File infra/scripts/dev-down.ps1
```

## Toolchain requirements
- `ffmpeg` for audio/video converters
- `magick` (ImageMagick) for image converters
- `soffice` (LibreOffice) for PDF/DOCX/XLSX/PPTX converters
- `tesseract` for OCR converters

If `soffice` is missing, document converters will fail even when API/Redis/MinIO are healthy.

### Windows dependency bootstrap
To check/install worker dependencies on Windows host:
```powershell
powershell -ExecutionPolicy Bypass -File infra/scripts/ensure-worker-deps.ps1 -InstallMissing
```
This script also copies `tessdata/rus.traineddata` into system Tesseract (if available) for `eng+rus` OCR.

## Converter Matrix Check (200/200)
Run this from repo root to verify frontend/API/worker are aligned and every tool has a worker conversion strategy:
```powershell
node tests/verify-200-converters.cjs
```

## Operational smoke checks
Run backend health/control checks:
```powershell
node tests/operational-smoke.cjs
```
Run extended platform checks (flags/share presets/audit/settings):
```powershell
$env:MC_STRICT_EXTENDED='1'; node tests/operational-smoke.cjs
```

Run frontend smoke verification (SEO + lint + prerender):
```powershell
npm --prefix frontend run verify:smoke
```
Run interaction guard (fails on button/link stubs):
```powershell
npm --prefix frontend run check:interactions
```

## Analytics (ClickHouse)
- Schema (raw + normalized + materialized views): `infra/clickhouse/analytics_schema_v1.sql`
- Monitoring queries for 2-week Search UX validation: `infra/clickhouse/metrics_2week.sql`
- Apply schema:
```powershell
clickhouse-client --multiquery < infra/clickhouse/analytics_schema_v1.sql
```
- API ingestion is wired to `POST /events` when `CLICKHOUSE_URL` is set in `api/.env` (buffered batch inserts).
- Main envs: `ANALYTICS_ENABLED`, `CLICKHOUSE_URL`, `CLICKHOUSE_DATABASE` (or `CLICKHOUSE_DB`), `CLICKHOUSE_TABLE`, `ANALYTICS_BATCH_SIZE`, `ANALYTICS_FLUSH_INTERVAL_MS`.
- Fallback analytics backend (works without ClickHouse): `ANALYTICS_USE_FALLBACK`, `ANALYTICS_FALLBACK_FILE`, `ANALYTICS_FALLBACK_MAX_ROWS`, `ANALYTICS_FALLBACK_INGEST_ENABLED`.
- Admin metrics endpoints: `GET /admin/metrics/overview`, `GET /admin/metrics/search?range=24h|7d|30d`.
- Admin posts engagement endpoint: `GET /admin/metrics/posts?range=24h|7d|30d`.
- Admin promo analytics endpoint: `GET /admin/metrics/promo?range=24h|7d|30d`.
- Admin auth endpoints: `POST /admin/auth/login`, `POST /admin/auth/logout`, `GET /admin/auth/me`.
- Admin auth envs: `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`, `ADMIN_SESSION_TTL_SEC`, `ADMIN_COOKIE_NAME`, `ADMIN_COOKIE_SECURE`.
- Admin posts CRUD: `GET /admin/posts`, `POST /admin/posts`, `PATCH /admin/posts/:id`, `DELETE /admin/posts/:id`.
- Admin posts storage envs: `ADMIN_POSTS_FILE`, `ADMIN_POST_TITLE_MAX_LEN`, `ADMIN_POST_EXCERPT_MAX_LEN`, `ADMIN_POST_CONTENT_MAX_LEN`.
- Public posts endpoints: `GET /posts`, `GET /posts/:slug`.
- Likes endpoints: `GET /posts/:id/likes`, `POST /posts/:id/like` (requires `x-user-id`).
- Likes envs: `POST_LIKES_FILE`, `POST_LIKE_RATE_LIMIT_PER_MIN`.

## Promo Codes (PostgreSQL draft)
- DDL: `infra/postgres/promo_codes_v1.sql`
- Account identity DDL: `infra/postgres/account_identity_v1.sql`
- Seed data: `infra/postgres/promo_seed_v1.sql`
- Redeem transaction flow: `infra/postgres/promo_redeem_flow_v1.md`
- Redeem endpoint: `POST /promo/redeem` (requires `x-user-id` for current auth mode)
- Account billing endpoint: `GET /account/billing` (returns plan summary, active benefits, promo history; requires `x-user-id`)
- Account profile endpoints: `GET /account/profile`, `PATCH /account/profile` (requires `x-user-id`)
- Connected accounts endpoints: `GET /account/connections`, `POST /account/connections/:provider/link`, `DELETE /account/connections/:provider` (requires `x-user-id`)
- Sessions endpoints: `GET /account/sessions`, `DELETE /account/sessions/:id`, `POST /account/sessions/logout-all` (requires `x-user-id` + `x-session-id`)
- Telegram link endpoint: `POST /account/telegram/link-code` (generates a one-time code for linking website account with Telegram bot)
- Telegram link envs (API): `BOT_INTERNAL_API_BASE`, `BOT_INTERNAL_LINK_SECRET`, `ACCOUNT_TELEGRAM_CODE_LENGTH`, `ACCOUNT_TELEGRAM_CODE_TTL_SEC`, `ACCOUNT_TELEGRAM_INTERNAL_TIMEOUT_MS`
- Redeem request payload: `{ "code": "SAVE20", "idempotency_key": "optional-key" }`
- Admin promo CRUD: `GET /admin/promo-codes`, `POST /admin/promo-codes`, `PATCH /admin/promo-codes/:id`, `DELETE /admin/promo-codes/:id`
- Main envs: `PROMO_CODES_ENABLED` (`1/0/true/false`, default `true`), `DATABASE_URL` (or `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `PG_CONNECTION_STRING`), `PROMO_QUERY_TIMEOUT_MS`, `PROMO_DB_POOL_MAX`, `PROMO_TRIAL_MAX_DAYS`, `PROMO_ADMIN_LIST_LIMIT`
- Note: current v1 schema allows one redemption per user per promo (`UNIQUE (promo_code_id, user_id)`).
- Quick smoke:
```powershell
psql "$env:DATABASE_URL" -f infra/postgres/promo_codes_v1.sql
psql "$env:DATABASE_URL" -f infra/postgres/account_identity_v1.sql
psql "$env:DATABASE_URL" -f infra/postgres/promo_seed_v1.sql
psql "$env:DATABASE_URL" -c "SELECT code, benefit_type, is_active FROM promo_codes ORDER BY code;"
curl -i -X POST http://localhost:3000/promo/redeem -H "Content-Type: application/json" -H "x-user-id: test-user-1" -d "{\"code\":\"SEED_TRIAL_30\",\"idempotency_key\":\"seed-smoke-1\"}"
psql "$env:DATABASE_URL" -c "SELECT count(*) AS redemptions FROM promo_redemptions;"
```

## Localization QA
- Style guide: `frontend/src/i18n/LOCALIZATION_STYLE_GUIDE.md`
- Glossary: `frontend/src/i18n/GLOSSARY.md`
- Translation checklist: `frontend/src/i18n/TRANSLATION_QA_CHECKLIST.md`
- Validation commands:
```powershell
npm --prefix frontend run i18n:check
npm --prefix frontend run i18n:check:strict
```

## Notes
- `api/` and `worker/` each include a local `shared/` copy for runtime. Source of truth is `shared/` at repo root.
- Vercel rewrite routes `/api/*` to `https://34.58.90.6.nip.io/*`.
- Frontend API target can be forced via `VITE_API_BASE` (default in production config: `/api`).
- Optional direct fallback is `VITE_DIRECT_API_FALLBACK` (set only for local debugging).

