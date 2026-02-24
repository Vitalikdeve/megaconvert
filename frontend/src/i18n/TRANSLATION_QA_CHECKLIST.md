# Translation QA Checklist

Use this checklist before merging locale updates.

## Language Quality
- Text sounds natural for native speakers.
- No literal machine-like phrasing.
- Tone matches product style (clear, short, professional).

## Product Consistency
- Glossary terms are used consistently.
- Same concept has same wording across pages.
- Section labels match navigation labels.

## Technical Safety
- All placeholders are preserved (`{count}`, `{name}`).
- No broken JSON syntax.
- No missing keys compared to `en.json`.
- No extra unknown keys.

## UI Fit
- Buttons are not truncated.
- Nav items fit in desktop and mobile header.
- Alerts/toasts are readable and not oversized.
- Table headers and cards keep normal spacing.

## Critical Flows to Verify
- Account -> Billing -> Redeem promo code.
- Account -> Connected accounts.
- Account -> Security -> Sessions.
- Pricing page and plan labels.

## Automation
- Run:
  - `npm run i18n:check` for report (non-blocking).
  - `npm run i18n:check:strict` for CI/blocking mode.
