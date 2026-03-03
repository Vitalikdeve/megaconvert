import React, { useState } from 'react';
import { SEARCH_RANGES } from '../types/adminTypes';
import { useSearchMetrics } from '../hooks/useSearchMetrics';
import { useAdminI18n } from '../i18n/AdminI18nContext';
import { StatCard } from '../components/StatCard';

const MetricsTable = ({ title, keyLabel, rows, keyField = 'query' }) => {
  const { t } = useAdminI18n();
  return (
    <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-500 mt-3">{t.adminNoDataInRange}</div>
      ) : (
        <div className="mt-3 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">{keyLabel}</th>
                <th className="py-2">{t.adminTableCount}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row[keyField] || row.query || row.format || row.pair || `${title}-${index}`} className="border-t border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{row[keyField] || row.query || row.format || row.pair}</td>
                  <td className="py-2 text-slate-700">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const SearchInsightsPage = () => {
  const { t } = useAdminI18n();
  const [range, setRange] = useState('7d');
  const { data, loading, error, refresh } = useSearchMetrics(range);

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
          <h1 className="text-2xl font-semibold text-slate-900">{t.adminSearchInsightsTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">{t.adminSearchInsightsSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
          >
            {SEARCH_RANGES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <button
            onClick={() => void refresh()}
            className="pressable px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            {loading ? t.adminRefreshing : t.adminRefresh}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-3 shadow-sm">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title={t.adminMetricSearchAdoption} value={formatPercent(data.summary.search_adoption_pct)} />
        <StatCard title={t.adminMetricSearchConversion} value={formatPercent(data.summary.conversion_pct)} />
        <StatCard title={t.adminMetricZeroResultRate} value={formatPercent(data.summary.zero_result_rate_pct)} />
        <StatCard title={t.adminMetricParseRate} value={formatPercent(data.summary.parse_rate_pct)} />
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
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
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <MetricsTable title={t.adminTopQueries} keyLabel={t.adminTableQuery} rows={data.top_queries} />
        <MetricsTable title={t.adminZeroResultQueries} keyLabel={t.adminTableQuery} rows={data.zero_queries} />
        <MetricsTable title={t.adminTopFromFormats} keyLabel={t.adminTableFormat} rows={data.top_from} keyField="format" />
        <MetricsTable title={t.adminTopToFormats} keyLabel={t.adminTableFormat} rows={data.top_to} keyField="format" />
        <MetricsTable title={t.adminTopFormatPairs} keyLabel={t.adminTablePair} rows={data.top_pairs} keyField="pair" />
      </div>

      <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t.adminDailyTrendTitle}</h2>
        {data.daily.length === 0 ? (
          <div className="text-sm text-slate-500 mt-3">{t.adminNoDataInRange}</div>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">{t.adminTableDay}</th>
                  <th className="py-2">{t.adminTableSearches}</th>
                  <th className="py-2">{t.adminTableZeroResults}</th>
                  <th className="py-2">{t.adminTableRedirects}</th>
                  <th className="py-2">{t.adminTableToolOpens}</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map((row) => (
                  <tr key={row.day} className="border-t border-slate-100">
                    <td className="py-2 text-slate-800">{row.day}</td>
                    <td className="py-2 text-slate-700">{Number(row.searches || 0)}</td>
                    <td className="py-2 text-slate-700">{Number(row.zero_results || 0)}</td>
                    <td className="py-2 text-slate-700">{Number(row.redirects || 0)}</td>
                    <td className="py-2 text-slate-700">{Number(row.tool_opens || 0)}</td>
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
