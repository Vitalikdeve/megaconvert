import React from 'react';
import { ModuleShell } from '../components/ModuleShell';

export const AiControlPage = () => (
  <ModuleShell title="AI Control" subtitle="Recommendation quality, feedback and rule thresholds.">
    <div className="grid md:grid-cols-2 gap-3 text-sm">
      <div className="rounded-xl border border-slate-200 p-3">Recommendation usage rate: 48%</div>
      <div className="rounded-xl border border-slate-200 p-3">Helpful feedback ratio: 82%</div>
      <div className="rounded-xl border border-slate-200 p-3">Rules editor module</div>
      <div className="rounded-xl border border-slate-200 p-3">AI config toggles</div>
    </div>
  </ModuleShell>
);

