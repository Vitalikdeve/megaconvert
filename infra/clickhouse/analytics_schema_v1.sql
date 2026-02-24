-- MegaConvert analytics schema v1 for search UX metrics.
-- Apply with:
--   clickhouse-client --multiquery < infra/clickhouse/analytics_schema_v1.sql

CREATE DATABASE IF NOT EXISTS megaconvert_analytics;
USE megaconvert_analytics;

-- 1) Raw append-only events (12 months retention).
CREATE TABLE IF NOT EXISTS analytics_events_raw
(
  ingest_time DateTime64(3, 'UTC') DEFAULT now64(3),
  event_id UUID DEFAULT generateUUIDv4(),
  event_name LowCardinality(String),
  event_time DateTime64(3, 'UTC') DEFAULT now64(3),
  session_id String,
  user_id Nullable(String),
  page LowCardinality(String) DEFAULT '',
  source LowCardinality(String) DEFAULT '',
  locale LowCardinality(String) DEFAULT '',
  device LowCardinality(String) DEFAULT '',
  ingestion_source LowCardinality(String) DEFAULT 'client',
  schema_version UInt16 DEFAULT 1,
  properties_json String DEFAULT '{}',
  request_id Nullable(String),
  ip_hash Nullable(FixedString(64)),
  user_agent Nullable(String)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_name, event_time, session_id, event_id)
TTL event_time + INTERVAL 12 MONTH DELETE
SETTINGS index_granularity = 8192;

-- 2) Typed normalized events (derived layer, no TTL).
CREATE TABLE IF NOT EXISTS analytics_events
(
  ingest_time DateTime64(3, 'UTC'),
  event_id UUID,
  event_name LowCardinality(String),
  event_time DateTime64(3, 'UTC'),
  event_date Date MATERIALIZED toDate(event_time),
  session_id String,
  user_id Nullable(String),
  page LowCardinality(String),
  source LowCardinality(String),
  locale LowCardinality(String),
  device LowCardinality(String),
  ingestion_source LowCardinality(String),
  schema_version UInt16,
  submit_method Nullable(LowCardinality(String)),
  redirect_reason Nullable(LowCardinality(String)),
  tool_id Nullable(LowCardinality(String)),
  query_raw Nullable(String),
  query_norm Nullable(String),
  from_format Nullable(LowCardinality(String)),
  to_format Nullable(LowCardinality(String)),
  parse_success UInt8,
  matches_count UInt8,
  redirected UInt8,
  latency_ms UInt32,
  properties_json String
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_name, event_time, session_id, event_id)
SETTINGS index_granularity = 8192;

-- 3) Materialized view raw -> normalized typed events.
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_events_mv
TO analytics_events
AS
SELECT
  ingest_time,
  event_id,
  event_name,
  event_time,
  session_id,
  nullIf(user_id, '') AS user_id,
  page,
  source,
  locale,
  device,
  ingestion_source,
  schema_version,
  nullIf(JSONExtractString(properties_json, 'submit_method'), '') AS submit_method,
  nullIf(JSONExtractString(properties_json, 'redirect_reason'), '') AS redirect_reason,
  nullIf(JSONExtractString(properties_json, 'tool_id'), '') AS tool_id,
  nullIf(JSONExtractString(properties_json, 'query_raw'), '') AS query_raw,
  nullIf(lowerUTF8(JSONExtractString(properties_json, 'query_norm')), '') AS query_norm,
  nullIf(
    lowerUTF8(
      coalesce(
        nullIf(JSONExtractString(properties_json, 'from_format'), ''),
        nullIf(JSONExtractString(properties_json, 'from'), '')
      )
    ),
    ''
  ) AS from_format,
  nullIf(
    lowerUTF8(
      coalesce(
        nullIf(JSONExtractString(properties_json, 'to_format'), ''),
        nullIf(JSONExtractString(properties_json, 'to'), '')
      )
    ),
    ''
  ) AS to_format,
  toUInt8(
    if(
      JSONHas(properties_json, 'parse_success'),
      JSONExtractBool(properties_json, 'parse_success'),
      0
    )
  ) AS parse_success,
  toUInt8(greatest(JSONExtractInt(properties_json, 'matches_count'), 0)) AS matches_count,
  toUInt8(
    if(
      JSONHas(properties_json, 'redirected'),
      JSONExtractBool(properties_json, 'redirected'),
      event_name = 'search_redirect'
    )
  ) AS redirected,
  toUInt32(greatest(JSONExtractInt(properties_json, 'latency_ms'), 0)) AS latency_ms,
  properties_json
FROM analytics_events_raw;

-- 4) Optional daily rollup for cheap dashboard cards.
CREATE TABLE IF NOT EXISTS analytics_search_daily
(
  event_date Date,
  locale LowCardinality(String),
  device LowCardinality(String),
  search_submit_count UInt64,
  search_parsed_success_count UInt64,
  search_results_count UInt64,
  search_results_zero_count UInt64,
  search_redirect_count UInt64,
  tool_open_from_search_count UInt64
)
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, locale, device)
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_search_daily_mv
TO analytics_search_daily
AS
SELECT
  toDate(event_time) AS event_date,
  locale,
  device,
  countIf(event_name = 'search_submit') AS search_submit_count,
  countIf(event_name = 'search_parsed' AND parse_success = 1) AS search_parsed_success_count,
  countIf(event_name = 'search_results') AS search_results_count,
  countIf(event_name = 'search_results' AND matches_count = 0) AS search_results_zero_count,
  countIf(event_name = 'search_redirect') AS search_redirect_count,
  countIf(event_name = 'tool_open' AND source = 'search') AS tool_open_from_search_count
FROM analytics_events
GROUP BY event_date, locale, device;
