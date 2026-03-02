import React, { useEffect } from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminI18n } from '../i18n/AdminI18nContext';

export const ProtectedRoute = ({ navigate, children }) => {
  const { loading, isAuthenticated, refreshMe } = useAdminAuth();
  const { t } = useAdminI18n();

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) navigate('/admin/login');
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
        <div className="mc-card p-8 text-slate-600 text-sm">
          {t.adminCheckingSession}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return children;
};
