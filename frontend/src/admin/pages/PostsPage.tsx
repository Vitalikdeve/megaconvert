import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../auth/useAdminAuth';
import { useAdminI18n } from '../i18n/AdminI18nContext';

const EMPTY_FORM = {
  title: '',
  content_md: '',
  status: 'draft'
};

export const PostsPage = () => {
  const { api, logout } = useAdminAuth();
  const { t } = useAdminI18n();
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h1 className="text-2xl font-semibold text-slate-900">{t.adminPostsTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.adminPostsSubtitle}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl p-3">
          {notice}
        </div>
      )}

      <form onSubmit={onCreate} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="grid md:grid-cols-[1fr_180px] gap-3">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={t.adminPostsTitlePlaceholder}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            required
          />
          <select
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="draft">{t.adminStatusDraft}</option>
            <option value="published">{t.adminStatusPublished}</option>
          </select>
        </div>
        <textarea
          value={form.content_md}
          onChange={(e) => setForm((prev) => ({ ...prev, content_md: e.target.value }))}
          placeholder={t.adminPostsMarkdownPlaceholder}
          className="w-full min-h-[160px] border border-slate-300 rounded-lg px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? t.accountSaving : t.adminCreatePost}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{t.adminPostsAll}</h2>
          <button
            onClick={() => void loadPosts()}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50"
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
                          className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50"
                        >
                          {post.status === 'published' ? t.adminUnpublish : t.adminPublish}
                        </button>
                        <button
                          onClick={() => void onDelete(post)}
                          className="px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
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
