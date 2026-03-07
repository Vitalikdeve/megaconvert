import React from 'react';
import { ArrowRight, FolderKanban, Sparkles } from 'lucide-react';
import {
  WORKSPACE_V3_DEFAULT_PATH,
  WORKSPACE_V3_GROUPS,
  getWorkspaceHeroBadges,
  matchWorkspaceRoute,
  normalizeWorkspacePath
} from './routes.js';
import LocalConvertPage from './pages/LocalConvertPage.jsx';
import SmartOcrPage from './pages/SmartOcrPage.jsx';
import SecureSharePage from './pages/SecureSharePage.jsx';
import PdfEditorPage from './pages/PdfEditorPage.jsx';
import ImageOptimizerPage from './pages/ImageOptimizerPage.jsx';
import MediaTrimmerPage from './pages/MediaTrimmerPage.jsx';
import ExifScrubberPage from './pages/ExifScrubberPage.jsx';
import BatchWatermarkPage from './pages/BatchWatermarkPage.jsx';

const PAGE_COMPONENTS = {
  'local-convert': LocalConvertPage,
  'smart-ocr': SmartOcrPage,
  'secure-share': SecureSharePage,
  'pdf-editor': PdfEditorPage,
  'image-optimizer': ImageOptimizerPage,
  'media-trimmer': MediaTrimmerPage,
  'exif-scrubber': ExifScrubberPage,
  'watermark-batch': BatchWatermarkPage
};

function WorkspaceOverview({ navigate }) {
  const badges = getWorkspaceHeroBadges();
  return (
    <section className="mc-card rounded-3xl p-6 md:p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 dark:border-emerald-400/20 bg-emerald-50/80 dark:bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
        <Sparkles size={13} />
        MegaConvert 3.0 Foundation
      </div>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Клиент-центричная архитектура для 1GB VPS
      </h2>
      <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-3xl">
        Базовая структура маршрутов и навигации подготовлена. Все тяжелые вычисления выносятся в браузер пользователя: WASM, OCR, PDF и медиа-пайплайны.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {badges.map((badge) => {
          const Icon = badge.icon;
          return (
            <span key={badge.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200">
              <Icon size={13} />
              {badge.label}
            </span>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => navigate(WORKSPACE_V3_DEFAULT_PATH)}
        className="mt-7 inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all duration-300 ease-out hover:scale-[1.02]"
      >
        Открыть первый модуль
        <ArrowRight size={15} />
      </button>
    </section>
  );
}

export default function WorkspaceV3Page({ path, navigate }) {
  const normalizedPath = normalizeWorkspacePath(path);
  const activeRoute = matchWorkspaceRoute(normalizedPath);
  const ActiveFeature = activeRoute ? PAGE_COMPONENTS[activeRoute.id] : null;

  return (
    <div className="pt-28 pb-16 px-4 page-enter">
      <div className="max-w-7xl mx-auto grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="mc-card rounded-3xl p-4 md:p-5 h-fit lg:sticky lg:top-24">
          <div className="flex items-center gap-3 px-2 py-1">
            <span className="h-10 w-10 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-slate-200">
              <FolderKanban size={18} />
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Workspace 3.0</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Киллер-фичи MegaConvert</div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {WORKSPACE_V3_GROUPS.map((group) => (
              <div key={group.id}>
                <div className="px-2 text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {group.label}
                </div>
                <div className="mt-2 space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeRoute?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className={`w-full text-left rounded-2xl px-3 py-2.5 border transition-all duration-300 ease-out ${
                          active
                            ? 'border-blue-200 dark:border-blue-400/25 bg-blue-50 dark:bg-blue-500/12'
                            : 'border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={15} className={active ? 'text-blue-700 dark:text-blue-200' : 'text-slate-500 dark:text-slate-300'} />
                          <span className={`text-sm font-medium ${active ? 'text-blue-800 dark:text-blue-100' : 'text-slate-800 dark:text-slate-100'}`}>
                            {item.label}
                          </span>
                        </div>
                        <div className={`mt-1 text-xs ${active ? 'text-blue-700/80 dark:text-blue-200/80' : 'text-slate-500 dark:text-slate-400'}`}>
                          {item.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="space-y-4">
          <div className="mc-card rounded-3xl p-5 md:p-6">
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">MegaConvert Platform</div>
            <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight bg-gradient-to-r from-slate-900 via-blue-700 to-cyan-600 dark:from-slate-100 dark:via-blue-200 dark:to-cyan-200 bg-clip-text text-transparent">
              Workspace 3.0
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Навигационный каркас для 8 новых модулей. Реализация логики будет подключаться поэтапно, начиная с клиентских pipeline.
            </p>
          </div>

          {ActiveFeature ? <ActiveFeature /> : <WorkspaceOverview navigate={navigate} />}
        </main>
      </div>
    </div>
  );
}

