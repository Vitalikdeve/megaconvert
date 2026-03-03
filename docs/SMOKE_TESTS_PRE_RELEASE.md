# MegaConvert Pre-Release Smoke Tests

## Scope

Critical checks that must pass before each release candidate goes live. Focus: upload/convert/download, auth, buttons/forms, navigation, API health, and fail-safe UX.

## Environment

- Frontend is running and reachable.
- API is running and reachable.
- Worker is connected.
- Test account exists for user and admin flows.
- Test file fixture available: `tests/fixtures/sample.txt`.

## Smoke Suite (15 Tests)

### SMK-01: App Boot and Main CTA Availability

Steps:
1. Open landing page `/`.
2. Wait for full render.
3. Verify primary CTAs are visible and enabled (`Upload`, `Convert` when applicable).

Expected result:
- Page loads without fatal UI error.
- Primary CTAs are clickable.
- No blocking error banner shown on first paint.

Fail signal:
- Blank screen, console/runtime crash UI, or disabled primary CTA without reason.

### SMK-02: Upload Button Triggers File Picker

Steps:
1. Click `Upload`.
2. Select `tests/fixtures/sample.txt`.

Expected result:
- Native file picker opens on click.
- Selected file appears in UI state (name/size/list item/chip).

Fail signal:
- Click does nothing or selected file not reflected in UI.

### SMK-03: Convert Action Creates Job

Steps:
1. Complete required conversion selections.
2. Click `Convert`.

Expected result:
- Loading/progress state appears immediately.
- Job is created (job id or status view visible).
- Duplicate submit is prevented while request is in-flight.

Fail signal:
- No loading state, no status transition, or repeated clicks create unstable behavior.

### SMK-04: Successful Conversion Completes and Enables Download

Steps:
1. Run one valid conversion end-to-end.
2. Wait for completion state.
3. Click `Download`.

Expected result:
- Status reaches success/completed.
- Download starts and returns non-empty file.

Fail signal:
- Stuck pending/processing, or download action unavailable on successful job.

### SMK-05: Conversion Failure Path and Retry

Steps:
1. Trigger a known invalid conversion input (or simulate backend conversion error).
2. Observe error UI.
3. Click `Retry` (if provided).

Expected result:
- Clear, user-facing error message is displayed.
- Retry action is available and re-attempts conversion.

Fail signal:
- Silent failure, cryptic crash, or retry action absent/non-functional.

### SMK-06: Navigation Integrity (Core Routes)

Steps:
1. Navigate `Home -> Tools`.
2. Navigate `Home -> Developers`.
3. Navigate `Dashboard -> Users` (authorized account).
4. Use browser back once after each transition.

Expected result:
- Each route opens correct page content.
- Layout remains stable (no overlap/broken shell).
- Back navigation restores prior route.

Fail signal:
- 404/blank route, broken layout, or broken back navigation.

### SMK-07: Login Form Validation and Submit

Steps:
1. Open login page.
2. Submit with empty required fields.
3. Submit with valid credentials.

Expected result:
- Inline validation shown for empty/invalid inputs.
- Valid submit authenticates and redirects to expected post-login view.

Fail signal:
- Form submits invalid data silently or valid login cannot proceed.

### SMK-08: Admin “Add User” Form

Steps:
1. Open admin users page.
2. Click `Add user`.
3. Fill mandatory fields and submit.

Expected result:
- Submit triggers API request.
- Success feedback displayed.
- New user appears in users table/list.

Fail signal:
- Submit does nothing, request fails silently, or list is not updated.

### SMK-09: Admin “Add Developer” + Image Upload

Steps:
1. Open developers/admin content section.
2. Click `Add developer`.
3. Fill required fields.
4. Upload image.
5. Click `Save`.

Expected result:
- Image upload succeeds and preview/reference is shown.
- Save persists record and new card/row appears.

Fail signal:
- Upload button is dead, save returns no visible result, or created entity not visible.

### SMK-10: AI Recommendation Apply Action

Steps:
1. Upload supported file for AI suggestions.
2. Open AI panel.
3. Click `Apply recommendation`.

Expected result:
- Recommendation is rendered.
- Apply action triggers configured conversion/job creation.
- UI reflects selected AI parameters.

Fail signal:
- Recommendation button clickable but no downstream action.

### SMK-11: Save Preset Action

Steps:
1. Configure conversion settings.
2. Click `Save preset`.
3. Reload page/session and reopen presets.

Expected result:
- Preset save success feedback shown.
- Preset is available after reload.

Fail signal:
- No confirmation or preset missing after refresh.

### SMK-12: API Key Creation Flow

Steps:
1. Go to API key management page.
2. Click `Create API key`.
3. Confirm/create and copy key.

Expected result:
- New key is generated exactly once.
- Success state and copy affordance work.
- Key metadata appears in list/history.

Fail signal:
- Button non-functional, duplicate unexpected keys, or no visible created key state.

### SMK-13: Endpoint Operational Health

Steps:
1. Run `node tests/operational-smoke.cjs`.
2. Review result status for all health endpoints.

Expected result:
- `Operational smoke checks passed.`
- Endpoints return healthy responses: `/health`, `/health/worker`, `/health/storage`, `/health/ai`, `/metrics/ops`.

Fail signal:
- Script exits non-zero or any endpoint marked `BAD`/`ERR`.

### SMK-14: Graceful Degradation When API Is Unavailable

Steps:
1. Temporarily stop API or point frontend to unreachable API base.
2. Attempt one action (`Convert` or `Save`).

Expected result:
- User gets explicit error/fallback message.
- UI remains interactive; no app crash.
- User can retry when service is restored.

Fail signal:
- Infinite spinner, hard crash, or silent no-op.

### SMK-15: Responsive Smoke (Mobile/Tablet/Desktop)

Steps:
1. Check core pages on mobile, tablet, desktop widths.
2. Repeat quick path: open page, click main CTA, open nav, submit one simple form.

Expected result:
- No clipped controls or inaccessible buttons.
- Navigation and primary forms remain usable on all breakpoints.

Fail signal:
- Hidden/off-screen critical controls or unusable interaction on any target viewport.

## Release Gate

Release candidate passes smoke only if:
- All 15 smoke tests pass.
- No blocker/critical defect remains open.
- Core upload -> convert -> download flow is green on at least one desktop and one mobile viewport.
