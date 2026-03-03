import React, { useState } from 'react';
import { StatCard } from '../components/StatCard';
import { useOverviewMetrics } from '../hooks/useOverviewMetrics';
import { usePostsMetrics } from '../hooks/usePostsMetrics';
import { SEARCH_RANGES } from '../types/adminTypes';
import { useAdminI18n } from '../i18n/AdminI18nContext';

export const DashboardPage = () => {
  const { t } = useAdminI18n();
  const { data, loading, error, refresh } = useOverviewMetrics();
  const [postsRange, setPostsRange] = useState('7d');
  const {
    data: postsMetrics,
    loading: postsLoading,
    error: postsError,
    refresh: refreshPosts
  } = usePostsMetrics(postsRange);

  const formatRatio = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
    return `${(Number(value) * 100).toFixed(1)}%`;
  };

  const formatGrowth = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
    const numeric = Number(value) * 100;
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${numeric.toFixed(1)}%`;
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
    return `${(Number(value) * 100).toFixed(1)}%`;
  };

  const formatMs = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
    return `${Math.round(Number(value))} ms`;
  };

  const formatSec = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
    return `${Math.round(Number(value))} s`;
  };

  const funnelRows = [
    { label: t.adminFunnelSubmit, count: Number(data?.funnel?.submit || 0) },
    { label: t.adminFunnelParsed, count: Number(data?.funnel?.parsed_success || 0) },
    { label: t.adminFunnelResults, count: Number(data?.funnel?.results || 0) },
    { label: t.adminFunnelRedirects, count: Number(data?.funnel?.redirects || 0) },
    { label: t.adminFunnelOpenFromSearch, count: Number(data?.funnel?.tool_open_from_search || 0) }
  ];
  const maxFunnelCount = Math.max(1, ...funnelRows.map((row) => row.count));

  return (
    <>
      <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t.adminDashboardTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">{t.adminDashboardSubtitle}</p>
        </div>
        <button
          onClick={() => void refresh()}
          className="pressable px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
        >
          {loading ? t.adminRefreshing : t.adminRefresh}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-3 shadow-sm">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard title={t.adminMetricOnlineNow} value={data.online_now} />
        <StatCard title={t.adminMetricEventsPerMin} value={data.events_per_min} />
        <StatCard title={t.adminMetricSearchesToday} value={data.searches_today} />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title={t.adminMetricSearchAdoption} value={formatPercent(data.summary.search_adoption_pct)} />
        <StatCard title={t.adminMetricSearchConversion} value={formatPercent(data.summary.conversion_pct)} />
        <StatCard title={t.adminMetricZeroResultRate} value={formatPercent(data.summary.zero_result_rate_pct)} />
        <StatCard title={t.adminMetricParseRate} value={formatPercent(data.summary.parse_rate_pct)} />
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{t.adminSearchLatencyTitle}</h2>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider">{t.adminMetricLatencyP50}</div>
              <div className="text-xl font-semibold text-slate-900 mt-1">{formatMs(data.summary.p50_latency_ms)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider">{t.adminMetricLatencyP95}</div>
              <div className="text-xl font-semibold text-slate-900 mt-1">{formatMs(data.summary.p95_latency_ms)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider">{t.adminMetricTimeToToolP50}</div>
              <div className="text-xl font-semibold text-slate-900 mt-1">{formatSec(data.summary.p50_time_to_tool_sec)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider">{t.adminMetricTimeToToolP95}</div>
              <div className="text-xl font-semibold text-slate-900 mt-1">{formatSec(data.summary.p95_time_to_tool_sec)}</div>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{t.adminSearchFunnelTitle}</h2>
          <div className="mt-4 space-y-3">
            {funnelRows.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{row.label}</span>
                  <span className="font-semibold text-slate-900">{row.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-slate-700 rounded-full"
                    style={{ width: row.count > 0 ? `${Math.max(2, Math.round((row.count / maxFunnelCount) * 100))}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t.adminHourlyTrendTitle}</h2>
        {data.hourly.length === 0 ? (
          <div className="text-sm text-slate-500 mt-3">{t.adminNoDataInRange}</div>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">{t.adminTableHour}</th>
                  <th className="py-2">{t.adminTableEvents}</th>
                  <th className="py-2">{t.adminTableSearches}</th>
                </tr>
              </thead>
              <tbody>
                {data.hourly.map((row) => (
                  <tr key={row.hour} className="border-t border-slate-100">
                    <td className="py-2 text-slate-800">{String(row.hour || '').replace('T', ' ').slice(0, 16)}</td>
                    <td className="py-2 text-slate-700">{Number(row.events || 0)}</td>
                    <td className="py-2 text-slate-700">{Number(row.searches || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t.adminTopToolsToday}</h2>
        {data.top_tools.length === 0 ? (
          <div className="text-sm text-slate-500 mt-3">{t.adminNoToolActivity}</div>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">{t.adminTableTool}</th>
                  <th className="py-2">{t.adminTableCount}</th>
                </tr>
              </thead>
              <tbody>
                {data.top_tools.map((row) => (
                  <tr key={row.tool_id} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{row.tool_id}</td>
                    <td className="py-2 text-slate-700">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t.adminPostsEngagementTitle}</h2>
            <p className="text-sm text-slate-500 mt-1">{t.adminPostsEngagementSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={postsRange}
              onChange={(event) => setPostsRange(event.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
            >
              {SEARCH_RANGES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button
              onClick={() => void refreshPosts()}
              className="pressable px-3 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              {postsLoading ? t.adminRefreshing : t.adminRefresh}
            </button>
          </div>
        </div>

        {postsError && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-3 shadow-sm">
            {postsError}
          </div>
        )}

        {postsMetrics.analytics_available ? null : (
          <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-2xl p-3 shadow-sm">
            {t.adminPostsAnalyticsDisabled}
          </div>
        )}

        {postsMetrics.top_liked.length === 0 ? (
          <div className="text-sm text-slate-500 mt-4">{t.adminNoPostsEngagement}</div>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">{t.adminTablePost}</th>
                  <th className="py-2">{t.adminTableLikes}</th>
                  <th className="py-2">{t.adminTableOpens}</th>
                  <th className="py-2">{t.adminTableLikeRate}</th>
                  <th className="py-2">{t.adminTableGrowth}</th>
                </tr>
              </thead>
              <tbody>
                {postsMetrics.top_liked.map((row) => (
                  <tr key={row.post_id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-800">
                      <div className="font-medium">{row.title || row.slug || row.post_id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{row.slug || row.post_id}</div>
                    </td>
                    <td className="py-2 text-slate-700">{row.likes}</td>
                    <td className="py-2 text-slate-700">{row.opens ?? '-'}</td>
                    <td className="py-2 text-slate-700">{formatRatio(row.like_rate)}</td>
                    <td className="py-2 text-slate-700">{formatGrowth(row.growth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};
