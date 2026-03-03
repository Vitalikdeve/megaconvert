import React, { useMemo, useState } from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminI18n } from '../i18n/AdminI18nContext';
import { buildPermissionList, canAccess, getRole } from '../core/permissions.js';

const linkClass = (active) => `w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition pressable ${
  active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/5'
}`;

const NAV_SECTIONS = [
  {
    id: 'overview',
    title: 'Overview',
    items: [
      { path: '/admin', key: 'dashboard', label: 'Dashboard', hint: 'Main KPIs and status' },
      { path: '/admin/operations', key: 'operations', label: 'Operations', hint: 'Live control panel' },
      { path: '/admin/analytics', key: 'analytics', label: 'Analytics', hint: 'Usage and trends' },
      { path: '/admin/search', key: 'analytics', label: 'Search Insights', hint: 'Search behavior' }
    ]
  },
  {
    id: 'content',
    title: 'Content',
    items: [
      { path: '/admin/posts', key: 'content', label: 'Blog Posts', hint: 'News and guides' },
      { path: '/admin/content', key: 'content', label: 'Pages & Blocks', hint: 'Website content' },
      { path: '/admin/localization', key: 'localization', label: 'Localization', hint: 'Translations' }
    ]
  },
  {
    id: 'product',
    title: 'Product',
    items: [
      { path: '/admin/users', key: 'users', label: 'Users', hint: 'Accounts and access' },
      { path: '/admin/jobs', key: 'jobs', label: 'Jobs', hint: 'Conversion queue' },
      { path: '/admin/files', key: 'files', label: 'Files', hint: 'Storage and assets' },
      { path: '/admin/ai', key: 'ai', label: 'AI Control', hint: 'AI recommendations' },
      { path: '/admin/api', key: 'api', label: 'API Usage', hint: 'API health and limits' },
      { path: '/admin/billing', key: 'billing', label: 'Billing', hint: 'Plans and revenue' },
      { path: '/admin/promo-codes', key: 'billing', label: 'Promo Codes', hint: 'Campaign management' },
      { path: '/admin/promo', key: 'billing', label: 'Promo Metrics', hint: 'Promo performance' },
      { path: '/admin/team', key: 'team', label: 'Team', hint: 'Public team profiles' }
    ]
  },
  {
    id: 'system',
    title: 'System',
    items: [
      { path: '/admin/security', key: 'security', label: 'Security', hint: 'Access and policy' },
      { path: '/admin/system', key: 'system', label: 'System Health', hint: 'Workers and uptime' },
      { path: '/admin/logs', key: 'logs', label: 'Logs', hint: 'Audit and debug' },
      { path: '/admin/settings', key: 'settings', label: 'Settings', hint: 'Feature flags and limits' }
    ]
  }
];

export const AdminLayout = ({ path, navigate, children }) => {
  const { logout, adminUser } = useAdminAuth();
  const { t } = useAdminI18n();
  const [query, setQuery] = useState('');
  const role = getRole(adminUser?.role);

  const allowedSections = useMemo(() => {
    return NAV_SECTIONS
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => canAccess(role, item.key, 'read'))
      }))
      .filter((section) => section.items.length > 0);
  }, [role]);
  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allowedSections;
    return allowedSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const searchable = `${item.label} ${item.hint || ''}`.toLowerCase();
          return searchable.includes(q);
        })
      }))
      .filter((section) => section.items.length > 0);
  }, [allowedSections, query]);

  const onLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const permissions = buildPermissionList(role);
  const activeItem = useMemo(() => {
    for (const section of allowedSections) {
      for (const item of section.items) {
        const active = item.path === '/admin'
          ? (path === '/admin' || path === '/admin/')
          : path.startsWith(item.path);
        if (active) return item;
      }
    }
    return null;
  }, [allowedSections, path]);

  return (
    <div className="admin-shell min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-[1440px] mx-auto px-4 py-6">
        <div className="mc-card p-4 mb-4 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">MegaConvert Admin</div>
            <div className="text-sm text-slate-700">
              {activeItem ? `${activeItem.label} · ${activeItem.hint || 'Module'}` : 'Control center'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find module or action..."
              className="px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
            <button onClick={() => navigate('/admin/posts')} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm">New Post</button>
            <button onClick={() => navigate('/admin/system')} className="px-3 py-2 rounded-xl border border-slate-300 text-sm">System</button>
            <button onClick={() => navigate('/')} className="px-3 py-2 rounded-xl border border-slate-300 text-sm">Open Site</button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          <aside className="mc-card p-5 h-fit">
            <div className="text-xs uppercase tracking-wider text-slate-500 px-2 mb-3">{t.adminSidebarTitle}</div>
            <div className="space-y-4">
              {filteredSections.map((section) => (
                <div key={section.id}>
                  <div className="px-2 mb-1 text-[11px] uppercase tracking-widest text-slate-500">{section.title}</div>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const active = item.path === '/admin'
                        ? (path === '/admin' || path === '/admin/')
                        : path.startsWith(item.path);
                      return (
                        <button key={item.path} className={linkClass(active)} onClick={() => navigate(item.path)}>
                          <div>{item.label}</div>
                          <div className={`text-[11px] mt-0.5 ${active ? 'text-blue-100' : 'text-slate-500'}`}>{item.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 p-3 bg-slate-950/40">
              <div className="text-xs uppercase tracking-wider text-slate-500">Role</div>
              <div className="text-sm font-semibold text-slate-800 mt-1">{role}</div>
              <div className="text-xs text-slate-500 mt-2">Permissions: {permissions.length}</div>
            </div>
            <button
              onClick={onLogout}
              className="pressable mt-4 w-full border border-slate-200 text-slate-600 rounded-xl py-2 text-sm font-medium hover:bg-slate-50 transition"
            >
              {t.adminLogout}
            </button>
          </aside>
          <section className="space-y-4">{children}</section>
        </div>
      </div>
    </div>
  );
};
