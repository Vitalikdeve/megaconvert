import React from 'react';
import { Sparkles } from 'lucide-react';

export default function FeaturePlaceholderPage({
  eyebrow = '',
  title = '',
  description = '',
  stack = [],
  milestones = []
}) {
  return (
    <section className="mc-card rounded-3xl p-6 md:p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 dark:border-blue-400/20 bg-blue-50/80 dark:bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-200">
        <Sparkles size={13} />
        {eyebrow || 'MegaConvert 3.0'}
      </div>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-3xl">
        {description}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-4">
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Техстек</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(stack.length ? stack : ['TBD']).map((item) => (
              <span key={item} className="rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-4">
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Этап внедрения</div>
          <div className="mt-3 space-y-2">
            {(milestones.length ? milestones : ['Каркас страницы создан.']).map((item) => (
              <div key={item} className="rounded-xl border border-slate-100 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

