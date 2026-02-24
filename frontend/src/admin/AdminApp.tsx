import React from 'react';
import { AdminAuthProvider } from './auth/AdminAuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PostsPage } from './pages/PostsPage';
import { SearchInsightsPage } from './pages/SearchInsightsPage';
import { PromoCodesPage } from './pages/PromoCodesPage';
import { PromoMetricsPage } from './pages/PromoMetricsPage';
import { AdminI18nProvider, useAdminI18n } from './i18n/AdminI18nContext';

const normalizeSubPath = (path) => {
  const value = String(path || '');
  if (!value.startsWith('/admin')) return '/';
  let subPath = value.slice('/admin'.length) || '/';
  if (!subPath.startsWith('/')) subPath = `/${subPath}`;
  subPath = subPath.replace(/\/{2,}/g, '/');
  if (subPath.length > 1 && subPath.endsWith('/')) subPath = subPath.slice(0, -1);
  return subPath || '/';
};

const NotFound = ({ navigate }) => {
  const { t } = useAdminI18n();
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
      <div className="text-lg font-semibold text-slate-900">{t.adminNotFoundTitle}</div>
      <div className="text-sm text-slate-500 mt-2">{t.adminNotFoundSubtitle}</div>
      <button
        onClick={() => navigate('/admin')}
        className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium"
      >
        {t.adminOpenDashboard}
      </button>
    </div>
  );
};

const AdminContent = ({ subPath, navigate }) => {
  if (subPath === '/' || subPath === '') return <DashboardPage />;
  if (subPath === '/posts' || subPath.startsWith('/posts/')) return <PostsPage />;
  if (subPath === '/promo-codes' || subPath.startsWith('/promo-codes/')) return <PromoCodesPage />;
  if (subPath === '/promo' || subPath.startsWith('/promo/')) return <PromoMetricsPage />;
  if (subPath === '/search' || subPath.startsWith('/search/')) return <SearchInsightsPage />;
  return <NotFound navigate={navigate} />;
};

export default function AdminApp({ path, navigate, apiBase, lang, t }) {
  const subPath = normalizeSubPath(path);
  const isLogin = subPath === '/login';

  if (isLogin) {
    return (
      <AdminI18nProvider lang={lang} t={t}>
        <AdminAuthProvider apiBase={apiBase}>
          <LoginPage navigate={navigate} />
        </AdminAuthProvider>
      </AdminI18nProvider>
    );
  }

  return (
    <AdminI18nProvider lang={lang} t={t}>
      <AdminAuthProvider apiBase={apiBase}>
        <ProtectedRoute navigate={navigate}>
          <AdminLayout path={path} navigate={navigate}>
            <AdminContent subPath={subPath} navigate={navigate} />
          </AdminLayout>
        </ProtectedRoute>
      </AdminAuthProvider>
    </AdminI18nProvider>
  );
}
