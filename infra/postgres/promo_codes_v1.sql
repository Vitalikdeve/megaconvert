-- Promo Codes v1 (PostgreSQL)
-- Usage:
--   psql "$DATABASE_URL" -f infra/postgres/promo_codes_v1.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  benefit_type TEXT NOT NULL CHECK (
    benefit_type IN ('percent_discount', 'trial_days', 'lifetime_access', 'credits', 'feature_access')
  ),
  benefit JSONB NOT NULL CHECK (jsonb_typeof(benefit) = 'object'),
  max_redemptions INT CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  per_user_limit INT NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
  redeemed_count INT NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (code = upper(code)),
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  idempotency_key TEXT,
  benefit_snapshot JSONB NOT NULL CHECK (jsonb_typeof(benefit_snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_promo_redemption_per_user UNIQUE (promo_code_id, user_id)
);

-- Enforce idempotency only when key is provided.
CREATE UNIQUE INDEX IF NOT EXISTS uq_redemptions_idem
ON promo_redemptions (idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_redemptions_promo_created
ON promo_redemptions (promo_code_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_redemptions_user_created
ON promo_redemptions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN ('discount', 'trial', 'lifetime', 'credits', 'feature_access')
  ),
  scope TEXT NOT NULL DEFAULT 'global',
  source_type TEXT NOT NULL CHECK (source_type IN ('promo_code')),
  source_id UUID NOT NULL REFERENCES promo_redemptions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CHECK (revoked_at IS NULL OR revoked_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_entitlements_user_active
ON user_entitlements (user_id, kind, revoked_at);

CREATE INDEX IF NOT EXISTS idx_entitlements_source
ON user_entitlements (source_type, source_id);

-- Optional business rule: one active lifetime entitlement per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_lifetime_entitlement
ON user_entitlements (user_id, kind)
WHERE revoked_at IS NULL AND kind = 'lifetime';

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promo_codes_updated_at ON promo_codes;
CREATE TRIGGER trg_promo_codes_updated_at
BEFORE UPDATE ON promo_codes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
