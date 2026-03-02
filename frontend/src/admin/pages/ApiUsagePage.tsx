import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleShell } from '../components/ModuleShell';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminPermissions } from '../core/useAdminPermissions';

export const ApiUsagePage = () => {
  const { api } = useAdminAuth();
  const { can } = useAdminPermissions();
  const canEdit = can('api', 'edit');
  const [range, setRange] = useState('7d');
  const [userFilter, setUserFilter] = useState('');
  const [usage, setUsage] = useState(null);
  const [keys, setKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [allowlistDrafts, setAllowlistDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usagePayload, keysPayload, webhooksPayload, deliveriesPayload] = await Promise.all([
        api.getApiUsageMetrics(range),
        api.getApiKeys(userFilter),
        api.getApiWebhooks({ user_id: userFilter || undefined }),
        api.getApiWebhookDeliveries({ limit: 100 })
      ]);
      setUsage(usagePayload || null);
      const nextKeys = Array.isArray(keysPayload?.items) ? keysPayload.items : [];
      setKeys(nextKeys);
      setWebhooks(Array.isArray(webhooksPayload?.items) ? webhooksPayload.items : []);
      setDeliveries(Array.isArray(deliveriesPayload?.items) ? deliveriesPayload.items : []);
      const drafts = {};
      nextKeys.forEach((item) => {
        drafts[item.id] = Array.isArray(item?.allowed_ips) ? item.allowed_ips.join(', ') : '';
      });
      setAllowlistDrafts(drafts);
    } catch (err) {
      setError(err?.message || 'Failed to load API usage');
    } finally {
      setLoading(false);
    }
  }, [api, range, userFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRevoke = async (id) => {
    if (!canEdit || !id) return;
    setPendingId(`revoke:${id}`);
    try {
      await api.revokeApiKey(id);
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to revoke API key');
    } finally {
      setPendingId('');
    }
  };

  const onPlanChange = async (item, plan) => {
    if (!canEdit || !item?.id) return;
    setPendingId(`plan:${item.id}`);
    try {
      await api.updateApiKeyLimits(item.id, { plan });
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to update API key limits');
    } finally {
      setPendingId('');
    }
  };

  const onAllowlistSave = async (item) => {
    if (!canEdit || !item?.id) return;
    const text = String(allowlistDrafts[item.id] || '');
    const allowedIps = text.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean);
    setPendingId(`allowlist:${item.id}`);
    try {
      await api.updateApiKeyLimits(item.id, {
        plan: item.plan || 'free',
        allowed_ips: allowedIps
      });
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to update allowlist');
    } finally {
      setPendingId('');
    }
  };

  const topKeys = useMemo(() => Array.isArray(usage?.top_keys) ? usage.top_keys : [], [usage?.top_keys]);
  const totals = usage?.totals || { requests: 0, errors: 0, error_rate: 0, avg_latency_ms: 0 };

  return (
    <ModuleShell title="API Usage" subtitle="Requests, errors, limits and API key operations.">
      {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}
      <div className="grid md:grid-cols-[160px_1fr_auto] gap-3 mb-4">
        <select value={range} onChange={(event) => setRange(event.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 text-sm">
          <option value="24h">24h</option>
          <option value="7d">7d</option>
          <option value="30d">30d</option>
        </select>
        <input
          type="text"
          value={userFilter}
          onChange={(event) => setUserFilter(event.target.value)}
          placeholder="Filter by user id"
          className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
        />
        <button onClick={() => void load()} className="px-3 py-2 rounded-xl border border-slate-300 text-sm">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Requests</div><div className="text-xl font-semibold text-slate-900 mt-1">{totals.requests}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Errors</div><div className="text-xl font-semibold text-slate-900 mt-1">{totals.errors}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Error rate</div><div className="text-xl font-semibold text-slate-900 mt-1">{Number(totals.error_rate || 0) * 100}%</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><div className="text-slate-500">Avg latency</div><div className="text-xl font-semibold text-slate-900 mt-1">{totals.avg_latency_ms} ms</div></div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
        <div className="font-semibold text-slate-900 mb-2">Top API keys by traffic</div>
        {topKeys.length === 0 ? (
          <div className="text-sm text-slate-500">No usage events for selected range.</div>
        ) : (
          <div className="space-y-2 text-sm">
            {topKeys.map((row) => (
              <div key={row.api_key_id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <div className="text-slate-700 font-medium">{row.api_key_id}</div>
                <div className="text-slate-500">req: {row.requests} · err: {row.errors} · avg: {row.avg_latency_ms}ms</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="font-semibold text-slate-900 mb-2">API Keys</div>
        {keys.length === 0 ? (
          <div className="text-sm text-slate-500">No API keys found.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">User</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Plan</th>
                  <th className="py-2">Rate/min</th>
                  <th className="py-2">Quota/month</th>
                  <th className="py-2">Allowed IPs</th>
                  <th className="py-2">Last used</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="py-2">{item.user_id}</td>
                    <td className="py-2">
                      <div className="font-medium text-slate-800">{item.name}</div>
                      <div className="text-[11px] text-slate-500">{item.key_prefix}...</div>
                    </td>
                    <td className="py-2">{String(item.plan || 'free').toUpperCase()}</td>
                    <td className="py-2">{item.rate_limit_per_min}</td>
                    <td className="py-2">{item.quota_monthly}</td>
                    <td className="py-2">
                      <div className="flex flex-col gap-2 min-w-[220px]">
                        <input
                          type="text"
                          value={allowlistDrafts[item.id] || ''}
                          onChange={(event) => setAllowlistDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                          placeholder="127.0.0.1, 10.0.0.1"
                          className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => void onAllowlistSave(item)}
                          disabled={!canEdit || pendingId === `allowlist:${item.id}`}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-300 disabled:opacity-50"
                        >
                          {pendingId === `allowlist:${item.id}` ? 'Saving...' : 'Save IPs'}
                        </button>
                      </div>
                    </td>
                    <td className="py-2">{item.last_used_at ? new Date(item.last_used_at).toLocaleString() : '-'}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={item.plan || 'free'}
                          disabled={!canEdit || pendingId === `plan:${item.id}`}
                          onChange={(event) => void onPlanChange(item, event.target.value)}
                          className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                        <button
                          onClick={() => void onRevoke(item.id)}
                          disabled={!canEdit || Boolean(item.revoked_at) || pendingId === `revoke:${item.id}`}
                          className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-700 disabled:opacity-50"
                        >
                          {item.revoked_at ? 'Revoked' : (pendingId === `revoke:${item.id}` ? 'Revoking...' : 'Revoke')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 mt-4">
        <div className="font-semibold text-slate-900 mb-2">Webhooks</div>
        {webhooks.length === 0 ? (
          <div className="text-sm text-slate-500">No webhooks configured.</div>
        ) : (
          <div className="space-y-2 text-sm">
            {webhooks.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 px-3 py-2 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-800">{item.url}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    key: {item.api_key_id} · events: {Array.isArray(item.events) ? item.events.join(', ') : '-'} · status: {item.is_active === false ? 'paused' : 'active'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 mt-4">
        <div className="font-semibold text-slate-900 mb-2">Recent webhook deliveries</div>
        {deliveries.length === 0 ? (
          <div className="text-sm text-slate-500">No delivery events.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Event</th>
                  <th className="py-1">Status</th>
                  <th className="py-1">Webhook</th>
                  <th className="py-1">API key</th>
                  <th className="py-1">Error</th>
                  <th className="py-1">Time</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="py-1">{item.event || '-'}</td>
                    <td className="py-1">{item.status || 0}</td>
                    <td className="py-1">{item.webhook_id || '-'}</td>
                    <td className="py-1">{item.api_key_id || '-'}</td>
                    <td className="py-1">{item.error || '-'}</td>
                    <td className="py-1">{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModuleShell>
  );
};
