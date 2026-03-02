import React from 'react';
import { ModuleShell } from '../components/ModuleShell';

export const BillingPage = () => (
  <ModuleShell title="Billing" subtitle="Revenue, subscriptions, churn and plan controls.">
    <div className="grid md:grid-cols-3 gap-3 text-sm">
      <div className="rounded-xl border border-slate-200 p-3">MRR: $12,420</div>
      <div className="rounded-xl border border-slate-200 p-3">Active Subs: 316</div>
      <div className="rounded-xl border border-slate-200 p-3">Churn: 2.1%</div>
    </div>
  </ModuleShell>
);

