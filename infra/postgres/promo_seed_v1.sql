-- Promo Codes v1 seed (PostgreSQL)
-- Usage:
--   psql "$DATABASE_URL" -f infra/postgres/promo_codes_v1.sql
--   psql "$DATABASE_URL" -f infra/postgres/promo_seed_v1.sql

BEGIN;

INSERT INTO promo_codes (
  code,
  benefit_type,
  benefit,
  max_redemptions,
  per_user_limit,
  starts_at,
  expires_at,
  is_active
) VALUES
  (
    'SEED_TRIAL_30',
    'trial_days',
    '{"trial_days":30}'::jsonb,
    500,
    1,
    now() - interval '1 day',
    now() + interval '365 day',
    true
  ),
  (
    'SEED_SAVE_20',
    'percent_discount',
    '{"percent":20}'::jsonb,
    200,
    1,
    now() - interval '1 day',
    now() + interval '90 day',
    true
  ),
  (
    'SEED_CREDITS_100',
    'credits',
    '{"credits":100}'::jsonb,
    1000,
    1,
    now() - interval '1 day',
    now() + interval '180 day',
    true
  ),
  (
    'SEED_FEATURE_BETA',
    'feature_access',
    '{"features":["beta_converter"],"scope":"global"}'::jsonb,
    NULL,
    1,
    now() - interval '1 day',
    NULL,
    true
  ),
  (
    'SEED_LIFETIME_PRO',
    'lifetime_access',
    '{"plan":"pro","lifetime":true}'::jsonb,
    25,
    1,
    now() - interval '1 day',
    now() + interval '30 day',
    true
  )
ON CONFLICT (code) DO UPDATE
SET
  benefit_type = EXCLUDED.benefit_type,
  benefit = EXCLUDED.benefit,
  max_redemptions = EXCLUDED.max_redemptions,
  per_user_limit = EXCLUDED.per_user_limit,
  starts_at = EXCLUDED.starts_at,
  expires_at = EXCLUDED.expires_at,
  is_active = EXCLUDED.is_active;

COMMIT;

