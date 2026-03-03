import React, { useState } from 'react';
import { SEARCH_RANGES } from '../types/adminTypes';
import { usePromoMetrics } from '../hooks/usePromoMetrics';
import { StatCard } from '../components/StatCard';
import { useAdminI18n } from '../i18n/AdminI18nContext';

const formatGrowth = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  const numeric = Number(value) * 100;
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(1)}%`;
};

export const PromoMetricsPage = () => {
  const { t } = useAdminI18n();
  const [range, setRange] = useState('7d');
  const { data, loading, error, refresh } = usePromoMetrics(range);

  return (
    <>
      <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t.adminPromoAnalyticsTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">{t.adminPromoAnalyticsSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
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
        <StatCard title={t.adminMetricTotalCodes} value={data.totals.total_codes} />
        <StatCard title={t.adminMetricActiveCodes} value={data.totals.active_codes} />
        <StatCard title={t.adminMetricRedemptions} value={data.totals.redemptions} />
        <StatCard title={t.adminMetricUniqueUsers} value={data.totals.unique_users} />
      </div>

      <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t.adminTopPromoCodes}</h2>
        {data.top_codes.length === 0 ? (
          <div className="text-sm text-slate-500 mt-3">{t.adminNoPromoRedemptions}</div>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">{t.accountTableCode}</th>
                  <th className="py-2">{t.adminTableRedemptions}</th>
                  <th className="py-2">{t.adminTableUsers}</th>
                  <th className="py-2">{t.adminTableAllTime}</th>
                  <th className="py-2">{t.adminTableGrowth}</th>
                </tr>
              </thead>
              <tbody>
                {data.top_codes.map((row) => (
                  <tr key={row.promo_id || row.code} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{row.code}</td>
                    <td className="py-2 text-slate-700">{row.redemptions}</td>
                    <td className="py-2 text-slate-700">{row.unique_users}</td>
                    <td className="py-2 text-slate-700">{row.redemptions_total}</td>
                    <td className="py-2 text-slate-700">{formatGrowth(row.growth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t.adminDailyRedemptions}</h2>
        {data.daily.length === 0 ? (
          <div className="text-sm text-slate-500 mt-3">{t.adminNoDailyRedemptions}</div>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">{t.adminTableDay}</th>
                  <th className="py-2">{t.adminTableRedemptions}</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map((row) => (
                  <tr key={row.day} className="border-t border-slate-100">
                    <td className="py-2 text-slate-800">{row.day}</td>
                    <td className="py-2 text-slate-700">{row.redemptions}</td>
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
