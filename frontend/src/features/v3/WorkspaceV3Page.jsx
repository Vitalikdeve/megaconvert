import React, { Suspense, lazy, useMemo } from 'react';
import {
  Activity,
  ArrowRight,
  Boxes,
  Clock3,
  FolderKanban,
  QrCode,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';
import {
  WORKSPACE_V3_DEFAULT_PATH,
  flattenWorkspaceRoutes,
  getWorkspaceHeroBadges,
  getWorkspaceRouteGroups,
  matchWorkspaceRoute,
  normalizeWorkspacePath
} from './routes.js';
import useWorkspaceLocale from './lib/useWorkspaceLocale.js';

const LocalConvertPage = lazy(() => import('./pages/LocalConvertPage.jsx'));
const SmartOcrPage = lazy(() => import('./pages/SmartOcrPage.jsx'));
const SecureSharePage = lazy(() => import('./pages/SecureSharePage.jsx'));
const PdfEditorPage = lazy(() => import('./pages/PdfEditorPage.jsx'));
const ImageOptimizerPage = lazy(() => import('./pages/ImageOptimizerPage.jsx'));
const MediaTrimmerPage = lazy(() => import('./pages/MediaTrimmerPage.jsx'));
const ExifScrubberPage = lazy(() => import('./pages/ExifScrubberPage.jsx'));
const BatchWatermarkPage = lazy(() => import('./pages/BatchWatermarkPage.jsx'));
const MegaGridPage = lazy(() => import('./pages/MegaGridPage.jsx'));

const PAGE_COMPONENTS = {
  'local-convert': LocalConvertPage,
  'smart-ocr': SmartOcrPage,
  'secure-share': SecureSharePage,
  'pdf-editor': PdfEditorPage,
  'image-optimizer': ImageOptimizerPage,
  'media-trimmer': MediaTrimmerPage,
  megagrid: MegaGridPage,
  'exif-scrubber': ExifScrubberPage,
  'watermark-batch': BatchWatermarkPage
};

const statusToneClass = {
  done: 'text-emerald-300 border-emerald-400/25 bg-emerald-500/10',
  processing: 'text-sky-300 border-sky-400/25 bg-sky-500/10',
  error: 'text-rose-300 border-rose-400/25 bg-rose-500/10'
};

function formatRelativeTime(value, pick) {
  const ts = Number(value || 0);
  if (!ts) return pick('только что', 'just now');
  const diff = Date.now() - ts;
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return pick('только что', 'just now');
  if (minutes < 60) return pick(`${minutes} мин назад`, `${minutes}m ago`);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return pick(`${hours} ч назад`, `${hours}h ago`);
  const days = Math.round(hours / 24);
  return pick(`${days} дн назад`, `${days}d ago`);
}

function WorkspaceFeatureFallback({ pick }) {
  return (
    <section className="workspace-v3-surface rounded-[2rem] p-6 md:p-8 border border-white/10 bg-white/[0.04] backdrop-blur-2xl">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        {pick('Загрузка модуля', 'Loading module')}
      </div>
      <div className="mt-5 h-8 w-56 rounded-2xl bg-white/10 animate-pulse" />
      <div className="mt-4 h-4 w-full max-w-2xl rounded-xl bg-white/10 animate-pulse" />
      <div className="mt-2 h-4 w-full max-w-xl rounded-xl bg-white/10 animate-pulse" />
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-3xl bg-white/10 animate-pulse" />
        <div className="h-40 rounded-3xl bg-white/10 animate-pulse" />
      </div>
    </section>
  );
}

function WorkspaceOverview({ navigate, routes, recentJobs, routeLabelMap, pick }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
      <div className="workspace-v3-surface rounded-[2rem] p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
              {pick('Сценарии без лишних действий', 'Zero-UI workflows')}
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {pick('Выберите сценарий, а не список кнопок', 'Choose a workflow, not a tool list')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate(WORKSPACE_V3_DEFAULT_PATH)}
            className="workspace-v3-pill"
          >
            {pick('Начать с конвертера', 'Start with converter')}
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {routes.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                className="workspace-v3-module-card text-left"
              >
                <span className="workspace-v3-module-icon">
                  <Icon size={16} />
                </span>
                <div className="mt-4 text-base font-semibold text-white">{item.label}</div>
                <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
                <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-cyan-200/80">
                  {pick('Открыть модуль', 'Launch module')}
                  <ArrowRight size={12} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="workspace-v3-surface rounded-[2rem] p-5 md:p-6">
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
          {pick('Последняя активность', 'Recent activity')}
        </div>
        <h3 className="mt-2 text-xl font-semibold text-white">
          {pick('Локальная история', 'Local history')}
        </h3>
        <div className="mt-4 space-y-3">
          {recentJobs.length ? recentJobs.slice(0, 5).map((job) => {
            const status = String(job?.status || 'done').trim().toLowerCase();
            return (
              <div key={job.id} className="workspace-v3-history-row">
                <div>
                  <div className="text-sm font-medium text-white">
                    {routeLabelMap.get(job.tool) || job.tool || pick('Конвертация', 'Conversion')}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{formatRelativeTime(job.ts, pick)}</div>
                </div>
                <span className={`workspace-v3-status-chip ${statusToneClass[status] || statusToneClass.done}`}>
                  {pick(
                    status === 'processing' ? 'в работе' : status === 'error' ? 'ошибка' : 'готово',
                    status
                  )}
                </span>
              </div>
            );
          }) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-slate-400">
              {pick(
                'Как только вы что-то сконвертируете или отправите, история появится здесь.',
                'As soon as you convert or share something, it appears here.'
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function WorkspaceMobileRail({ navigate, routes, activeRoute, isOverview, pick }) {
  return (
    <div className="xl:hidden overflow-x-auto pb-1">
      <div className="flex min-w-max gap-3">
        <button
          type="button"
          onClick={() => navigate('/workspace')}
          className={`workspace-v3-pill ${isOverview ? 'workspace-v3-pill-accent' : ''}`}
        >
          <FolderKanban size={14} />
          {pick('Обзор', 'Overview')}
        </button>
        {routes.map((item) => {
          const Icon = item.icon;
          const active = activeRoute?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
              className={`workspace-v3-pill ${active ? 'workspace-v3-pill-accent' : ''}`}
            >
              <Icon size={14} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function WorkspaceV3Page({
  path,
  navigate,
  megadropPreparedFile = null,
  onConsumeMegadropPreparedFile = null,
  recentJobs = []
}) {
  const { isRussian, pick } = useWorkspaceLocale();
  const normalizedPath = normalizeWorkspacePath(path);
  const groups = useMemo(() => getWorkspaceRouteGroups(isRussian), [isRussian]);
  const allRoutes = useMemo(() => flattenWorkspaceRoutes(isRussian), [isRussian]);
  const activeRoute = matchWorkspaceRoute(normalizedPath, allRoutes);
  const ActiveFeature = activeRoute ? PAGE_COMPONENTS[activeRoute.id] : null;
  const isOverview = !activeRoute;
  const badges = useMemo(() => getWorkspaceHeroBadges(isRussian), [isRussian]);
  const routeLabelMap = useMemo(
    () => new Map(allRoutes.map((item) => [item.id, item.label])),
    [allRoutes]
  );

  const activeFeatureProps = activeRoute?.id === 'secure-share'
    ? {
        preparedFile: megadropPreparedFile?.file || null,
        onPreparedFileConsumed: onConsumeMegadropPreparedFile
      }
    : {};

  const todayDoneCount = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dayTs = startOfDay.getTime();
    return recentJobs.filter((job) => job.status === 'done' && Number(job.ts || 0) >= dayTs).length;
  }, [recentJobs]);

  const liveMetrics = [
    {
      label: pick('Модулей', 'Modules'),
      value: String(allRoutes.length).padStart(2, '0'),
      icon: Boxes
    },
    {
      label: pick('Сегодня', 'Today'),
      value: String(todayDoneCount).padStart(2, '0'),
      icon: Activity
    },
    {
      label: pick('Приватность', 'Privacy'),
      value: '100%',
      icon: ShieldCheck
    }
  ];

  return (
    <div className="workspace-v3-shell page-enter pt-24 pb-16 px-4 sm:px-5 lg:px-6">
      <div className="workspace-v3-gridline" />
      <div className="workspace-v3-glow workspace-v3-glow-a" />
      <div className="workspace-v3-glow workspace-v3-glow-b" />

      <div className="mx-auto max-w-[1600px] space-y-5">
        <WorkspaceMobileRail
          navigate={navigate}
          routes={allRoutes}
          activeRoute={activeRoute}
          isOverview={isOverview}
          pick={pick}
        />

        <div className={`grid gap-5 ${isOverview ? 'xl:grid-cols-[290px_minmax(0,1fr)] 2xl:grid-cols-[290px_minmax(0,1fr)_320px]' : 'xl:grid-cols-[290px_minmax(0,1fr)]'}`}>
          <aside className="hidden xl:block workspace-v3-surface rounded-[2rem] p-4 md:p-5 h-fit xl:sticky xl:top-24">
            <div className="flex items-center gap-3 px-1 py-1">
              <span className="workspace-v3-module-icon">
                <FolderKanban size={18} />
              </span>
              <div>
                <div className="text-sm font-semibold text-white">Workspace 3.0</div>
                <div className="text-xs text-slate-400">
                  {pick('Пространственная панель управления', 'Spatial control room')}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {groups.map((group) => (
                <div key={group.id}>
                  <div className="px-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">
                    {group.label}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeRoute?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigate(item.path)}
                          className={`workspace-v3-nav-item ${active ? 'is-active' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="workspace-v3-nav-icon">
                              <Icon size={15} />
                            </span>
                            <div>
                              <div className="text-sm font-medium text-white">{item.label}</div>
                              <div className="mt-1 text-xs text-slate-400">{item.subtitle}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main className="min-w-0 space-y-5">
            {isOverview ? (
              <section className="workspace-v3-surface workspace-v3-hero rounded-[2rem] p-5 md:p-6 lg:p-7 overflow-hidden">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-4xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200">
                      <Sparkles size={13} />
                      {pick('MegaConvert Workspace', 'MegaConvert Workspace')}
                    </div>
                    <h1 className="mt-4 text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white">
                      {pick('Выберите следующий локальный сценарий', 'Choose your next local-first workflow')}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm md:text-base text-slate-300 leading-7">
                      {pick(
                        'Единая control room для конвертации в браузере, AI-инструментов, OCR, PDF-сборки и прямой передачи файлов между устройствами.',
                        'One spatial control room for browser-native conversion, AI tools, OCR, PDF editing and direct peer-to-peer file delivery.'
                      )}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {badges.map((badge) => {
                        const Icon = badge.icon;
                        return (
                          <span key={badge.id} className="workspace-v3-pill">
                            <Icon size={13} />
                            {badge.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:w-full lg:max-w-[360px]">
                    {liveMetrics.map((metric) => {
                      const Icon = metric.icon;
                      return (
                        <div key={metric.label} className="workspace-v3-stat-card">
                          <div className="flex items-center justify-between gap-2 text-slate-400">
                            <span className="text-[10px] uppercase tracking-[0.22em] whitespace-nowrap">{metric.label}</span>
                            <Icon size={14} />
                          </div>
                          <div className="mt-3 text-2xl font-semibold text-white">{metric.value}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : (
              <section className="workspace-v3-surface rounded-[1.75rem] p-4 md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-300">
                      <Sparkles size={13} />
                      {pick('Внутри Workspace 3.0', 'Inside Workspace 3.0')}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate('/workspace')}
                        className="workspace-v3-pill"
                      >
                        {pick('Все модули', 'All modules')}
                        <ArrowRight size={14} />
                      </button>
                      <span className="workspace-v3-pill workspace-v3-pill-accent">{activeRoute.label}</span>
                      <span className="workspace-v3-pill">{activeRoute.subtitle}</span>
                      {megadropPreparedFile?.file && activeRoute.id !== 'secure-share' ? (
                        <button
                          type="button"
                          onClick={() => navigate('/workspace/secure-share')}
                          className="workspace-v3-pill workspace-v3-pill-strong"
                        >
                          <QrCode size={13} />
                          {pick('Открыть MegaDrop', 'Open MegaDrop')}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300 max-w-xl">
                    {pick(
                      'Модуль открыт прямо внутри общего workspace-shell, без лишних экранов и дублей интерфейса.',
                      'This module is mounted inside the workspace shell without extra chrome or duplicate hero blocks.'
                    )}
                  </div>
                </div>
              </section>
            )}

            {ActiveFeature ? (
              <Suspense fallback={<WorkspaceFeatureFallback pick={pick} />}>
                <ActiveFeature {...activeFeatureProps} />
              </Suspense>
            ) : (
              <WorkspaceOverview
                navigate={navigate}
                routes={allRoutes}
                recentJobs={recentJobs}
                routeLabelMap={routeLabelMap}
                pick={pick}
              />
            )}
          </main>

          {isOverview ? (
            <aside className="hidden 2xl:block space-y-4">
              <section className="workspace-v3-surface rounded-[2rem] p-5 md:p-6">
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  {pick('Сейчас активно', 'Now active')}
                </div>
                <div className="mt-2 text-xl font-semibold text-white">{pick('Обзор', 'Overview')}</div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {pick(
                    'Открывайте любой модуль из левой панели. Конвертация, PDF, OCR, AI и прямой handoff живут в одной среде.',
                    'Use the left rail to open any module. Local-first media pipelines and direct sharing sit side by side by design.'
                  )}
                </p>
                <div className="mt-4 space-y-3">
                  <div className="workspace-v3-rail-card">
                    <div className="flex items-center gap-2 text-slate-200">
                      <Zap size={15} />
                      {pick('Мгновенная локальная обработка', 'Instant local compute')}
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      {pick(
                        'WASM, OCR и медиа-пайплайны остаются на устройстве пользователя там, где это возможно.',
                        'WASM, OCR and media flows stay client-side whenever possible.'
                      )}
                    </div>
                  </div>
                  <div className="workspace-v3-rail-card">
                    <div className="flex items-center gap-2 text-slate-200">
                      <Clock3 size={15} />
                      {pick('Последняя очередь', 'Recent queue')}
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      {recentJobs.length
                        ? pick(
                          `${recentJobs.length} локальных задач сохранено в этом браузере.`,
                          `${recentJobs.length} local jobs tracked in this browser.`
                        )
                        : pick('Пока нет локальных задач в этом браузере.', 'No local jobs yet in this browser session.')}
                    </div>
                  </div>
                </div>
              </section>

              <section className="workspace-v3-surface rounded-[2rem] p-5 md:p-6">
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">MegaDrop</div>
                <div className="mt-2 text-xl font-semibold text-white">
                  {pick('Прямая передача между устройствами', 'Direct device handoff')}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {megadropPreparedFile?.file
                    ? pick(`Файл готов к передаче: ${megadropPreparedFile.file.name}`, `Prepared file: ${megadropPreparedFile.file.name}`)
                    : pick(
                      'После любой конвертации можно сразу передать результат в MegaDrop и отправить файл на другое устройство через WebRTC.',
                      'Finish any conversion, then push the result into MegaDrop to beam it to another device over WebRTC.'
                    )}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/workspace/secure-share')}
                  className="workspace-v3-pill workspace-v3-pill-strong mt-4"
                >
                  {pick('Открыть MegaDrop', 'Open MegaDrop')}
                  <ArrowRight size={14} />
                </button>
              </section>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
