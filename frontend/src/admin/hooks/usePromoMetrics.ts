import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminI18n } from '../i18n/AdminI18nContext';

const DEFAULT_DATA = {
  range: '7d',
  totals: {
    total_codes: 0,
    active_codes: 0,
    redemptions: 0,
    unique_users: 0
  },
  top_codes: [],
  daily: []
};

export const usePromoMetrics = (range = '7d', { enabled = true } = {}) => {
  const { api, logout } = useAdminAuth();
  const { t } = useAdminI18n();
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const next = await api.getPromoMetrics(range);
      setData({
        range: String(next?.range || range),
        totals: {
          total_codes: Number(next?.totals?.total_codes || 0),
          active_codes: Number(next?.totals?.active_codes || 0),
          redemptions: Number(next?.totals?.redemptions || 0),
          unique_users: Number(next?.totals?.unique_users || 0)
        },
        top_codes: Array.isArray(next?.top_codes) ? next.top_codes : [],
        daily: Array.isArray(next?.daily) ? next.daily : []
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
        setError(err?.message || t.adminErrorLoadPromoMetrics);
      }
    } finally {
      setLoading(false);
    }
  }, [api, enabled, logout, range, t]);

  useEffect(() => {
    if (!enabled) return undefined;
    void load();
    return undefined;
  }, [enabled, load]);

  return { data, loading, error, refresh: load };
};
