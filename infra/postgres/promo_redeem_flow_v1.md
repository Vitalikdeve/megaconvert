# Promo Redeem Flow v1

This document defines a race-safe redeem flow for:

- `POST /promo/redeem`
- `promo_codes`, `promo_redemptions`, `user_entitlements`

## Input

- `user_id` (trusted auth identity, never from arbitrary client payload)
- `code` (promo code string)
- `idempotency_key` (optional)

## Output

- Success:
  - `success: true`
  - `redemption_id`
  - `benefit` (applied entitlement payload)
  - `already_redeemed` (boolean)
- Failure:
  - `PROMO_NOT_FOUND`
  - `PROMO_INACTIVE`
  - `PROMO_EXPIRED`
  - `PROMO_NOT_STARTED`
  - `PROMO_LIMIT_REACHED`
  - `PROMO_USER_LIMIT_REACHED`
  - `PROMO_BENEFIT_INVALID`

## Transaction Strategy

- Use one DB transaction.
- Lock promo row with `FOR UPDATE`.
- Keep the lock until redemption insert + entitlement insert finish.
- Enforce uniqueness with DB constraints:
  - `UNIQUE (promo_code_id, user_id)`
  - partial unique index for non-null `idempotency_key`

Isolation level:

- `READ COMMITTED` is sufficient when promo row is locked and all mutations occur in one transaction.

## SQL-Oriented Pseudocode

```sql
BEGIN;

-- 0) Normalize input code once
-- code_norm := upper(trim(:code))

-- 1) Idempotency short-circuit (optional)
-- If idempotency key was seen before, return the same result.
SELECT r.id, r.promo_code_id, r.user_id, r.benefit_snapshot
FROM promo_redemptions r
WHERE r.idempotency_key = :idempotency_key
FOR UPDATE;

-- If row exists:
--   COMMIT;
--   return success(already_redeemed=true, redemption=row)

-- 2) Lock promo row
SELECT *
FROM promo_codes
WHERE code = :code_norm
FOR UPDATE;

-- If not found => ROLLBACK + PROMO_NOT_FOUND
-- If is_active=false => ROLLBACK + PROMO_INACTIVE
-- If starts_at is in future => ROLLBACK + PROMO_NOT_STARTED
-- If expires_at is in past => ROLLBACK + PROMO_EXPIRED

-- 3) Validate redemption limits
SELECT count(*) AS total_uses
FROM promo_redemptions
WHERE promo_code_id = :promo_id;

-- if max_redemptions is not null and total_uses >= max_redemptions:
--   ROLLBACK + PROMO_LIMIT_REACHED

SELECT count(*) AS user_uses
FROM promo_redemptions
WHERE promo_code_id = :promo_id
  AND user_id = :user_id;

-- if user_uses >= per_user_limit:
--   ROLLBACK + PROMO_USER_LIMIT_REACHED

-- 4) Build entitlement from promo.benefit_type + promo.benefit (app layer)
-- Example mappings:
--   percent_discount -> kind='discount'
--   trial_days       -> kind='trial', ends_at=now()+N days
--   lifetime_access  -> kind='lifetime', ends_at=null
--   credits          -> kind='credits'
--   feature_access   -> kind='feature_access'

-- 5) Insert redemption (idempotent/race-safe)
INSERT INTO promo_redemptions (
  id, promo_code_id, user_id, idempotency_key, benefit_snapshot
)
VALUES (
  gen_random_uuid(), :promo_id, :user_id, :idempotency_key, :benefit_snapshot::jsonb
)
ON CONFLICT (promo_code_id, user_id) DO NOTHING
RETURNING id, benefit_snapshot;

-- if no row returned:
--   -- already redeemed by same user in parallel request
--   SELECT id, benefit_snapshot
--   FROM promo_redemptions
--   WHERE promo_code_id = :promo_id AND user_id = :user_id
--   FOR UPDATE;
--   COMMIT;
--   return success(already_redeemed=true, redemption=existing)

-- 6) Insert entitlement
INSERT INTO user_entitlements (
  id, user_id, kind, scope, source_type, source_id, payload, starts_at, ends_at
)
VALUES (
  gen_random_uuid(),
  :user_id,
  :entitlement_kind,
  :entitlement_scope,
  'promo_code',
  :redemption_id,
  :entitlement_payload::jsonb,
  :entitlement_starts_at,
  :entitlement_ends_at
);

-- 7) Optional denormalized counter update
-- NOTE: may be derived instead of stored; stored value can drift on partial failures.
UPDATE promo_codes
SET redeemed_count = redeemed_count + 1
WHERE id = :promo_id;

COMMIT;
```

## Benefit Validation (minimum app checks)

Before inserts:

- `percent_discount`: `0 < percent <= 100`
- `trial_days`: positive integer (recommended cap e.g. `<= 365`)
- `lifetime_access`: `{ "plan": "<plan_id>", "lifetime": true }`
- `credits`: positive integer
- `feature_access`: non-empty list of feature keys

If invalid -> rollback with `PROMO_BENEFIT_INVALID`.

## Recommended Endpoint Behavior

- Normalize code to uppercase.
- Never trust `user_id` from body; read from authenticated session/JWT.
- Treat duplicate redeem for same user as idempotent success (not hard error).
- Emit analytics event:
  - `promo_redeem_attempt`
  - `promo_redeem_success`
  - `promo_redeem_failed` (with reason code)
