# MegaConvert Production Readiness Checklist

## Core user flow

- [ ] Upload works for single and batch mode.
- [ ] Conversion starts and reaches final status.
- [ ] Error state is visible and actionable.
- [ ] Download works for successful jobs.

## AI and UX

- [ ] AI panel renders recommendations.
- [ ] Intent and explainable hints are visible.
- [ ] Suggested next actions are actionable.
- [ ] Localization switch updates UI language.

## Preview, sharing, history

- [ ] Preview opens for supported formats.
- [ ] Share link can be created and opened.
- [ ] History list receives completed jobs.
- [ ] Public link expiry works as expected.

## Reliability and operations

- [ ] `/health` returns `ok: true`.
- [ ] `/health/worker` reports heartbeat.
- [ ] `/health/storage` reports writable state.
- [ ] `/health/ai` reports AI service status.
- [ ] `/metrics/ops` reports success/error/queue stats.

## Regression checks

- [ ] Run smoke: `node tests/operational-smoke.cjs`
- [ ] Run manual pre-release smoke suite: `docs/SMOKE_TESTS_PRE_RELEASE.md`
- [ ] Run frontend lint: `npm --prefix frontend run lint`
- [ ] Run conversion matrix: `node tests/verify-200-converters.cjs`
- [ ] Verify mobile layout for `/`, `/convert/*`, `/status`.
