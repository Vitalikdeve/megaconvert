import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Cpu,
  FileStack,
  Files,
  LayoutDashboard,
  Settings,
  TriangleAlert,
  Users
} from 'lucide-react';
import { useAdminAuth } from '../auth/useAdminAuth';
import './AdminOverviewPage.css';

type OverviewProps = {
  navigate: (to: string) => void;
};

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type MetricCardData = {
  id: string;
  title: string;
  value: string;
  note: string;
  trend?: string;
  tone?: 'positive' | 'neutral' | 'warning';
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type ActivityItem = {
  id: string;
  action: string;
  user: string;
  time: string;
  status: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Дашборд', href: '/admin', icon: LayoutDashboard },
  { id: 'users', label: 'Пользователи', href: '/admin/users', icon: Users },
  { id: 'files', label: 'Файлы', href: '/admin/files', icon: Files },
  { id: 'settings', label: 'Настройки', href: '/admin/settings', icon: Settings }
];

const INITIAL_METRICS: MetricCardData[] = [
  {
    id: 'conversions',
    title: 'Конверсий сегодня',
    value: '142',
    note: 'vs вчера: 131',
    trend: '+8.4%',
    tone: 'positive',
    icon: FileStack
  },
  {
    id: 'worker',
    title: 'Нагрузка на Worker',
    value: '12%',
    note: 'P95 latency: 138 ms',
    trend: 'Оптимально',
    tone: 'neutral',
    icon: Cpu
  },
  {
    id: 'errors',
    title: 'Ошибки',
    value: '2',
    note: 'за последние 24 часа',
    trend: '-60%',
    tone: 'positive',
    icon: TriangleAlert
  },
  {
    id: 'active_users',
    title: 'Активные пользователи',
    value: '296',
    note: 'сейчас онлайн',
    trend: '+3.3%',
    tone: 'positive',
    icon: Users
  }
];

const INITIAL_ACTIVITY: ActivityItem[] = [
  { id: '1', action: 'Запущена пакетная конвертация PDF -> DOCX', user: 'admin@megaconvert.ai', time: '2 мин назад', status: 'Успешно' },
  { id: '2', action: 'Обновлены лимиты очереди Worker', user: 'ops@megaconvert.ai', time: '11 мин назад', status: 'Изменено' },
  { id: '3', action: 'Удалены просроченные файлы из хранилища', user: 'system', time: '24 мин назад', status: 'Автоматически' },
  { id: '4', action: 'Создан новый пользователь с ролью Analyst', user: 'owner@megaconvert.ai', time: '42 мин назад', status: 'Успешно' },
  { id: '5', action: 'Проверка SLA очереди завершена', user: 'monitoring', time: '1 ч назад', status: 'OK' }
];

const SidebarNavItem = ({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: (to: string) => void }) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.href)}
      className={`admin-overview-nav-item ${active ? 'is-active' : ''}`}
    >
      <Icon size={18} className="shrink-0" />
      <span>{item.label}</span>
    </button>
  );
};

const MetricCard = ({ metric }: { metric: MetricCardData }) => {
  const Icon = metric.icon;
  const trendClass = metric.tone === 'warning'
    ? 'text-amber-600'
    : metric.tone === 'positive'
      ? 'text-emerald-600'
      : 'text-slate-600';

  return (
    <article className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_20px_45px_rgba(15,23,42,0.05)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{metric.title}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900 tracking-tight">{metric.value}</p>
        </div>
        <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-500">{metric.note}</span>
        <span className={`inline-flex items-center gap-1 text-sm font-medium ${trendClass}`}>
          {metric.tone === 'positive' ? <ArrowUpRight size={14} /> : null}
          {metric.trend || 'Без изменений'}
        </span>
      </div>
    </article>
  );
};

export const AdminOverviewPage = ({ navigate }: OverviewProps) => {
  const { adminUser, logout } = useAdminAuth();
  const adminLabel = String(adminUser?.email || adminUser?.name || 'admin').trim();
  const avatarLetter = (adminLabel[0] || 'A').toUpperCase();
  const [metrics, setMetrics] = useState<MetricCardData[]>(INITIAL_METRICS);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>(INITIAL_ACTIVITY);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMetrics((prev) => prev.map((item) => {
        if (item.id === 'conversions') {
          const current = Number(item.value.replace(/[^\d]/g, '')) || 142;
          return { ...item, value: String(current + Math.floor(Math.random() * 3)) };
        }
        if (item.id === 'worker') {
          const next = Math.max(8, Math.min(28, 12 + Math.floor(Math.random() * 7) - 3));
          return { ...item, value: `${next}%`, note: `P95 latency: ${120 + Math.floor(Math.random() * 40)} ms` };
        }
        if (item.id === 'active_users') {
          const base = Number(item.value.replace(/[^\d]/g, '')) || 296;
          return { ...item, value: String(Math.max(180, base + Math.floor(Math.random() * 9) - 4)) };
        }
        return item;
      }));

      setRecentActivity((prev) => {
        const nextItem: ActivityItem = {
          id: `auto-${Date.now()}`,
          action: 'Фоновая проверка очередей завершена',
          user: 'monitoring',
          time: 'только что',
          status: 'OK'
        };
        return [nextItem, ...prev].slice(0, 6);
      });
    }, 9000);
    return () => window.clearInterval(timer);
  }, []);

  const metricsCountLabel = useMemo(
    () => `${metrics.length} ключевых метрики`,
    [metrics.length]
  );

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="admin-overview admin-apple min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1440px] grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_20px_45px_rgba(15,23,42,0.05)] p-5 sm:p-6 h-fit">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
              MC
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">MegaConvert</p>
              <p className="text-xs text-slate-500">Admin Panel</p>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {NAV_ITEMS.map((item) => (
              <SidebarNavItem
                key={item.id}
                item={item}
                active={item.id === 'dashboard'}
                onNavigate={navigate}
              />
            ))}
          </nav>

          <div className="mt-8 rounded-2xl bg-slate-100/70 px-4 py-3">
            <p className="text-xs text-slate-500">Текущий администратор</p>
            <p className="mt-1 text-sm font-medium text-slate-900 break-all">{adminLabel}</p>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="mt-4 w-full rounded-2xl bg-white/90 border border-white/60 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-white transition"
          >
            Выйти
          </button>
        </aside>

        <main className="space-y-6">
          <header className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_20px_45px_rgba(15,23,42,0.05)] px-6 py-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Обзор системы</h1>
              <p className="mt-1 text-sm text-slate-500">Единый статус платформы, конверсий и инфраструктуры.</p>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
              {avatarLetter}
            </div>
          </header>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </section>

          <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_20px_45px_rgba(15,23,42,0.05)] p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Недавняя активность</h2>
              <span className="text-xs text-slate-500">{metricsCountLabel}</span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-3 pr-4 font-medium">Событие</th>
                    <th className="py-3 pr-4 font-medium">Инициатор</th>
                    <th className="py-3 pr-4 font-medium">Время</th>
                    <th className="py-3 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60">
                  {recentActivity.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3.5 pr-4 text-slate-900">{row.action}</td>
                      <td className="py-3.5 pr-4 text-slate-600">{row.user}</td>
                      <td className="py-3.5 pr-4 text-slate-500">{row.time}</td>
                      <td className="py-3.5">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
