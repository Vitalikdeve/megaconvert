import React from 'react';
import { Sparkles } from 'lucide-react';

export default function WorkspaceModuleShell({
  eyebrow = 'Workspace Module',
  title,
  description,
  badges = [],
  metrics = [],
  asideCards = [],
  children
}) {
  return (
    <section className="space-y-5">
      <div className="workspace-v3-surface workspace-v3-hero rounded-[2rem] p-5 md:p-6 lg:p-7 overflow-hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200">
              <Sparkles size={13} />
              {eyebrow}
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-white">{title}</h2>
            <p className="mt-3 max-w-2xl text-sm md:text-base leading-7 text-slate-300">
              {description}
            </p>
            {badges.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <span key={badge} className="workspace-v3-pill">
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {metrics.length ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className="workspace-v3-stat-card">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[11px] uppercase tracking-[0.24em]">{metric.label}</span>
                      {Icon ? <Icon size={14} /> : null}
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-white">{metric.value}</div>
                    {metric.note ? <div className="mt-2 text-xs text-slate-500">{metric.note}</div> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0">
          {children}
        </div>
        <aside className="space-y-4">
          {asideCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="workspace-v3-surface rounded-[2rem] p-5 md:p-6">
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{card.eyebrow}</div>
                <div className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
                  {Icon ? <Icon size={18} /> : null}
                  {card.title}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{card.copy}</p>
              </div>
            );
          })}
        </aside>
      </div>
    </section>
  );
}
