import React from 'react';
import { ModuleShell } from '../components/ModuleShell';

export const SecurityPage = () => (
  <ModuleShell title="Security" subtitle="Suspicious activity, login attempts and audit controls.">
    <div className="grid md:grid-cols-3 gap-3 text-sm">
      <div className="rounded-xl border border-slate-200 p-3">Login attempts: 41</div>
      <div className="rounded-xl border border-slate-200 p-3">Blocked requests: 12</div>
      <div className="rounded-xl border border-slate-200 p-3">Open incidents: 0</div>
    </div>
  </ModuleShell>
);

