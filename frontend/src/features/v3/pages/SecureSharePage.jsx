import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  ShieldCheck,
  Upload
} from 'lucide-react';

const normalizeApiBase = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '/api';
  if (!/^https?:\/\//i.test(normalized)) {
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  }
  try {
    const parsed = new URL(normalized);
    const host = String(parsed.hostname || '').trim().toLowerCase();
    const loopbackHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!loopbackHost && String(parsed.port || '').trim() === '5000') {
      parsed.port = '';
    }
    if (!loopbackHost && typeof window !== 'undefined' && window.location.protocol === 'https:' && parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '');
    if (parsed.pathname === '/api') {
      parsed.pathname = '';
    }
    return parsed.toString().replace(/\/+$/g, '');
  } catch {
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  }
};

const resolveApiBase = () => normalizeApiBase(import.meta.env.VITE_API_BASE || '/api');

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

export default function SecureSharePage() {
  const apiBase = resolveApiBase();
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sourceFile, setSourceFile] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [statusText, setStatusText] = useState('Загрузите файл и создайте безопасную ссылку на 24 часа');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const onSelectFile = (file) => {
    if (!file) return;
    setSourceFile(file);
    setShareLink('');
    setExpiresAt(null);
    setError('');
    setCopied(false);
    setStatusText('Файл загружен. Можно создать одноразовую ссылку.');
  };

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0] || null;
    if (file) onSelectFile(file);
  };

  const createSecureLink = async () => {
    if (!sourceFile || isCreating) return;
    setIsCreating(true);
    setError('');
    setCopied(false);
    setStatusText('Загружаем файл и генерируем ссылку...');
    setShareLink('');
    setExpiresAt(null);

    try {
      const form = new FormData();
      form.append('file', sourceFile);
      form.append('expires_preset', 'one_day');

      const response = await fetch(`${apiBase}/share`, {
        method: 'POST',
        body: form
      });

      if (!response.ok) {
        let details = null;
        try {
          details = await response.json();
        } catch {
          details = null;
        }
        throw new Error(String(details?.message || `share_create_failed_${response.status}`));
      }

      const payload = await response.json();
      const token = String(payload?.token || '').trim();
      const link = String(payload?.share_url || (token ? `${window.location.origin}/s/${token}` : '')).trim();
      if (!link) throw new Error('share_link_missing');

      setShareLink(link);
      const expiryValue = Number(payload?.expires_at || 0);
      setExpiresAt(expiryValue > 0 ? expiryValue : null);

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      }
      setStatusText('Ссылка создана и готова к отправке.');
    } catch (requestError) {
      setError(String(requestError?.message || 'Не удалось создать ссылку'));
      setStatusText('Ошибка создания secure-ссылки');
    } finally {
      setIsCreating(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setError('');
    } catch {
      setError('Не удалось скопировать ссылку в буфер');
    }
  };

  const expiresLabel = useMemo(() => {
    if (!expiresAt) return '';
    try {
      return new Date(expiresAt).toLocaleString();
    } catch {
      return '';
    }
  }, [expiresAt]);

  return (
    <section className="mc-card rounded-3xl p-6 md:p-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Tools / Sharing</div>
        <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Secure Share
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
          Файл отправляется на бэкенд, создается короткий токен и одноразовая ссылка c TTL 24 часа.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-200/60 dark:border-emerald-400/20 bg-emerald-50/70 dark:bg-emerald-500/10 backdrop-blur-xl px-4 py-3 text-xs text-emerald-800 dark:text-emerald-100 inline-flex items-center gap-2">
        <ShieldCheck size={14} />
        После истечения срока файл удаляется автоматически.
      </div>

      <div
        className={`mt-6 rounded-3xl border-2 border-dashed px-5 py-8 text-center backdrop-blur-xl transition-all duration-300 ease-out ${
          isDragOver
            ? 'border-cyan-400/70 bg-cyan-50/70 dark:bg-cyan-500/10'
            : 'border-slate-300/70 dark:border-white/15 bg-white/70 dark:bg-white/5'
        }`}
        onDragEnter={() => setIsDragOver(true)}
        onDragLeave={() => setIsDragOver(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDrop={onDrop}
      >
        <div className="mx-auto h-12 w-12 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-200">
          <Upload size={18} />
        </div>
        <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Перетащите файл сюда</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">или выберите вручную</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all duration-300 ease-out hover:scale-[1.02]"
          >
            Выбрать файл
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          onSelectFile(event.target.files?.[0] || null);
          event.target.value = '';
        }}
      />

      {sourceFile && (
        <div className="mt-5 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">{sourceFile.name}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatBytes(sourceFile.size)}</div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void createSecureLink()}
              disabled={isCreating}
              className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02] inline-flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Генерация ссылки...
                </>
              ) : (
                <>
                  <Link2 size={15} />
                  Создать ссылку на 24 часа
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">{statusText}</div>

      {shareLink && (
        <div className="mt-4 rounded-2xl border border-emerald-300/60 dark:border-emerald-300/30 bg-emerald-100/70 dark:bg-emerald-500/10 p-4">
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-100 inline-flex items-center gap-2">
            <CheckCircle2 size={16} />
            Secure-ссылка создана
          </div>
          <div className="mt-2 text-xs break-all text-emerald-800 dark:text-emerald-100">{shareLink}</div>
          {expiresLabel ? (
            <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">Истекает: {expiresLabel}</div>
          ) : null}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void copyShareLink()}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/70 dark:border-emerald-300/30 bg-white/85 dark:bg-white/5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-100 transition-all duration-300 ease-out hover:scale-[1.02]"
            >
              <Copy size={14} />
              {copied ? 'Скопировано' : 'Скопировать ссылку'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </section>
  );
}
