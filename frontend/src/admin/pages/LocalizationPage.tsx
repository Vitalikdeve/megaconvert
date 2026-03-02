import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleShell } from '../components/ModuleShell';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminPermissions } from '../core/useAdminPermissions';

const toEntries = (value) => Object.entries(value || {}).sort((a, b) => a[0].localeCompare(b[0]));

export const LocalizationPage = () => {
  const { api } = useAdminAuth();
  const { can } = useAdminPermissions();
  const canEdit = can('localization', 'edit');
  const [status, setStatus] = useState([]);
  const [lang, setLang] = useState('en');
  const [catalog, setCatalog] = useState({});
  const [draft, setDraft] = useState({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const response = await api.getLocalizationStatus();
      setStatus(Array.isArray(response?.locales) ? response.locales : []);
    } catch (err) {
      setError(err?.message || 'Failed to load localization status');
    }
  }, [api]);

  const loadCatalog = useCallback(async (nextLang) => {
    setLoading(true);
    try {
      const response = await api.getLocalizationCatalog(nextLang);
      const entries = response?.entries || {};
      setCatalog(entries);
      setDraft(entries);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load localization catalog');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    void loadCatalog(lang);
  }, [lang, loadCatalog]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return toEntries(draft).filter(([key, value]) => {
      if (!normalizedQuery) return true;
      return key.toLowerCase().includes(normalizedQuery) || String(value || '').toLowerCase().includes(normalizedQuery);
    });
  }, [draft, query]);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await api.saveLocalizationCatalog(lang, draft);
      setCatalog(draft);
      setError('');
      await loadStatus();
    } catch (err) {
      setError(err?.message || 'Failed to save localization overrides');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(catalog) !== JSON.stringify(draft);

  return (
    <ModuleShell title="Localization" subtitle="Locale status, key catalog, and override editor.">
      {!canEdit ? <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Read-only mode for this role.</div> : null}
      {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}

      <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="font-semibold text-slate-900">Locale status</div>
          <div className="space-y-2 mt-3 text-sm">
            {status.map((item) => (
              <button
                type="button"
                key={item.lang}
                onClick={() => setLang(item.lang)}
                className={`w-full text-left rounded-xl border px-3 py-2 ${item.lang === lang ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{item.lang}</span>
                  <span className="text-xs text-slate-500">{item.keys_count} keys</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">Overrides: {item.override_count}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900">Catalog editor</div>
              <div className="text-xs text-slate-500 mt-1">Language: {lang}</div>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search key/value..."
              className="px-3 py-2 border border-slate-300 rounded-xl text-sm"
            />
          </div>

          {loading ? <div className="text-sm text-slate-500 mt-4">Loading catalog...</div> : (
            <div className="space-y-2 mt-4 max-h-[520px] overflow-auto pr-1">
              {rows.map(([key, value]) => (
                <label key={key} className="block rounded-xl border border-slate-200 p-3">
                  <div className="text-xs text-slate-500 mb-2">{key}</div>
                  <textarea
                    className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm min-h-[64px]"
                    value={String(value || '')}
                    disabled={!canEdit}
                    onChange={(event) => setDraft((prev) => ({
                      ...prev,
                      [key]: event.target.value
                    }))}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={() => void save()} disabled={!canEdit || !hasChanges || saving} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-60">
          {saving ? 'Saving...' : 'Save overrides'}
        </button>
        <button onClick={() => setDraft(catalog)} disabled={!hasChanges || saving} className="px-3 py-2 rounded-xl border border-slate-300 text-sm disabled:opacity-60">
          Reset draft
        </button>
      </div>
    </ModuleShell>
  );
};

