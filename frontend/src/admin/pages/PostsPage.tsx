import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminI18n } from '../i18n/AdminI18nContext';
import { CONVERSIONS } from '../../seo/conversions';
import { generateAutoConversionArticles, generateAutoUpdateArticles, toMarkdownFromSections } from '../../lib/autoArticles';

const EMPTY_FORM = {
  title: '',
  content_md: '',
  status: 'draft'
};

export const PostsPage = () => {
  const { api, logout } = useAdminAuth();
  const { t, lang } = useAdminI18n();
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await api.getPosts();
      setPosts(Array.isArray(response) ? response : []);
    } catch (err) {
      if (err?.status === 401) {
        await logout();
        return;
      }
      if (err?.status === 404) {
        setPosts([]);
        setNotice(t.adminPostsApiUnavailable);
      } else {
        setError(err?.message || t.adminErrorLoadPosts);
      }
    } finally {
      setLoading(false);
    }
  }, [api, logout, t]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const onCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.createPost(form);
      setForm(EMPTY_FORM);
      await loadPosts();
    } catch (err) {
      if (err?.status === 401) {
        await logout();
        return;
      }
      setError(err?.message || t.adminErrorCreatePost);
    } finally {
      setSaving(false);
    }
  };

  const onToggleStatus = async (post) => {
    const nextStatus = post.status === 'published' ? 'draft' : 'published';
    try {
      await api.updatePost(post.id, { status: nextStatus });
      await loadPosts();
    } catch (err) {
      if (err?.status === 401) {
        await logout();
        return;
      }
      setError(err?.message || t.adminErrorUpdatePost);
    }
  };

  const onDelete = async (post) => {
    try {
      await api.deletePost(post.id);
      await loadPosts();
    } catch (err) {
      if (err?.status === 401) {
        await logout();
        return;
      }
      setError(err?.message || t.adminErrorDeletePost);
    }
  };

  const createBulkPosts = async (kind) => {
    setBulkSaving(true);
    setError('');
    setNotice('');
    try {
      const existingTitles = new Set(posts.map((item) => String(item?.title || '').trim().toLowerCase()).filter(Boolean));
      const source = kind === 'updates'
        ? generateAutoUpdateArticles(lang, 8)
        : generateAutoConversionArticles(lang, CONVERSIONS);
      const candidates = source.filter((item) => !existingTitles.has(String(item.title || '').trim().toLowerCase()));
      let created = 0;
      for (const item of candidates) {
        const contentMd = toMarkdownFromSections(item.sections || []);
        await api.createPost({
          title: item.title,
          content_md: contentMd,
          status: 'published'
        });
        created += 1;
      }
      setNotice(created > 0
        ? `Auto-generated ${created} posts (${kind}).`
        : 'All auto-generated posts already exist.');
      await loadPosts();
    } catch (err) {
      if (err?.status === 401) {
        await logout();
        return;
      }
      setError(err?.message || 'Failed to auto-generate posts');
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <>
      <div className="bg-white/90 backdrop-blur border border-slate-200/80 rounded-3xl p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{t.adminPostsTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.adminPostsSubtitle}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-3 shadow-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-2xl p-3 shadow-sm">
          {notice}
        </div>
      )}

      <form onSubmit={onCreate} className="bg-white/90 backdrop-blur border border-slate-200/80 rounded-3xl p-5 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
          <div className="text-xs text-blue-700 font-medium">Auto content</div>
          <button
            type="button"
            onClick={() => void createBulkPosts('updates')}
            disabled={bulkSaving}
            className="pressable px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-semibold disabled:opacity-50"
          >
            {bulkSaving ? t.accountSaving : 'Generate updates'}
          </button>
          <button
            type="button"
            onClick={() => void createBulkPosts('conversions')}
            disabled={bulkSaving}
            className="pressable px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-semibold disabled:opacity-50"
          >
            {bulkSaving ? t.accountSaving : 'Generate file guides'}
          </button>
          <div className="text-[11px] text-blue-700/80">
            Language: {lang}. Creates published posts from automatic templates.
          </div>
        </div>
        <div className="grid md:grid-cols-[1fr_180px] gap-3">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={t.adminPostsTitlePlaceholder}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
            required
          />
          <select
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
          >
            <option value="draft">{t.adminStatusDraft}</option>
            <option value="published">{t.adminStatusPublished}</option>
          </select>
        </div>
        <textarea
          value={form.content_md}
          onChange={(e) => setForm((prev) => ({ ...prev, content_md: e.target.value }))}
          placeholder={t.adminPostsMarkdownPlaceholder}
          className="w-full min-h-[160px] border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200/60"
          required
        />
        <button
          type="submit"
          disabled={saving}
          className="pressable px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-blue-500 transition"
        >
          {saving ? t.accountSaving : t.adminCreatePost}
        </button>
      </form>

      <div className="bg-white/90 backdrop-blur border border-slate-200/80 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{t.adminPostsAll}</h2>
          <button
            onClick={() => void loadPosts()}
            className="pressable px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            {loading ? t.accountLoading : t.accountReload}
          </button>
        </div>
        {posts.length === 0 ? (
          <div className="text-sm text-slate-500 mt-3">{t.adminNoPostsYet}</div>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">{t.adminTableTitle}</th>
                  <th className="py-2">{t.adminTableStatus}</th>
                  <th className="py-2">{t.adminTablePublished}</th>
                  <th className="py-2">{t.adminTableActions}</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-800">{post.title}</td>
                    <td className="py-2 text-slate-700">{post.status || t.adminStatusDraft}</td>
                    <td className="py-2 text-slate-600">{post.published_at || '-'}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void onToggleStatus(post)}
                          className="pressable px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                        >
                          {post.status === 'published' ? t.adminUnpublish : t.adminPublish}
                        </button>
                        <button
                          onClick={() => void onDelete(post)}
                          className="pressable px-2.5 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition"
                        >
                          {t.btnDelete}
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
    </>
  );
};
