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
  WORKSPACE_V3_GROUPS,
  flattenWorkspaceRoutes,
  getWorkspaceHeroBadges,
  matchWorkspaceRoute,
  normalizeWorkspacePath
} from './routes.js';

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

function formatRelativeTime(value) {
  const ts = Number(value || 0);
  if (!ts) return 'just now';
  const diff = Date.now() - ts;
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function WorkspaceFeatureFallback() {
  return (
    <section className="workspace-v3-surface rounded-[2rem] p-6 md:p-8 border border-white/10 bg-white/[0.04] backdrop-blur-2xl">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        Workspace Module
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

function WorkspaceOverview({ navigate, routes, recentJobs, routeLabelMap }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
      <div className="workspace-v3-surface rounded-[2rem] p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Zero-UI modules</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Choose a workflow, not a tool list</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate(WORKSPACE_V3_DEFAULT_PATH)}
            className="workspace-v3-pill"
          >
            Start with converter
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
                  Launch route
                  <ArrowRight size={12} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="workspace-v3-surface rounded-[2rem] p-5 md:p-6">
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Recent activity</div>
        <h3 className="mt-2 text-xl font-semibold text-white">Real local history</h3>
        <div className="mt-4 space-y-3">
          {recentJobs.length ? recentJobs.slice(0, 5).map((job) => {
            const status = String(job?.status || 'done').trim().toLowerCase();
            return (
              <div key={job.id} className="workspace-v3-history-row">
                <div>
                  <div className="text-sm font-medium text-white">{routeLabelMap.get(job.tool) || job.tool || 'Conversion'}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatRelativeTime(job.ts)}</div>
                </div>
                <span className={`workspace-v3-status-chip ${statusToneClass[status] || statusToneClass.done}`}>
                  {status}
                </span>
              </div>
            );
          }) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-slate-400">
              As soon as you convert or share something, it appears here.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function WorkspaceV3Page({
  path,
  navigate,
  megadropPreparedFile = null,
  onConsumeMegadropPreparedFile = null,
  recentJobs = []
}) {
  const normalizedPath = normalizeWorkspacePath(path);
  const activeRoute = matchWorkspaceRoute(normalizedPath);
  const ActiveFeature = activeRoute ? PAGE_COMPONENTS[activeRoute.id] : null;
  const badges = getWorkspaceHeroBadges();
  const allRoutes = useMemo(() => flattenWorkspaceRoutes(), []);
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
      label: 'Modules',
      value: String(allRoutes.length).padStart(2, '0'),
      icon: Boxes
    },
    {
      label: 'Today',
      value: String(todayDoneCount).padStart(2, '0'),
      icon: Activity
    },
    {
      label: 'Privacy',
      value: '100%',
      icon: ShieldCheck
    }
  ];

  return (
    <div className="workspace-v3-shell page-enter pt-28 pb-16 px-4">
      <div className="workspace-v3-gridline" />
      <div className="workspace-v3-glow workspace-v3-glow-a" />
      <div className="workspace-v3-glow workspace-v3-glow-b" />

      <div className="max-w-7xl mx-auto grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_290px]">
        <aside className="workspace-v3-surface rounded-[2rem] p-4 md:p-5 h-fit xl:sticky xl:top-24">
          <div className="flex items-center gap-3 px-1 py-1">
            <span className="workspace-v3-module-icon">
              <FolderKanban size={18} />
            </span>
            <div>
              <div className="text-sm font-semibold text-white">Workspace 3.0</div>
              <div className="text-xs text-slate-400">Spatial control room</div>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {WORKSPACE_V3_GROUPS.map((group) => (
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

        <main className="space-y-5 min-w-0">
          <section className="workspace-v3-surface workspace-v3-hero rounded-[2rem] p-5 md:p-6 lg:p-7 overflow-hidden">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200">
                  <Sparkles size={13} />
                  MegaConvert Workspace
                </div>
                <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-white">
                  {activeRoute ? activeRoute.label : 'Choose your next local-first workflow'}
                </h1>
                <p className="mt-3 max-w-2xl text-sm md:text-base text-slate-300 leading-7">
                  {activeRoute
                    ? `${activeRoute.subtitle}. Every module here is tuned for local processing, privacy and premium handoff between conversion, AI and direct sharing.`
                    : 'One spatial control room for browser-native conversion, AI tools, OCR, PDF editing and direct peer-to-peer file delivery.'}
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
                  {megadropPreparedFile?.file ? (
                    <span className="workspace-v3-pill workspace-v3-pill-accent">
                      <QrCode size={13} />
                      MegaDrop asset ready
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
                {liveMetrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div key={metric.label} className="workspace-v3-stat-card">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] uppercase tracking-[0.24em]">{metric.label}</span>
                        <Icon size={14} />
                      </div>
                      <div className="mt-3 text-2xl font-semibold text-white">{metric.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {ActiveFeature ? (
            <Suspense fallback={<WorkspaceFeatureFallback />}>
              <ActiveFeature {...activeFeatureProps} />
            </Suspense>
          ) : (
            <WorkspaceOverview
              navigate={navigate}
              routes={allRoutes}
              recentJobs={recentJobs}
              routeLabelMap={routeLabelMap}
            />
          )}
        </main>

        <aside className="space-y-4">
          <section className="workspace-v3-surface rounded-[2rem] p-5 md:p-6">
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Now active</div>
            <div className="mt-2 text-xl font-semibold text-white">{activeRoute ? activeRoute.label : 'Overview'}</div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {activeRoute
                ? 'This module is already mounted inside the workspace shell. You can switch pipelines without leaving the same premium environment.'
                : 'Use the left rail to open any module. Local-first media pipelines and direct sharing sit side by side by design.'}
            </p>
            <div className="mt-4 space-y-3">
              <div className="workspace-v3-rail-card">
                <div className="flex items-center gap-2 text-slate-200">
                  <Zap size={15} />
                  Instant local compute
                </div>
                <div className="mt-2 text-sm text-slate-400">WASM, OCR and media flows stay client-side whenever possible.</div>
              </div>
              <div className="workspace-v3-rail-card">
                <div className="flex items-center gap-2 text-slate-200">
                  <Clock3 size={15} />
                  Recent queue
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  {recentJobs.length ? `${recentJobs.length} local jobs tracked in this browser.` : 'No local jobs yet in this browser session.'}
                </div>
              </div>
            </div>
          </section>

          <section className="workspace-v3-surface rounded-[2rem] p-5 md:p-6">
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">MegaDrop</div>
            <div className="mt-2 text-xl font-semibold text-white">Direct device handoff</div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {megadropPreparedFile?.file
                ? `Prepared file: ${megadropPreparedFile.file.name}`
                : 'Finish any conversion, then push the result into MegaDrop to beam it to another device over WebRTC.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/workspace/secure-share')}
              className="workspace-v3-pill workspace-v3-pill-strong mt-4"
            >
              Open MegaDrop
              <ArrowRight size={14} />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
