import React, { useCallback, useMemo, useState } from 'react';
import { createAdminApi } from '../api/adminApi';
import { AdminAuthContext } from './AdminAuthContext';
import { useAdminI18n } from '../i18n/AdminI18nContext';

export const AdminAuthProvider = ({ apiBase = '/api', children }) => {
  const { t } = useAdminI18n();
  const api = useMemo(() => createAdminApi(apiBase), [apiBase]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [error, setError] = useState('');

  const refreshMe = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getMe();
      setIsAuthenticated(true);
      setAdminUser(response?.admin || null);
      setError('');
      return response?.admin || null;
    } catch (err) {
      if (err?.status === 401) {
        setIsAuthenticated(false);
        setAdminUser(null);
        setError('');
        return null;
      }
      setIsAuthenticated(false);
      setAdminUser(null);
      setError(err?.message || t.adminErrorVerifySession);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api, t]);

  const login = useCallback(async (password) => {
    setLoading(true);
    try {
      await api.login(password);
      const response = await api.getMe();
      setIsAuthenticated(true);
      setAdminUser(response?.admin || null);
      setError('');
      return true;
    } catch (err) {
      setIsAuthenticated(false);
      setAdminUser(null);
      setError(err?.message || t.adminErrorLogin);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api, t]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await api.logout();
    } catch {
      // Do not block local logout state.
    } finally {
      setIsAuthenticated(false);
      setAdminUser(null);
      setError('');
      setLoading(false);
    }
  }, [api]);

  const value = useMemo(() => ({
    api,
    isAuthenticated,
    loading,
    adminUser,
    error,
    login,
    logout,
    refreshMe
  }), [api, isAuthenticated, loading, adminUser, error, login, logout, refreshMe]);

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};
