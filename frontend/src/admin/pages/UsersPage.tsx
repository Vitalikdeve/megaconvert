import React from 'react';
import { ModuleShell } from '../components/ModuleShell';

export const UsersPage = () => (
  <ModuleShell
    title="Users"
    subtitle="Search users, inspect plans, and view usage profile."
  >
    <div className="rounded-xl border border-slate-200 p-3 text-sm">Users table and profile drawer module.</div>
  </ModuleShell>
);

