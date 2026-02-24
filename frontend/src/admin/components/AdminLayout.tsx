import React from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminI18n } from '../i18n/AdminI18nContext';

const linkClass = (active) => `w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition ${
  active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50'
}`;

export const AdminLayout = ({ path, navigate, children }) => {
  const { logout } = useAdminAuth();
  const { t } = useAdminI18n();
  const isDashboard = path === '/admin' || path === '/admin/';
  const isPosts = path.startsWith('/admin/posts');
  const isPromoCodes = path.startsWith('/admin/promo-codes');
  const isPromoMetrics = path.startsWith('/admin/promo') && !isPromoCodes;
  const isSearch = path.startsWith('/admin/search');

  const onLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[240px_1fr] gap-6">
        <aside className="bg-white/90 backdrop-blur border border-slate-200/80 rounded-3xl p-5 h-fit shadow-sm">
          <div className="text-xs uppercase tracking-wider text-slate-500 px-2 mb-3">{t.adminSidebarTitle}</div>
          <div className="space-y-1">
            <button className={linkClass(isDashboard)} onClick={() => navigate('/admin')}>{t.adminNavDashboard}</button>
            <button className={linkClass(isPosts)} onClick={() => navigate('/admin/posts')}>{t.adminNavPosts}</button>
            <button className={linkClass(isPromoCodes)} onClick={() => navigate('/admin/promo-codes')}>{t.adminNavPromoCodes}</button>
            <button className={linkClass(isPromoMetrics)} onClick={() => navigate('/admin/promo')}>{t.adminNavPromoAnalytics}</button>
            <button className={linkClass(isSearch)} onClick={() => navigate('/admin/search')}>{t.adminNavSearchInsights}</button>
          </div>
          <button
            onClick={onLogout}
            className="mt-6 w-full border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium hover:bg-slate-50"
          >
            {t.adminLogout}
          </button>
        </aside>
        <section className="space-y-4">{children}</section>
      </div>
    </div>
  );
};
