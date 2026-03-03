-- MegaConvert 2-week monitoring queries for Search UX.
-- Replace the date window in each query before running.
-- Example:
--   from_ts = '2026-02-01 00:00:00'
--   to_ts   = '2026-02-15 00:00:00'

USE megaconvert_analytics;

-- Optional pre-check:
-- SELECT ingestion_source, count() FROM analytics_events
-- WHERE event_time >= from_ts AND event_time < to_ts
-- GROUP BY ingestion_source;
-- If both native search_* events and legacy expansion coexist, you can exclude:
--   AND ingestion_source != 'legacy_expand'
-- in the metrics below.

-- 1) Adoption: % sessions with search.
WITH
  toDateTime64('2026-02-01 00:00:00', 3, 'UTC') AS from_ts,
  toDateTime64('2026-02-15 00:00:00', 3, 'UTC') AS to_ts
SELECT
  search_sessions,
  total_sessions,
  round(100.0 * search_sessions / nullIf(total_sessions, 0), 2) AS adoption_pct
FROM
(
  SELECT
    uniqExactIf(session_id, event_name = 'search_submit') AS search_sessions,
    uniqExact(session_id) AS total_sessions
  FROM analytics_events
  WHERE event_time >= from_ts
    AND event_time < to_ts
);

-- 2) Parse rate: % searches with successful format parsing.
WITH
  toDateTime64('2026-02-01 00:00:00', 3, 'UTC') AS from_ts,
  toDateTime64('2026-02-15 00:00:00', 3, 'UTC') AS to_ts
SELECT
  parsed_success_events,
  submit_events,
  round(100.0 * parsed_success_events / nullIf(submit_events, 0), 2) AS parse_rate_pct
FROM
(
  SELECT
    countIf(event_name = 'search_parsed' AND parse_success = 1) AS parsed_success_events,
    countIf(event_name = 'search_submit') AS submit_events
  FROM analytics_events
  WHERE event_time >= from_ts
    AND event_time < to_ts
);

-- 3) Search -> tool open conversion (session-level, 30 min window).
WITH
  toDateTime64('2026-02-01 00:00:00', 3, 'UTC') AS from_ts,
  toDateTime64('2026-02-15 00:00:00', 3, 'UTC') AS to_ts,
  toDateTime64('1970-01-01 00:00:00', 3, 'UTC') AS epoch
SELECT
  search_sessions,
  converted_sessions,
  round(100.0 * converted_sessions / nullIf(search_sessions, 0), 2) AS conversion_pct
FROM
(
  SELECT
    count() AS search_sessions,
    countIf(converted = 1) AS converted_sessions
  FROM
  (
    SELECT
      session_id,
      minIf(event_time, event_name = 'search_submit') AS first_submit_at,
      minIf(event_time, event_name = 'tool_open' AND source = 'search') AS first_tool_open_at,
      toUInt8(
        first_tool_open_at > epoch
        AND first_tool_open_at >= first_submit_at
        AND first_tool_open_at <= first_submit_at + toIntervalMinute(30)
      ) AS converted
    FROM analytics_events
    WHERE event_time >= from_ts
      AND event_time < to_ts
      AND event_name IN ('search_submit', 'tool_open')
    GROUP BY session_id
    HAVING first_submit_at > epoch
  )
);

-- 4) Auto-redirect performance.
-- Success proxy: no new search_submit in same session within 30 seconds after redirect.
WITH
  toDateTime64('2026-02-01 00:00:00', 3, 'UTC') AS from_ts,
  toDateTime64('2026-02-15 00:00:00', 3, 'UTC') AS to_ts,
  toDateTime64('1970-01-01 00:00:00', 3, 'UTC') AS epoch
SELECT
  redirects,
  total_submits,
  round(100.0 * redirects / nullIf(total_submits, 0), 2) AS redirect_share_pct,
  successful_redirects,
  round(100.0 * successful_redirects / nullIf(redirects, 0), 2) AS redirect_success_pct
FROM
(
  SELECT
    count() AS redirects,
    countIf(no_back_navigation = 1) AS successful_redirects
  FROM
  (
    SELECT
      r.session_id,
      r.event_time AS redirect_at,
      min(s.event_time) AS next_submit_at,
      toUInt8(
        next_submit_at = epoch
        OR next_submit_at > redirect_at + toIntervalSecond(30)
      ) AS no_back_navigation
    FROM
    (
      SELECT session_id, event_time
      FROM analytics_events
      WHERE event_time >= from_ts
        AND event_time < to_ts
        AND event_name = 'search_redirect'
    ) AS r
    LEFT JOIN
    (
      SELECT session_id, event_time
      FROM analytics_events
      WHERE event_time >= from_ts
        AND event_time < to_ts + toIntervalMinute(10)
        AND event_name = 'search_submit'
    ) AS s
      ON s.session_id = r.session_id
      AND s.event_time > r.event_time
      AND s.event_time <= r.event_time + toIntervalMinute(10)
    GROUP BY r.session_id, redirect_at
  )
) AS rr
CROSS JOIN
(
  SELECT count() AS total_submits
  FROM analytics_events
  WHERE event_time >= from_ts
    AND event_time < to_ts
    AND event_name = 'search_submit'
) AS ss;

