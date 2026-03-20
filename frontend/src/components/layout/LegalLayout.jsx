import React from 'react';
import { Link } from 'react-router-dom';

export default function LegalLayout({ title, subtitle, children }) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#050509] text-slate-300">
      <div className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-20">
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#00E5FF] transition hover:border-cyan-200/45 hover:text-cyan-200"
          to="/"
        >
          Назад на главную
        </Link>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-7 shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-10">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
          {subtitle ? <p className="mt-4 text-base leading-7 text-slate-300">{subtitle}</p> : null}

          <article className="mt-8 space-y-7 leading-7 text-slate-300 [&_a]:text-[#00E5FF] [&_a]:transition [&_a:hover]:text-cyan-200 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
            {children}
          </article>
        </section>
      </div>
    </main>
  );
}
