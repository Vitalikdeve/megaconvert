import React, { useCallback, useEffect, useState } from 'react';
import { ModuleShell } from '../components/ModuleShell';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminPermissions } from '../core/useAdminPermissions';

const DEFAULT_SETTINGS = {
  feature_flags: {
    ai_recommendations: true,
    batch_upload: true,
    public_api: true
  },
  limits: {
    max_file_mb_free: 250,
    max_file_mb_pro: 2048,
    max_batch_files: 100
  },
  queues: {
    default_priority: 'normal',
    enterprise_priority: 'high'
  },
  ai: {
    enabled: true,
    confidence_threshold: 0.65,
    fallback_mode: 'rules'
  }
};

const numberValue = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

export const SettingsPage = () => {
  const { api } = useAdminAuth();
  const { can } = useAdminPermissions();
  const canEdit = can('settings', 'edit');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getPlatformSettings();
      setSettings(response?.settings || DEFAULT_SETTINGS);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const response = await api.savePlatformSettings(settings);
      setSettings(response?.settings || settings);
      setSavedAt(new Date().toISOString());
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleShell title="Settings" subtitle="Feature flags, queue limits, and AI configs.">
      {!canEdit ? <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Read-only mode for this role.</div> : null}
      {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-500">Loading settings...</div> : (
        <div className="grid xl:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="font-semibold text-slate-900">Feature flags</div>
            <div className="space-y-2 mt-3 text-sm">
              {Object.entries(settings.feature_flags || {}).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <span>{key}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    disabled={!canEdit}
                    onChange={(event) => setSettings((prev) => ({
                      ...prev,
                      feature_flags: {
                        ...(prev.feature_flags || {}),
                        [key]: event.target.checked
                      }
                    }))}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="font-semibold text-slate-900">Limits</div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
              <label className="block">
                <div className="text-xs text-slate-500 mb-1">Free max file MB</div>
                <input
                  type="number"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                  disabled={!canEdit}
                  value={settings.limits?.max_file_mb_free ?? 250}
                  onChange={(event) => setSettings((prev) => ({
                    ...prev,
                    limits: {
                      ...(prev.limits || {}),
                      max_file_mb_free: numberValue(event.target.value, 250)
                    }
                  }))}
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-500 mb-1">Pro max file MB</div>
                <input
                  type="number"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                  disabled={!canEdit}
                  value={settings.limits?.max_file_mb_pro ?? 2048}
                  onChange={(event) => setSettings((prev) => ({
                    ...prev,
                    limits: {
                      ...(prev.limits || {}),
                      max_file_mb_pro: numberValue(event.target.value, 2048)
                    }
                  }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <div className="text-xs text-slate-500 mb-1">Max batch files</div>
                <input
                  type="number"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                  disabled={!canEdit}
                  value={settings.limits?.max_batch_files ?? 100}
                  onChange={(event) => setSettings((prev) => ({
                    ...prev,
                    limits: {
                      ...(prev.limits || {}),
                      max_batch_files: numberValue(event.target.value, 100)
                    }
                  }))}
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="font-semibold text-slate-900">Queues</div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
              <label className="block">
                <div className="text-xs text-slate-500 mb-1">Default priority</div>
                <input
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                  disabled={!canEdit}
                  value={settings.queues?.default_priority || 'normal'}
                  onChange={(event) => setSettings((prev) => ({
                    ...prev,
                    queues: {
                      ...(prev.queues || {}),
                      default_priority: event.target.value
                    }
                  }))}
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-500 mb-1">Enterprise priority</div>
                <input
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                  disabled={!canEdit}
                  value={settings.queues?.enterprise_priority || 'high'}
                  onChange={(event) => setSettings((prev) => ({
                    ...prev,
                    queues: {
                      ...(prev.queues || {}),
                      enterprise_priority: event.target.value
                    }
                  }))}
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="font-semibold text-slate-900">AI config</div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={Boolean(settings.ai?.enabled)}
                  disabled={!canEdit}
                  onChange={(event) => setSettings((prev) => ({
                    ...prev,
                    ai: {
                      ...(prev.ai || {}),
                      enabled: event.target.checked
                    }
                  }))}
                />
                AI enabled
              </label>
              <label className="block">
                <div className="text-xs text-slate-500 mb-1">Confidence threshold</div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                  disabled={!canEdit}
                  value={settings.ai?.confidence_threshold ?? 0.65}
                  onChange={(event) => setSettings((prev) => ({
                    ...prev,
                    ai: {
                      ...(prev.ai || {}),
                      confidence_threshold: numberValue(event.target.value, 0.65)
                    }
                  }))}
                />
              </label>
              <label className="block sm:col-span-2">
                <div className="text-xs text-slate-500 mb-1">Fallback mode</div>
                <input
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                  disabled={!canEdit}
                  value={settings.ai?.fallback_mode || 'rules'}
                  onChange={(event) => setSettings((prev) => ({
                    ...prev,
                    ai: {
                      ...(prev.ai || {}),
                      fallback_mode: event.target.value
                    }
                  }))}
                />
              </label>
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button onClick={() => void save()} disabled={!canEdit || saving || loading} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-60">
          {saving ? 'Saving...' : 'Save settings'}
        </button>
        {savedAt ? <span className="text-xs text-slate-500">Saved at {new Date(savedAt).toLocaleTimeString()}</span> : null}
      </div>
    </ModuleShell>
  );
};

