import React from 'react';
export const ModuleShell = ({ title, subtitle, children }) => (
  <div className="mc-card p-5">
    <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
    <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    {children ? <div className="mt-4">{children}</div> : null}
  </div>
);
