import React, { useEffect, useState } from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminI18n } from '../i18n/AdminI18nContext';

export const LoginPage = ({ navigate }) => {
  const { isAuthenticated, login, loading, error, refreshMe } = useAdminAuth();
  const { t } = useAdminI18n();
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (isAuthenticated) navigate('/admin');
  }, [isAuthenticated, navigate]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');
    try {
      await login(password);
      navigate('/admin');
    } catch (err) {
      setLocalError(err?.message || t.adminInvalidCredentials);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">{t.adminLoginTitle}</h1>
        <p className="text-sm text-slate-500 mt-2">{t.adminLoginSubtitle}</p>
        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-700 mb-2">{t.authPasswordPlaceholder}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            autoFocus
            required
          />
        </div>
        {(localError || error) && (
          <div className="mt-3 text-sm text-red-600">{localError || error}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-blue-600 text-white py-2.5 font-medium disabled:opacity-50"
        >
          {loading ? t.adminSigningIn : t.navLogin}
        </button>
      </form>
    </div>
  );
};
