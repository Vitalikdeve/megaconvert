import React from 'react';
import { AdminAuthProvider } from './auth/AdminAuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { AdminOverviewPage } from './pages/AdminOverviewPage';
import { PostsPage } from './pages/PostsPage';
import { SearchInsightsPage } from './pages/SearchInsightsPage';
import { PromoCodesPage } from './pages/PromoCodesPage';
import { PromoMetricsPage } from './pages/PromoMetricsPage';
import { OperationsPage } from './pages/OperationsPage';
import { UsersPage } from './pages/UsersPage';
import { JobsPage } from './pages/JobsPage';
import { FilesPage } from './pages/FilesPage';
import { AiControlPage } from './pages/AiControlPage';
import { BillingPage } from './pages/BillingPage';
import { ApiUsagePage } from './pages/ApiUsagePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ContentPage } from './pages/ContentPage';
import { LocalizationPage } from './pages/LocalizationPage';
import { TeamPage } from './pages/TeamPage';
import { SecurityPage } from './pages/SecurityPage';
import { SystemPage } from './pages/SystemPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminI18nProvider, useAdminI18n } from './i18n/AdminI18nContext';
import { canAccess, getRole } from './core/permissions.js';
import { useAdminAuth } from './auth/useAdminAuth';

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

const AccessDenied = () => (
  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
    <div className="text-lg font-semibold text-slate-900">Access denied</div>
    <div className="text-sm text-slate-500 mt-2">Your role does not have read access to this module.</div>
  </div>
);

const AdminContent = ({ subPath, navigate }) => {
  const { adminUser } = useAdminAuth();
  const role = getRole(adminUser?.role);
  const getPage = () => {
    if (subPath === '/dashboard') return { module: 'dashboard', node: <AdminOverviewPage navigate={navigate} /> };
    if (subPath === '/posts' || subPath.startsWith('/posts/')) return { module: 'content', node: <PostsPage /> };
    if (subPath === '/promo-codes' || subPath.startsWith('/promo-codes/')) return { module: 'billing', node: <PromoCodesPage /> };
    if (subPath === '/promo' || subPath.startsWith('/promo/')) return { module: 'billing', node: <PromoMetricsPage /> };
    if (subPath === '/search' || subPath.startsWith('/search/')) return { module: 'analytics', node: <SearchInsightsPage /> };
    if (subPath === '/operations') return { module: 'operations', node: <OperationsPage /> };
    if (subPath === '/users') return { module: 'users', node: <UsersPage /> };
    if (subPath === '/jobs') return { module: 'jobs', node: <JobsPage /> };
    if (subPath === '/files') return { module: 'files', node: <FilesPage /> };
    if (subPath === '/ai') return { module: 'ai', node: <AiControlPage /> };
    if (subPath === '/billing') return { module: 'billing', node: <BillingPage /> };
    if (subPath === '/api') return { module: 'api', node: <ApiUsagePage /> };
    if (subPath === '/analytics') return { module: 'analytics', node: <AnalyticsPage /> };
    if (subPath === '/content') return { module: 'content', node: <ContentPage /> };
    if (subPath === '/pages') return { module: 'content', node: <ContentPage /> };
    if (subPath === '/blocks') return { module: 'content', node: <ContentPage /> };
    if (subPath === '/localization') return { module: 'localization', node: <LocalizationPage /> };
    if (subPath === '/team') return { module: 'team', node: <TeamPage /> };
    if (subPath === '/security') return { module: 'security', node: <SecurityPage /> };
    if (subPath === '/system') return { module: 'system', node: <SystemPage /> };
    if (subPath === '/logs') return { module: 'logs', node: <LogsPage /> };
    if (subPath === '/settings') return { module: 'settings', node: <SettingsPage /> };
    return { module: null, node: <NotFound navigate={navigate} /> };
  };

  const current = getPage();
  if (current.module && !canAccess(role, current.module, 'read')) return <AccessDenied />;
  if (current.node) return current.node;
  return <NotFound navigate={navigate} />;
};

export default function AdminApp({ path, navigate, apiBase, lang, t }) {
  const subPath = normalizeSubPath(path);
  const isLogin = subPath === '/login';
  const isOverview = subPath === '/' || subPath === '';

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
          {isOverview ? (
            <AdminOverviewPage navigate={navigate} />
          ) : (
            <AdminLayout path={path} navigate={navigate}>
              <AdminContent subPath={subPath} navigate={navigate} />
            </AdminLayout>
          )}
        </ProtectedRoute>
      </AdminAuthProvider>
    </AdminI18nProvider>
  );
}
