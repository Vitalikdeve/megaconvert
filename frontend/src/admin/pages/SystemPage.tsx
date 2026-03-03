import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleShell } from '../components/ModuleShell';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminPermissions } from '../core/useAdminPermissions';

export const SystemPage = () => {
  const { api } = useAdminAuth();
  const { can } = useAdminPermissions();
  const canEdit = can('system', 'edit');
  const [health, setHealth] = useState(null);
  const [formats, setFormats] = useState([]);
  const [checks, setChecks] = useState([]);
  const [synthetic, setSynthetic] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingTool, setPendingTool] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [healthRes, checksRes, syntheticRes, alertsRes, formatsRes] = await Promise.all([
        fetch('/api/health').then((res) => res.json()),
        api.getWorkerHealthChecks(30),
        api.getWorkerSyntheticResults({ limit: 100 }),
        api.getWorkerAlerts(60),
        api.getWorkerFormats()
      ]);
      setHealth(healthRes || null);
      setChecks(Array.isArray(checksRes?.items) ? checksRes.items : []);
      setSynthetic(Array.isArray(syntheticRes?.items) ? syntheticRes.items : []);
      setAlerts(Array.isArray(alertsRes?.items) ? alertsRes.items : []);
      setFormats(Array.isArray(formatsRes?.items) ? formatsRes.items : []);
    } catch (err) {
      setError(err?.message || 'Failed to load system reliability data');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const syntheticTotals = useMemo(() => {
    const total = synthetic.length;
    const failed = synthetic.filter((row) => row.success !== true).length;
    const successRate = total ? ((total - failed) / total) : 0;
    return { total, failed, successRate };
  }, [synthetic]);

  const onToggleFormat = async (item) => {
    if (!canEdit || !item?.tool) return;
    setPendingTool(String(item.tool));
    setError('');
    try {
      await api.updateWorkerFormat(item.tool, {
        disabled: !item.disabled,
        reason: item.disabled ? null : 'Disabled from admin',
        fallback_tool: item.fallback_tool || null
      });
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to update format state');
    } finally {
      setPendingTool('');
    }
  };

  return (
    <ModuleShell title="System" subtitle="Health checks, queue state and infrastructure indicators.">
      {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}
      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <div className="text-slate-500">API health</div>
          <div className="text-xl font-semibold text-slate-900 mt-1">{health?.ok ? 'healthy' : 'unknown'}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <div className="text-slate-500">Synthetic tests</div>
          <div className="text-xl font-semibold text-slate-900 mt-1">{syntheticTotals.total}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <div className="text-slate-500">Synthetic success</div>
          <div className="text-xl font-semibold text-slate-900 mt-1">{(syntheticTotals.successRate * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <div className="text-slate-500">Alerts</div>
          <div className="text-xl font-semibold text-slate-900 mt-1">{alerts.length}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="font-semibold text-slate-900">Worker startup checks</div>
          <button onClick={() => void load()} className="px-3 py-2 rounded-xl border border-slate-300 text-sm">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {checks.length === 0 ? (
          <div className="text-sm text-slate-500">No startup checks reported yet.</div>
        ) : (
          <div className="space-y-2 text-sm">
            {checks.slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 px-3 py-2">
                <div className="font-medium text-slate-800">{item.worker_id} · {item.status}</div>
                <div className="text-xs text-slate-500 mt-1">{item.created_at}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
        <div className="font-semibold text-slate-900 mb-2">Format health and auto-disable state</div>
        {formats.length === 0 ? (
          <div className="text-sm text-slate-500">No format state available.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">Tool</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Failure streak</th>
                  <th className="py-2">Last synthetic</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {formats.slice(0, 120).map((item) => (
                  <tr key={item.tool} className="border-t border-slate-100">
                    <td className="py-2">{item.tool}</td>
                    <td className="py-2">{item.disabled ? 'disabled' : 'active'}</td>
                    <td className="py-2">{item.failure_streak || 0}</td>
                    <td className="py-2 text-xs text-slate-500">{item.last_failure_at || item.last_success_at || '-'}</td>
                    <td className="py-2">
                      <button
                        onClick={() => void onToggleFormat(item)}
                        disabled={!canEdit || pendingTool === item.tool}
                        className="px-2 py-1 rounded-lg border border-slate-300 text-xs disabled:opacity-50"
                      >
                        {pendingTool === item.tool ? 'Saving...' : (item.disabled ? 'Enable' : 'Disable')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="font-semibold text-slate-900 mb-2">Recent reliability alerts</div>
        {alerts.length === 0 ? (
          <div className="text-sm text-slate-500">No alerts.</div>
        ) : (
          <div className="space-y-2 text-sm">
            {alerts.slice(0, 20).map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 px-3 py-2">
                <div className="font-medium text-slate-800">{item.type} · {item.severity}</div>
                <div className="text-slate-600 mt-1">{item.message}</div>
                <div className="text-xs text-slate-500 mt-1">{item.created_at}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleShell>
  );
};