-- 5) Zero-result rate.
WITH
  toDateTime64('2026-02-01 00:00:00', 3, 'UTC') AS from_ts,
  toDateTime64('2026-02-15 00:00:00', 3, 'UTC') AS to_ts
SELECT
  zero_results,
  total_results,
  round(100.0 * zero_results / nullIf(total_results, 0), 2) AS zero_result_pct
FROM
(
  SELECT
    countIf(event_name = 'search_results' AND matches_count = 0) AS zero_results,
    countIf(event_name = 'search_results') AS total_results
  FROM analytics_events
  WHERE event_time >= from_ts
    AND event_time < to_ts
);

-- 6) Time to tool: first search input -> first search-driven tool open per session.
WITH
  toDateTime64('2026-02-01 00:00:00', 3, 'UTC') AS from_ts,
  toDateTime64('2026-02-15 00:00:00', 3, 'UTC') AS to_ts,
  toDateTime64('1970-01-01 00:00:00', 3, 'UTC') AS epoch
SELECT
  quantileExact(0.5)(seconds_to_open) AS median_seconds,
  quantileExact(0.75)(seconds_to_open) AS p75_seconds,
  quantileExact(0.95)(seconds_to_open) AS p95_seconds
FROM
(
  SELECT
    session_id,
    dateDiff('second', first_input_at, first_tool_open_at) AS seconds_to_open
  FROM
  (
    SELECT
      session_id,
      minIf(event_time, event_name = 'search_input') AS first_input_at,
      minIf(event_time, event_name = 'tool_open' AND source = 'search') AS first_tool_open_at
    FROM analytics_events
    WHERE event_time >= from_ts
      AND event_time < to_ts
      AND event_name IN ('search_input', 'tool_open')
    GROUP BY session_id
  )
  WHERE first_input_at > epoch
    AND first_tool_open_at > first_input_at
    AND first_tool_open_at <= first_input_at + toIntervalMinute(30)
);

-- 7a) Top normalized queries.
WITH
  toDateTime64('2026-02-01 00:00:00', 3, 'UTC') AS from_ts,
  toDateTime64('2026-02-15 00:00:00', 3, 'UTC') AS to_ts
SELECT
  query_norm,
  count() AS submits
FROM analytics_events
WHERE event_time >= from_ts
  AND event_time < to_ts
  AND event_name = 'search_submit'
  AND query_norm IS NOT NULL
  AND query_norm != ''
GROUP BY query_norm
ORDER BY submits DESC
LIMIT 20;

-- 7b) Top FROM formats (successful parses).
WITH
  toDateTime64('2026-02-01 00:00:00', 3, 'UTC') AS from_ts,
  toDateTime64('2026-02-15 00:00:00', 3, 'UTC') AS to_ts
SELECT
  from_format,
  count() AS hits
FROM analytics_events
WHERE event_time >= from_ts
  AND event_time < to_ts
  AND event_name = 'search_parsed'
  AND parse_success = 1
  AND from_format IS NOT NULL
  AND from_format != ''
GROUP BY from_format
ORDER BY hits DESC
LIMIT 20;

-- 7c) Top TO formats (successful parses).
WITH
  toDateTime64('2026-02-01 00:00:00', 3, 'UTC') AS from_ts,
  toDateTime64('2026-02-15 00:00:00', 3, 'UTC') AS to_ts
SELECT
  to_format,
  count() AS hits
FROM analytics_events
WHERE event_time >= from_ts
  AND event_time < to_ts
  AND event_name = 'search_parsed'
  AND parse_success = 1
  AND to_format IS NOT NULL
  AND to_format != ''
GROUP BY to_format
ORDER BY hits DESC
LIMIT 20;

-- Stage 3 decision helper:
-- ready when adoption >= 20, conversion >= 50, zero_result <= 15.
WITH
  toDateTime64('2026-02-01 00:00:00', 3, 'UTC') AS from_ts,
  toDateTime64('2026-02-15 00:00:00', 3, 'UTC') AS to_ts,
  adoption_pct AS
  (
    SELECT round(
      100.0 * uniqExactIf(session_id, event_name = 'search_submit') / nullIf(uniqExact(session_id), 0),
      2
    )
    FROM analytics_events
    WHERE event_time >= from_ts
      AND event_time < to_ts
  ),
  conversion_pct AS
  (
    SELECT round(
      100.0 * countIf(has_open = 1) / nullIf(count(), 0),
      2
    )
    FROM
    (
      SELECT
        session_id,
        toUInt8(countIf(event_name = 'tool_open' AND source = 'search') > 0) AS has_open
      FROM analytics_events
      WHERE event_time >= from_ts
        AND event_time < to_ts
        AND event_name IN ('search_submit', 'tool_open')
      GROUP BY session_id
      HAVING countIf(event_name = 'search_submit') > 0
    )
  ),
  zero_result_pct AS
  (
    SELECT round(
      100.0 * countIf(event_name = 'search_results' AND matches_count = 0) /
      nullIf(countIf(event_name = 'search_results'), 0),
      2
    )
    FROM analytics_events
    WHERE event_time >= from_ts
      AND event_time < to_ts
  )
SELECT
  adoption_pct,
  conversion_pct,
  zero_result_pct,
  toUInt8(adoption_pct >= 20 AND conversion_pct >= 50 AND zero_result_pct <= 15) AS stage3_ready;
