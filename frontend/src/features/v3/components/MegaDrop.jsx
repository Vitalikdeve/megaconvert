import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Link2, Loader2, QrCode, Radio, RefreshCcw, Upload, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useMegaDrop from '../../../hooks/useMegaDrop.js';

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const normalizeRoomCode = (value) => String(value || '').trim().replace(/\D+/g, '').slice(0, 6);

export default function MegaDrop({ initialFile = null, onInitialFileConsumed = null }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const handledInitialFileRef = useRef(false);
  const [joinCode, setJoinCode] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const {
    webRtcSupported,
    socketState,
    role,
    roomId,
    shareUrl,
    statusText,
    error,
    transferPhase,
    transferProgress,
    downloadUrl,
    downloadName,
    isConnected,
    isHosting,
    isJoining,
    startHosting,
    joinRoom,
    resetMegaDrop,
  } = useMegaDrop();

  const canStartTransfer = webRtcSupported && !isHosting;
  const canJoin = webRtcSupported && !isJoining && joinCode.length === 6;
  const localizedSocketState = t(`legacyV3.megaDrop.socketStates.${socketState}`, { defaultValue: socketState });

  useEffect(() => {
    if (!(initialFile instanceof File) || handledInitialFileRef.current) {
      return;
    }

    handledInitialFileRef.current = true;
    queueMicrotask(() => {
      setSelectedFile(initialFile);
    });
    void startHosting({
      blob: initialFile,
      fileName: initialFile.name,
      mimeType: initialFile.type,
    }).finally(() => {
      onInitialFileConsumed?.();
    });
  }, [initialFile, onInitialFileConsumed, startHosting]);

  useEffect(() => {
    if (!shareUrl) {
      queueMicrotask(() => {
        setQrCodeUrl('');
      });
      return undefined;
    }

    let cancelled = false;

    QRCode.toDataURL(shareUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#0f172a', light: '#0000' },
    }).then((dataUrl) => {
      if (!cancelled) {
        setQrCodeUrl(dataUrl);
      }
    }).catch(() => {
      if (!cancelled) {
        setQrCodeUrl('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  const progressLabel = useMemo(() => {
    if (transferPhase === 'transferring' || transferPhase === 'awaiting-confirmation') {
      return `${t('processing')} ${transferProgress.toFixed(0)}%`;
    }

    if (transferPhase === 'receiving') {
      return `${t('download')} ${transferProgress.toFixed(0)}%`;
    }

    return statusText;
  }, [statusText, t, transferPhase, transferProgress]);

  const handleFileSelection = async (file) => {
    if (!(file instanceof File)) {
      return;
    }

    setSelectedFile(file);
    await startHosting({
      blob: file,
      fileName: file.name,
      mimeType: file.type,
    });
  };

  return (
    <section className="mc-card overflow-hidden rounded-3xl p-6 md:p-8">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-40 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_58%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_42%)] pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 bg-cyan-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-100">
            <Radio size={13} />
            {t('legacyV3.megaDrop.eyebrow')}
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
            {t('legacyV3.megaDrop.title')}
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
            {statusText}
          </p>
        </div>
      </div>

      {!webRtcSupported ? (
        <div className="mt-6 rounded-3xl border border-red-300/70 bg-red-100/70 px-4 py-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
          {t('portalMegaDropUnsupported')}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/40 bg-white/70 p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <Wifi size={14} />
                {isConnected ? t('legacyV3.megaDrop.connectionActive') : t('legacyV3.megaDrop.waitingForDevice')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                {t('legacyV3.megaDrop.socketLabel')}: {localizedSocketState}
              </span>
              {roomId ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 bg-cyan-50/80 px-3 py-1 text-xs font-medium text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-500/10 dark:text-cyan-100">
                  {t('legacyV3.megaDrop.roomLabel', { roomId })}
                </span>
              ) : null}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {role === 'guest' ? t('legacyV3.megaDrop.joinByCode') : t('legacyV3.megaDrop.startFromDesktop')}
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(normalizeRoomCode(event.target.value))}
                  inputMode="numeric"
                  placeholder="123456"
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => void joinRoom(joinCode)}
                  disabled={!canJoin}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-800 transition-all duration-300 ease-out hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                >
                  {isJoining ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                  {t('legacyV3.megaDrop.connect')}
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('legacyV3.megaDrop.sendFile')}</div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canStartTransfer}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 ease-out hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isHosting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {t('btnSelect')}
                </button>
                <button
                  type="button"
                  onClick={() => void resetMegaDrop()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-800 transition-all duration-300 ease-out hover:scale-[1.01] dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                >
                  <RefreshCcw size={16} />
                  {t('legacyV3.megaDrop.reset')}
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  void handleFileSelection(event.target.files?.[0] || null);
                  event.target.value = '';
                }}
              />

              {selectedFile ? (
                <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">
                    {selectedFile.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(selectedFile.size)}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${transferProgress}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{progressLabel}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/40 bg-white/70 p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <QrCode size={16} />
              {t('legacyV3.megaDrop.qrInvite')}
            </div>

            {shareUrl ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-cyan-200/60 bg-cyan-50/70 p-4 dark:border-cyan-300/20 dark:bg-cyan-500/10">
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-100">{t('legacyV3.megaDrop.roomLink')}</div>
                  <div className="mt-2 break-all text-sm text-slate-800 dark:text-slate-100">{shareUrl}</div>
                </div>

                {qrCodeUrl ? (
                  <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-4 dark:border-white/10 dark:bg-slate-950/40">
                    <img src={qrCodeUrl} alt={t('legacyV3.megaDrop.qrAlt')} className="mx-auto h-48 w-48 rounded-2xl" />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200/70 bg-slate-50/70 p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                {t('legacyV3.megaDrop.createRoomHint')}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/40 bg-white/70 p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Download size={16} />
              {t('legacyV3.megaDrop.receivedFile')}
            </div>

            {downloadUrl ? (
              <a
                href={downloadUrl}
                download={downloadName || 'megadrop-download'}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-300 ease-out hover:scale-[1.01]"
              >
                <Download size={15} />
                {downloadName || t('download')}
              </a>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200/70 bg-slate-50/70 p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                {t('legacyV3.megaDrop.waitingForFile')}
              </div>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-300/60 bg-red-100/70 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}
    </section>
  );
}
