import React, { useCallback, useMemo, useState } from 'react';
import { createAdminApi } from '../api/adminApi';
import { AdminAuthContext } from './AdminAuthContext';
import { useAdminI18n } from '../i18n/AdminI18nContext';

const MENU_ADMIN_PASSWORD = 'AdminMega2026!';
const LOCAL_ADMIN_SESSION_KEY = 'mc_admin_menu_auth_v1';
const LOCAL_ADMIN_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const readLocalAdminSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const expiresAt = Number(parsed.expiresAt || 0);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      localStorage.removeItem(LOCAL_ADMIN_SESSION_KEY);
      return null;
    }
    const admin = parsed.admin && typeof parsed.admin === 'object' ? parsed.admin : null;
    return admin || null;
  } catch {
    return null;
  }
};

const writeLocalAdminSession = (admin) => {
  if (typeof window === 'undefined' || !admin) return;
  try {
    localStorage.setItem(LOCAL_ADMIN_SESSION_KEY, JSON.stringify({
      admin,
      expiresAt: Date.now() + LOCAL_ADMIN_SESSION_TTL_MS
    }));
  } catch {
    // Ignore localStorage failures.
  }
};

const clearLocalAdminSession = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCAL_ADMIN_SESSION_KEY);
  } catch {
    // Ignore localStorage failures.
  }
};

const createMenuAdminUser = () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + Math.floor(LOCAL_ADMIN_SESSION_TTL_MS / 1000);
  return {
    role: 'super_admin',
    sid: `menu-${nowSec}`,
    exp: expSec,
    source: 'menu_password'
  };
};

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
      const localAdmin = readLocalAdminSession();
      if (localAdmin) {
        setIsAuthenticated(true);
        setAdminUser(localAdmin);
        setError('');
        return localAdmin;
      }
      const response = await api.getMe();
      setIsAuthenticated(true);
      setAdminUser(response?.admin || null);
      setError('');
      return response?.admin || null;
    } catch (err) {
      const localAdmin = readLocalAdminSession();
      if (localAdmin) {
        setIsAuthenticated(true);
        setAdminUser(localAdmin);
        setError('');
        return localAdmin;
      }
      if (err?.status === 401) {
        clearLocalAdminSession();
        setIsAuthenticated(false);
        setAdminUser(null);
        setError('');
        return null;
      }
      if (err?.code === 'ADMIN_AUTH_NOT_CONFIGURED') {
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
      if (String(password || '') === MENU_ADMIN_PASSWORD) {
        const admin = createMenuAdminUser();
        writeLocalAdminSession(admin);
        setIsAuthenticated(true);
        setAdminUser(admin);
        setError('');
        return true;
      }
      await api.login(password);
      const response = await api.getMe();
      clearLocalAdminSession();
      setIsAuthenticated(true);
      setAdminUser(response?.admin || null);
      setError('');
      return true;
    } catch (err) {
      if (err?.code === 'ADMIN_AUTH_NOT_CONFIGURED') {
        const localError = new Error(t.adminInvalidCredentials || 'Invalid credentials');
        setIsAuthenticated(false);
        setAdminUser(null);
        setError(localError.message);
        throw localError;
      }
      clearLocalAdminSession();
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
      clearLocalAdminSession();
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
