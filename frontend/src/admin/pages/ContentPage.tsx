import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleShell } from '../components/ModuleShell';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminPermissions } from '../core/useAdminPermissions';

const PAGE_TEMPLATE = {
  slug: '',
  title: '',
  description: '',
  order_index: 1,
  is_active: true
};

const BLOCK_TEMPLATE = {
  page_slug: 'home',
  type: 'text',
  title: '',
  content_json: '{}',
  order_index: 1,
  is_active: true
};

const parseOrder = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
};

const makeSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'page';

export const ContentPage = () => {
  const { api } = useAdminAuth();
  const { can } = useAdminPermissions();
  const canEdit = can('content', 'edit');
  const [pages, setPages] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingPage, setSavingPage] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);
  const [pageForm, setPageForm] = useState(PAGE_TEMPLATE);
  const [blockForm, setBlockForm] = useState(BLOCK_TEMPLATE);
  const [editingPageId, setEditingPageId] = useState('');
  const [editingBlockId, setEditingBlockId] = useState('');
  const [selectedPageSlug, setSelectedPageSlug] = useState('all');

  const sortedPages = useMemo(
    () => pages.slice().sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0)),
    [pages]
  );

  const pageOptions = useMemo(() => sortedPages.map((item) => item.slug), [sortedPages]);

  const visibleBlocks = useMemo(() => {
    const list = blocks.slice().sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0));
    if (selectedPageSlug === 'all') return list;
    return list.filter((item) => item.page_slug === selectedPageSlug);
  }, [blocks, selectedPageSlug]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pagesRes, blocksRes] = await Promise.all([
        api.getContentPages(),
        api.getContentBlocks()
      ]);
      const pagesItems = Array.isArray(pagesRes?.items) ? pagesRes.items : [];
      const blocksItems = Array.isArray(blocksRes?.items) ? blocksRes.items : [];
      setPages(pagesItems);
      setBlocks(blocksItems);
      setError('');
      if (pagesItems.length > 0 && selectedPageSlug !== 'all' && !pagesItems.some((item) => item.slug === selectedPageSlug)) {
        setSelectedPageSlug('all');
      }
    } catch (err) {
      setError(err?.message || 'Failed to load content modules');
    } finally {
      setLoading(false);
    }
  }, [api, selectedPageSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetPageForm = () => {
    setPageForm({ ...PAGE_TEMPLATE, order_index: pages.length + 1 });
    setEditingPageId('');
  };

  const resetBlockForm = () => {
    setBlockForm({
      ...BLOCK_TEMPLATE,
      page_slug: pageOptions[0] || 'home',
      order_index: blocks.length + 1
    });
    setEditingBlockId('');
  };

  const submitPage = async () => {
    if (!canEdit) return;
    if (!pageForm.title.trim()) {
      setError('Page title is required');
      return;
    }
    const payload = {
      slug: makeSlug(pageForm.slug || pageForm.title),
      title: String(pageForm.title || '').trim(),
      description: String(pageForm.description || '').trim(),
      order_index: parseOrder(pageForm.order_index),
      is_active: Boolean(pageForm.is_active)
    };
    setSavingPage(true);
    try {
      if (editingPageId) {
        await api.updateContentPage(editingPageId, payload);
      } else {
        await api.createContentPage(payload);
      }
      await load();
      resetPageForm();
    } catch (err) {
      setError(err?.message || 'Failed to save page');
    } finally {
      setSavingPage(false);
    }
  };

  const submitBlock = async () => {
    if (!canEdit) return;
    if (!blockForm.page_slug.trim()) {
      setError('Block page slug is required');
      return;
    }
    let parsedContent = {};
    try {
      parsedContent = JSON.parse(String(blockForm.content_json || '{}'));
    } catch {
      setError('Block content JSON is invalid');
      return;
    }
    const payload = {
      page_slug: makeSlug(blockForm.page_slug),
      type: makeSlug(blockForm.type || 'text'),
      title: String(blockForm.title || '').trim(),
      content_json: parsedContent,
      order_index: parseOrder(blockForm.order_index),
      is_active: Boolean(blockForm.is_active)
    };
    setSavingBlock(true);
    try {
      if (editingBlockId) {
        await api.updateContentBlock(editingBlockId, payload);
      } else {
        await api.createContentBlock(payload);
      }
      await load();
      resetBlockForm();
    } catch (err) {
      setError(err?.message || 'Failed to save block');
    } finally {
      setSavingBlock(false);
    }
  };

  const editPage = (row) => {
    if (!canEdit) return;
    setEditingPageId(String(row.id || ''));
    setPageForm({
      slug: row.slug || '',
      title: row.title || '',
      description: row.description || '',
      order_index: parseOrder(row.order_index),
      is_active: Boolean(row.is_active)
    });
  };

  const editBlock = (row) => {
    if (!canEdit) return;
    setEditingBlockId(String(row.id || ''));
    setBlockForm({
      page_slug: row.page_slug || 'home',
      type: row.type || 'text',
      title: row.title || '',
      content_json: JSON.stringify(row.content_json || {}, null, 2),
      order_index: parseOrder(row.order_index),
      is_active: Boolean(row.is_active)
    });
  };

  const removePage = async (id) => {
    if (!canEdit) return;
    if (!window.confirm('Delete this page and related blocks?')) return;
    try {
      await api.deleteContentPage(id);
      await load();
      if (editingPageId === id) resetPageForm();
    } catch (err) {
      setError(err?.message || 'Failed to delete page');
    }
  };

  const removeBlock = async (id) => {
    if (!canEdit) return;
    if (!window.confirm('Delete this block?')) return;
    try {
      await api.deleteContentBlock(id);
      await load();
      if (editingBlockId === id) resetBlockForm();
    } catch (err) {
      setError(err?.message || 'Failed to delete block');
    }
  };

  return (
    <ModuleShell title="Content" subtitle="Pages + Block Builder. Create sections and place blocks without code.">
      {!canEdit ? <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Read-only mode for this role.</div> : null}
      {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">{editingPageId ? 'Edit page' : 'Create page'}</div>
              <div className="text-xs text-slate-500 mt-1">Pages module</div>
            </div>
            {editingPageId ? (
              <button onClick={resetPageForm} className="px-3 py-2 border border-slate-300 rounded-xl text-sm">Cancel</button>
            ) : null}
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Title</div>
              <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" value={pageForm.title} disabled={!canEdit} onChange={(event) => setPageForm((prev) => ({ ...prev, title: event.target.value }))} />
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Slug</div>
              <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" value={pageForm.slug} disabled={!canEdit} onChange={(event) => setPageForm((prev) => ({ ...prev, slug: event.target.value }))} placeholder="auto from title" />
            </label>
            <label className="block sm:col-span-2">
              <div className="text-xs text-slate-500 mb-1">Description</div>
              <textarea className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm min-h-[90px]" value={pageForm.description} disabled={!canEdit} onChange={(event) => setPageForm((prev) => ({ ...prev, description: event.target.value }))} />
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Order</div>
              <input type="number" min={1} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" value={pageForm.order_index} disabled={!canEdit} onChange={(event) => setPageForm((prev) => ({ ...prev, order_index: parseOrder(event.target.value) }))} />
            </label>
            <label className="flex items-center gap-2 mt-6 text-sm text-slate-700">
              <input type="checkbox" checked={pageForm.is_active} disabled={!canEdit} onChange={(event) => setPageForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
              Active
            </label>
          </div>
          <div className="mt-4">
            <button onClick={() => void submitPage()} disabled={!canEdit || savingPage} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-60">
              {savingPage ? 'Saving...' : (editingPageId ? 'Save page' : 'Create page')}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">{editingBlockId ? 'Edit block' : 'Create block'}</div>
              <div className="text-xs text-slate-500 mt-1">Block Builder</div>
            </div>
            {editingBlockId ? (
              <button onClick={resetBlockForm} className="px-3 py-2 border border-slate-300 rounded-xl text-sm">Cancel</button>
            ) : null}
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Page slug</div>
              <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" value={blockForm.page_slug} disabled={!canEdit} onChange={(event) => setBlockForm((prev) => ({ ...prev, page_slug: event.target.value }))} list="admin-page-slugs" />
              <datalist id="admin-page-slugs">
                {pageOptions.map((item) => <option key={item} value={item} />)}
              </datalist>
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Type</div>
              <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" value={blockForm.type} disabled={!canEdit} onChange={(event) => setBlockForm((prev) => ({ ...prev, type: event.target.value }))} placeholder="text / stats / cards / banner / team / cta" />
            </label>
            <label className="block sm:col-span-2">
              <div className="text-xs text-slate-500 mb-1">Title</div>
              <input className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" value={blockForm.title} disabled={!canEdit} onChange={(event) => setBlockForm((prev) => ({ ...prev, title: event.target.value }))} />
            </label>
            <label className="block sm:col-span-2">
              <div className="text-xs text-slate-500 mb-1">Content JSON</div>
              <textarea className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs min-h-[130px] font-mono" value={blockForm.content_json} disabled={!canEdit} onChange={(event) => setBlockForm((prev) => ({ ...prev, content_json: event.target.value }))} />
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Order</div>
              <input type="number" min={1} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" value={blockForm.order_index} disabled={!canEdit} onChange={(event) => setBlockForm((prev) => ({ ...prev, order_index: parseOrder(event.target.value) }))} />
            </label>
            <label className="flex items-center gap-2 mt-6 text-sm text-slate-700">
              <input type="checkbox" checked={blockForm.is_active} disabled={!canEdit} onChange={(event) => setBlockForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
              Active
            </label>
          </div>
          <div className="mt-4">
            <button onClick={() => void submitBlock()} disabled={!canEdit || savingBlock} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-60">
              {savingBlock ? 'Saving...' : (editingBlockId ? 'Save block' : 'Create block')}
            </button>
          </div>
        </div>
      </div>

      <div className="h-5" />

      {loading ? <div className="text-sm text-slate-500">Loading content modules...</div> : (
        <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="font-semibold text-slate-900 mb-3">Pages</div>
            <div className="space-y-2">
              {sortedPages.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{row.title}</div>
                      <div className="text-xs text-slate-500 mt-1">/{row.slug} · order {row.order_index}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => editPage(row)} disabled={!canEdit} className="px-2 py-1 text-xs rounded-lg border border-slate-300 disabled:opacity-50">Edit</button>
                      <button onClick={() => void removePage(row.id)} disabled={!canEdit} className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-700 disabled:opacity-50">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="font-semibold text-slate-900">Blocks</div>
              <select value={selectedPageSlug} onChange={(event) => setSelectedPageSlug(event.target.value)} className="px-3 py-2 border border-slate-300 rounded-xl text-sm">
                <option value="all">All pages</option>
                {pageOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {visibleBlocks.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{row.title || row.type}</div>
                      <div className="text-xs text-slate-500 mt-1">page: {row.page_slug} · type: {row.type} · order {row.order_index}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => editBlock(row)} disabled={!canEdit} className="px-2 py-1 text-xs rounded-lg border border-slate-300 disabled:opacity-50">Edit</button>
                      <button onClick={() => void removeBlock(row.id)} disabled={!canEdit} className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-700 disabled:opacity-50">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ModuleShell>
  );
};

