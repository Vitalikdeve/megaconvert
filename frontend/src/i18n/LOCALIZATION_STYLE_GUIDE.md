# MegaConvert Localization Style Guide

## Goal
- Write strings that read like native product copy, not literal translation.
- Keep the same product voice across all locales.

## Voice and Tone
- Voice: direct, clear, helpful.
- Tone: professional, calm, concise.
- Perspective: second person ("you").
- Keep sentences short and action-first.

## UI Writing Rules
- Buttons: verb-first and short (`Apply`, `Save profile`, `Upgrade`).
- Errors: plain language, no internal jargon.
- Success states: confirm action + user benefit.
- Empty states: explain what to do next.

## Consistency Rules
- Use one translation per product term.
- Keep key terminology consistent between pages (`Billing`, `Promo code`, `Connected accounts`).
- Do not mix formal and informal addressing styles inside one locale.

## Do and Don't
- Do: adapt phrasing to natural local wording.
- Do: keep placeholders exactly as in source (`{count}`, `{name}`).
- Do: preserve capitalization style of UI labels.
- Don't: translate placeholders or key names.
- Don't: expand short labels into long explanatory text.
- Don't: introduce technical terms not visible to the user.

## Length Guidance
- Button labels: up to 22 chars when possible.
- Nav labels: up to 24 chars when possible.
- Short labels: up to 42 chars when possible.

## QA Before Merge
- Check real UI on desktop and mobile.
- Verify no truncation or wrapping in buttons and nav.
- Confirm placeholders are preserved.
- Confirm glossary terms are used consistently.
