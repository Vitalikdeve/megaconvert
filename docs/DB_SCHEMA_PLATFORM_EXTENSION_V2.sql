-- MegaConvert engineering platform schema extension (PostgreSQL)
-- Applies on top of docs/DB_SCHEMA_V1.sql

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percent INT NOT NULL DEFAULT 0 CHECK (rollout_percent >= 0 AND rollout_percent <= 100),
  rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  environment TEXT NOT NULL DEFAULT 'production',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_env_key ON feature_flags (environment, key);

CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  variants_json JSONB NOT NULL,
  targeting_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id UUID PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (experiment_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_assignments_subject ON experiment_assignments (subject_type, subject_id);

CREATE TABLE IF NOT EXISTS job_snapshots (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'create',
  payload_json JSONB NOT NULL,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  inputs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_snapshots_job_id ON job_snapshots (job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS alerts_rules (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  condition_json JSONB NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  channels_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  cooldown_sec INT NOT NULL DEFAULT 300,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts_events (
  id UUID PRIMARY KEY,
  rule_id UUID REFERENCES alerts_rules(id) ON DELETE SET NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'fired',
  message TEXT NOT NULL,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id TEXT,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_events_status ON alerts_events (status, fired_at DESC);

CREATE TABLE IF NOT EXISTS rate_limit_policies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  window_sec INT NOT NULL CHECK (window_sec > 0),
  max_requests INT NOT NULL CHECK (max_requests > 0),
  burst_max INT NOT NULL DEFAULT 0 CHECK (burst_max >= 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_feedback (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS synthetic_runs (
  id UUID PRIMARY KEY,
  scenario_key TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  latency_ms BIGINT,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_synthetic_runs_scenario_started ON synthetic_runs (scenario_key, started_at DESC);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  social_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

