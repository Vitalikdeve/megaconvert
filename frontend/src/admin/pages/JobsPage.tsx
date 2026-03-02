import React from 'react';
import { ModuleShell } from '../components/ModuleShell';

export const JobsPage = () => (
  <ModuleShell title="Jobs" subtitle="Filter jobs, inspect logs, replay or cancel failed runs.">
    <div className="rounded-xl border border-slate-200 p-3 text-sm">Jobs table + logs viewer module.</div>
  </ModuleShell>
);

