import React from 'react';

export default function LegalPageLayout({ title, updatedAt, children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#030303] text-white">
      <div className="max-w-3xl mx-auto pt-24 pb-12 px-6">
        <div className="mb-10 space-y-4">
          <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/42">
            Legal
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-medium tracking-tight text-white/92 sm:text-5xl">
              {title}
            </h1>
            <p className="text-sm text-white/42">
              Last updated: {updatedAt}
            </p>
          </div>
        </div>

        <article className="prose prose-invert prose-headings:font-medium prose-headings:tracking-tight prose-p:text-white/66 prose-li:text-white/66 prose-strong:text-white prose-a:text-white prose-a:no-underline hover:prose-a:text-cyan-200 prose-hr:border-white/10 max-w-none">
          {children}
        </article>
      </div>
    </div>
  );
}
