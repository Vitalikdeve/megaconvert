import React from 'react';

export const StatCard = ({ title, value }) => (
  <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200/80 p-5 shadow-sm">
    <div className="text-xs uppercase tracking-wider text-slate-500">{title}</div>
    <div className="text-3xl font-semibold text-slate-900 mt-3">{value}</div>
  </div>
);
