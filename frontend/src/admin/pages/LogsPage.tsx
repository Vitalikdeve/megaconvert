import React from 'react';
import { ModuleShell } from '../components/ModuleShell';

export const LogsPage = () => (
  <ModuleShell title="Logs" subtitle="Unified event, error and action logs.">
    <div className="rounded-xl border border-slate-200 p-3 text-sm">Log viewer module (errors, actions, api).</div>
  </ModuleShell>
);

