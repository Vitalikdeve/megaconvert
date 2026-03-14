import React, { useEffect, useRef, useState } from 'react';
import { Camera, ShieldCheck, VideoOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MegaMeetLobby({
  roomId,
  displayName,
  onDisplayNameChange,
  onJoin,
}) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let mediaStream = null;

    const startPreview = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (isMounted) {
          setPreviewError(true);
        }
        return;
      }

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });

        if (!isMounted || !videoRef.current) {
          return;
        }

        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      } catch {
        if (isMounted) {
          setPreviewError(true);
        }
      }
    };

    void startPreview();

    return () => {
      isMounted = false;

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-[#0A0A0B] px-4 py-6 text-white sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 16% 18%, rgba(34,197,94,0.12), transparent 22%), radial-gradient(circle at 84% 16%, rgba(59,130,246,0.14), transparent 24%), radial-gradient(circle at 50% 100%, rgba(236,72,153,0.08), transparent 28%)',
        }}
      />

      <div className="relative grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr),360px]">
        <section className="overflow-hidden rounded-[34px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(14,14,18,0.96),rgba(8,8,11,0.96))] p-4 shadow-[0_34px_120px_-54px_rgba(0,0,0,0.92)] sm:p-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/16 bg-emerald-400/10 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-emerald-100/78">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
            {t('megaMeet.lobbyEyebrow', 'Secure preview')}
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-black/28">
            <div className="aspect-[16/10] min-h-[340px] w-full bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.2),transparent_30%),linear-gradient(180deg,#1b1d24,#0c0d12)]">
              {previewError ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                  <div className="rounded-full border border-white/[0.08] bg-white/[0.04] p-5">
                    <VideoOff className="h-10 w-10 text-white/72" strokeWidth={1.7} />
                  </div>
                  <div className="text-lg font-medium text-white">
                    {t('megaMeet.cameraPreviewUnavailable', 'Camera preview unavailable')}
                  </div>
                  <div className="max-w-md text-sm leading-7 text-white/56">
                    {t('megaMeet.cameraPermissionHint', 'Allow camera access or continue with avatar-only mode.')}
                  </div>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-black/35 px-4 py-2 text-sm font-medium text-white/88 backdrop-blur-xl">
              <Camera className="h-4 w-4" strokeWidth={1.8} />
              {t('megaMeet.yourPreview', 'Your preview')}
            </div>
          </div>
        </section>

        <aside className="flex flex-col rounded-[34px] border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_34px_120px_-54px_rgba(0,0,0,0.92)] backdrop-blur-2xl">
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/34">
            {t('megaMeet.roomTitle', 'Room {{roomId}}', { roomId })}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
            {t('megaMeet.lobbyTitle', 'Ready for an encrypted room?')}
          </h1>
          <p className="mt-4 text-sm leading-7 text-white/58">
            {t('megaMeet.lobbySubtitle', 'Check your camera and join room {{roomId}} with end-to-end protected chat.', { roomId })}
          </p>

          <label className="mt-8 block">
            <div className="mb-2 text-sm font-medium text-white/76">
              {t('megaMeet.guestNameLabel', 'Display name')}
            </div>
            <input
              type="text"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              placeholder={t('megaMeet.guestNamePlaceholder', 'Enter your name')}
              className="w-full rounded-2xl border border-white/[0.08] bg-[#101115] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-400/40"
            />
          </label>

          <button
            type="button"
            onClick={onJoin}
            className="mt-8 inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(226,232,240,0.92))] px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_54px_-24px_rgba(255,255,255,0.45)] transition-transform duration-300 hover:-translate-y-0.5"
          >
            {t('megaMeet.joinSecureRoom', 'Join Secure Room')}
          </button>
        </aside>
      </div>
    </div>
  );
}
