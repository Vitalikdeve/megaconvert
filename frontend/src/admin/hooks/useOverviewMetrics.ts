import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminI18n } from '../i18n/AdminI18nContext';

const DEFAULT_DATA = {
  online_now: 0,
  events_per_min: 0,
  searches_today: 0,
  top_tools: [],
  summary: {
    total_sessions: 0,
    search_sessions: 0,
    converted_sessions: 0,
    search_adoption_pct: null,
    parse_rate_pct: null,
    zero_result_rate_pct: null,
    conversion_pct: null,
    redirect_share_pct: null,
    redirect_success_pct: null,
    p50_latency_ms: null,
    p95_latency_ms: null,
    p50_time_to_tool_sec: null,
    p95_time_to_tool_sec: null
  },
  funnel: {
    submit: 0,
    parsed_success: 0,
    results: 0,
    zero_results: 0,
    redirects: 0,
    tool_open_from_search: 0
  },
  hourly: []
};

export const useOverviewMetrics = ({ enabled = true, pollMs = 15000 } = {}) => {
  const { api, logout } = useAdminAuth();
  const { t } = useAdminI18n();
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const next = await api.getOverviewMetrics();
      const toNullableNumber = (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      };
      setData({
        online_now: Number(next?.online_now || 0),
        events_per_min: Number(next?.events_per_min || 0),
        searches_today: Number(next?.searches_today || 0),
        top_tools: Array.isArray(next?.top_tools) ? next.top_tools : [],
        summary: {
          total_sessions: Number(next?.summary?.total_sessions || 0),
          search_sessions: Number(next?.summary?.search_sessions || 0),
          converted_sessions: Number(next?.summary?.converted_sessions || 0),
          search_adoption_pct: toNullableNumber(next?.summary?.search_adoption_pct),
          parse_rate_pct: toNullableNumber(next?.summary?.parse_rate_pct),
          zero_result_rate_pct: toNullableNumber(next?.summary?.zero_result_rate_pct),
          conversion_pct: toNullableNumber(next?.summary?.conversion_pct),
          redirect_share_pct: toNullableNumber(next?.summary?.redirect_share_pct),
          redirect_success_pct: toNullableNumber(next?.summary?.redirect_success_pct),
          p50_latency_ms: toNullableNumber(next?.summary?.p50_latency_ms),
          p95_latency_ms: toNullableNumber(next?.summary?.p95_latency_ms),
          p50_time_to_tool_sec: toNullableNumber(next?.summary?.p50_time_to_tool_sec),
          p95_time_to_tool_sec: toNullableNumber(next?.summary?.p95_time_to_tool_sec)
        },
        funnel: {
          submit: Number(next?.funnel?.submit || 0),
          parsed_success: Number(next?.funnel?.parsed_success || 0),
          results: Number(next?.funnel?.results || 0),
          zero_results: Number(next?.funnel?.zero_results || 0),
          redirects: Number(next?.funnel?.redirects || 0),
          tool_open_from_search: Number(next?.funnel?.tool_open_from_search || 0)
        },
        hourly: Array.isArray(next?.hourly) ? next.hourly : []
      });
      setError('');
    } catch (err) {
      if (err?.status === 401) {
        await logout();
        return;
      }
      if (String(err?.code || '').trim() === 'ANALYTICS_UNAVAILABLE') {
        setError(t.adminErrorAnalyticsUnavailable);
      } else {
        setError(err?.message || t.adminErrorLoadOverviewMetrics);
      }
    } finally {
      setLoading(false);
    }
  }, [api, enabled, logout, t]);

  useEffect(() => {
    if (!enabled) return undefined;
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [enabled, load, pollMs]);

  return { data, loading, error, refresh: load };
};
