import React from 'react';
import PageTransition from '../../../components/PageTransition.jsx';

export default function AuthSceneShell({
  pageKey,
  eyebrow,
  title,
  subtitle,
  sideLabel,
  sideTitle,
  sideCopy,
  sidePoints = [],
  children,
  footer = null
}) {
  return (
    <PageTransition pageKey={pageKey}>
      <section className="auth-scene min-h-[calc(100vh-5rem)] pt-24 pb-12 px-4">
        <div className="auth-scene-mesh" />
        <div className="auth-scene-glow auth-scene-glow-a" />
        <div className="auth-scene-glow auth-scene-glow-b" />
        <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] items-stretch">
          <aside className="auth-scene-copy">
            <div className="auth-scene-copy-badge">{sideLabel}</div>
            <h1 className="auth-scene-copy-title">{sideTitle}</h1>
            <p className="auth-scene-copy-text">{sideCopy}</p>
            <div className="auth-scene-copy-grid">
              {sidePoints.map((point) => (
                <div key={point.title} className="auth-scene-copy-card">
                  <div className="auth-scene-copy-card-title">{point.title}</div>
                  <div className="auth-scene-copy-card-copy">{point.copy}</div>
                </div>
              ))}
            </div>
          </aside>

          <div className="auth-scene-panel">
            <div className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
              {eyebrow}
            </div>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {title}
            </h2>
            <p className="mt-3 max-w-xl text-sm md:text-base text-slate-600 dark:text-slate-300">
              {subtitle}
            </p>
            <div className="mt-7">
              {children}
            </div>
            {footer ? <div className="mt-6">{footer}</div> : null}
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
