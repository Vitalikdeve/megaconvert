import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminI18n } from '../i18n/AdminI18nContext';

const DEFAULT_DATA = {
  range: '7d',
  analytics_available: false,
  top_liked: []
};

export const usePostsMetrics = (range = '7d', { enabled = true } = {}) => {
  const { api, logout } = useAdminAuth();
  const { t } = useAdminI18n();
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const next = await api.getPostsMetrics(range);
      setData({
        range: String(next?.range || range),
        analytics_available: Boolean(next?.analytics_available),
        top_liked: Array.isArray(next?.top_liked) ? next.top_liked : []
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
        setError(err?.message || t.adminErrorLoadPostsMetrics);
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
