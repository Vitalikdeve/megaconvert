import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleShell } from '../components/ModuleShell';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminPermissions } from '../core/useAdminPermissions';

const EMPTY_FORM = {
  name: '',
  role: '',
  bio: '',
  avatar_url: '',
  github_url: '',
  linkedin_url: '',
  twitter_url: '',
  website_url: '',
  order_index: 1,
  is_active: true
};

const parseOrderIndex = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
};

const isValidUrl = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return true;
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const toDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Failed to read image'));
  reader.readAsDataURL(file);
});

export const TeamPage = () => {
  const { api } = useAdminAuth();
  const { can } = useAdminPermissions();
  const canEdit = can('team', 'edit');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const sortedRows = useMemo(
    () => rows.slice().sort((left, right) => Number(left.order_index || 0) - Number(right.order_index || 0)),
    [rows]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getDevelopers();
      setRows(Array.isArray(response?.items) ? response.items : []);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load developers');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = useCallback(() => {
    setEditingId('');
    setForm({
      ...EMPTY_FORM,
      order_index: Math.max(1, rows.length + 1)
    });
    setFormError('');
  }, [rows.length]);

  const validateForm = useCallback(() => {
    if (!String(form.name || '').trim()) return 'Name is required';
    if (!String(form.role || '').trim()) return 'Role is required';
    if (!String(form.avatar_url || '').trim()) return 'Photo is required';
    if (!isValidUrl(form.github_url)) return 'Invalid GitHub URL';
    if (!isValidUrl(form.linkedin_url)) return 'Invalid LinkedIn URL';
    if (!isValidUrl(form.twitter_url)) return 'Invalid Twitter/X URL';
    if (!isValidUrl(form.website_url)) return 'Invalid Website URL';
    return '';
  }, [form]);

  const onSelectAvatar = async (event) => {
    if (!canEdit) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image is too large (max 5MB)');
      return;
    }
    setAvatarBusy(true);
    try {
      const dataUrl = await toDataUrl(file);
      const upload = await api.uploadAdminImage(dataUrl);
      const avatarUrl = String(upload?.url || '').trim();
      if (!avatarUrl) throw new Error('Image upload endpoint did not return URL');
      setForm((prev) => ({ ...prev, avatar_url: avatarUrl }));
      setFormError('');
    } catch (err) {
      setFormError(err?.message || 'Failed to upload image');
    } finally {
      setAvatarBusy(false);
      event.target.value = '';
    }
  };

  const submitForm = async () => {
    if (!canEdit) return;
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: String(form.name || '').trim(),
        role: String(form.role || '').trim(),
        bio: String(form.bio || '').trim(),
        avatar_url: String(form.avatar_url || '').trim(),
        github_url: String(form.github_url || '').trim(),
        linkedin_url: String(form.linkedin_url || '').trim(),
        twitter_url: String(form.twitter_url || '').trim(),
        website_url: String(form.website_url || '').trim(),
        order_index: parseOrderIndex(form.order_index),
        is_active: Boolean(form.is_active)
      };
      if (editingId) {
        await api.updateDeveloper(editingId, payload);
      } else {
        await api.createDeveloper(payload);
      }
      await load();
      resetForm();
    } catch (err) {
      setFormError(err?.message || 'Failed to save developer');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    if (!canEdit) return;
    setEditingId(String(row.id || ''));
    setForm({
      name: row.name || '',
      role: row.role || '',
      bio: row.bio || '',
      avatar_url: row.avatar_url || '',
      github_url: row.github_url || '',
      linkedin_url: row.linkedin_url || '',
      twitter_url: row.twitter_url || '',
      website_url: row.website_url || '',
      order_index: parseOrderIndex(row.order_index),
      is_active: Boolean(row.is_active)
    });
    setFormError('');
  };

  const onDelete = async (id) => {
    if (!canEdit) return;
    const accepted = window.confirm('Delete this developer?');
    if (!accepted) return;
    try {
      await api.deleteDeveloper(id);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to delete developer');
    }
  };

  const onToggle = async (id) => {
    if (!canEdit) return;
    try {
      await api.toggleDeveloper(id);
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to toggle developer');
    }
  };

  return (
    <ModuleShell title="Team" subtitle="Manage developers shown on the public team page.">
      <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-base font-semibold text-slate-900">{editingId ? 'Edit developer' : 'Add developer'}</div>
              <div className="text-xs text-slate-500 mt-1">Name, role, bio, photo, social links, order, status</div>
            </div>
            {editingId ? (
              <button
                onClick={resetForm}
                className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            ) : null}
          </div>
          {!canEdit ? <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">Read-only mode for this role.</div> : null}

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Name</div>
              <input
                value={form.name}
                disabled={!canEdit}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Name"
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Role</div>
              <input
                value={form.role}
                disabled={!canEdit}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Role"
              />
            </label>
            <label className="block sm:col-span-2">
              <div className="text-xs text-slate-500 mb-1">Bio</div>
              <textarea
                value={form.bio}
                disabled={!canEdit}
                onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm min-h-[96px]"
                placeholder="Short bio"
              />
            </label>
            <label className="block sm:col-span-2">
              <div className="text-xs text-slate-500 mb-1">Photo</div>
              <div className="flex items-center gap-3">
                <label className="px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                  {avatarBusy ? 'Uploading...' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={!canEdit}
                    onChange={(event) => void onSelectAvatar(event)}
                  />
                </label>
                <input
                  value={form.avatar_url}
                  disabled={!canEdit}
                  onChange={(event) => setForm((prev) => ({ ...prev, avatar_url: event.target.value }))}
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="https://... or uploaded image"
                />
              </div>
              {form.avatar_url ? (
                <div className="mt-3 w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={form.avatar_url} alt={form.name || 'Developer'} className="w-full h-full object-cover" />
                </div>
              ) : null}
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">GitHub</div>
              <input
                value={form.github_url}
                disabled={!canEdit}
                onChange={(event) => setForm((prev) => ({ ...prev, github_url: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="https://github.com/..."
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">LinkedIn</div>
              <input
                value={form.linkedin_url}
                disabled={!canEdit}
                onChange={(event) => setForm((prev) => ({ ...prev, linkedin_url: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="https://linkedin.com/in/..."
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Twitter / X</div>
              <input
                value={form.twitter_url}
                disabled={!canEdit}
                onChange={(event) => setForm((prev) => ({ ...prev, twitter_url: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="https://x.com/..."
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Website</div>
              <input
                value={form.website_url}
                disabled={!canEdit}
                onChange={(event) => setForm((prev) => ({ ...prev, website_url: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Display order</div>
              <input
                type="number"
                min={1}
                value={form.order_index}
                disabled={!canEdit}
                onChange={(event) => setForm((prev) => ({ ...prev, order_index: parseOrderIndex(event.target.value) }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
              <input
                type="checkbox"
                checked={form.is_active}
                disabled={!canEdit}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              Active
            </label>
          </div>

          {formError ? <div className="text-sm text-red-600 mt-3">{formError}</div> : null}
          <div className="mt-4">
            <button
              onClick={() => void submitForm()}
              disabled={saving || avatarBusy || !canEdit}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : (editingId ? 'Save changes' : 'Add developer')}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-base font-semibold text-slate-900">Preview</div>
          <div className="text-xs text-slate-500 mt-1">How this card appears on public /developers</div>
          <div className="mt-4 rounded-2xl border border-slate-200 p-4 text-center">
            <div className="mx-auto w-20 h-20 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt={form.name || 'Developer'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No photo</div>
              )}
            </div>
            <div className="mt-3 font-semibold text-slate-900">{form.name || 'Developer name'}</div>
            <div className="text-sm text-slate-600">{form.role || 'Role'}</div>
            {form.bio ? <div className="text-xs text-slate-500 mt-2">{form.bio}</div> : null}
          </div>
        </div>
      </div>

      <div className="h-5" />
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Photo</th>
                <th className="py-2">Name</th>
                <th className="py-2">Role</th>
                <th className="py-2">Active</th>
                <th className="py-2">Order</th>
                <th className="py-2">Socials</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="py-2">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      {row.avatar_url ? <img src={row.avatar_url} alt={row.name || 'Developer'} className="w-full h-full object-cover" /> : null}
                    </div>
                  </td>
                  <td className="py-2">{row.name}</td>
                  <td className="py-2">{row.role}</td>
                  <td className="py-2">{row.is_active ? 'yes' : 'no'}</td>
                  <td className="py-2">{row.order_index ?? '-'}</td>
                  <td className="py-2 text-xs text-slate-600">
                    {[row.github_url, row.linkedin_url, row.twitter_url, row.website_url].filter(Boolean).length || 0} links
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(row)}
                        disabled={!canEdit}
                        className="px-2 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void onToggle(row.id)}
                        disabled={!canEdit}
                        className="px-2 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {row.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => void onDelete(row.id)}
                        disabled={!canEdit}
                        className="px-2 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModuleShell>
  );
};

