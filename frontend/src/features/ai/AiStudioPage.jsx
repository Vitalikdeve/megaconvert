import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AudioLines,
  BrainCircuit,
  Cpu,
  FileStack,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Video,
  WandSparkles
} from 'lucide-react';

const formatFileSizeMb = (size) => `${(Math.max(0, Number(size || 0)) / (1024 * 1024)).toFixed(2)} MB`;

const inferMediaLabel = (file, t) => {
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('image/')) return t('legacyAi.aiStudio.mediaLanes.image');
  if (mime.startsWith('audio/')) return t('legacyAi.aiStudio.mediaLanes.audio');
  if (mime.startsWith('video/')) return t('legacyAi.aiStudio.mediaLanes.video');
  return t('legacyAi.aiStudio.mediaLanes.universal');
};

export default function AiStudioPage({
  file = null,
  files = [],
  isDragOver = false,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onBrowseClick,
  onClear,
  prompt = '',
  onPromptChange,
  onSubmit,
  onSuggestionPick,
  disabled = false,
  stage = 'idle',
  intent = null,
  error = '',
  status = 'idle',
  progress = 0,
  pipelineStage = '',
  downloadUrl = '',
  conversionError = '',
  onDownload,
  onReset,
  canQuickLook = false,
  onQuickLook,
  batchStackNode = null
}) {
  const { t } = useTranslation();
  const promptSuggestions = useMemo(() => ([
    t('legacyAi.aiStudio.promptSuggestions.pdfToWord'),
    t('legacyAi.aiStudio.promptSuggestions.audioToMp3'),
    t('legacyAi.aiStudio.promptSuggestions.imageToPng'),
    t('legacyAi.aiStudio.promptSuggestions.compressVideo')
  ]), [t]);
  const capabilityModules = useMemo(() => ([
    {
      id: 'crystal-clear',
      title: t('legacyAi.aiStudio.capabilityModules.crystalClear.title'),
      copy: t('legacyAi.aiStudio.capabilityModules.crystalClear.copy'),
      prompt: t('legacyAi.aiStudio.capabilityModules.crystalClear.prompt'),
      icon: ImageIcon
    },
    {
      id: 'silence',
      title: t('legacyAi.aiStudio.capabilityModules.silence.title'),
      copy: t('legacyAi.aiStudio.capabilityModules.silence.copy'),
      prompt: t('legacyAi.aiStudio.capabilityModules.silence.prompt'),
      icon: AudioLines
    },
    {
      id: 'smart-crop',
      title: t('legacyAi.aiStudio.capabilityModules.smartCrop.title'),
      copy: t('legacyAi.aiStudio.capabilityModules.smartCrop.copy'),
      prompt: t('legacyAi.aiStudio.capabilityModules.smartCrop.prompt'),
      icon: Video
    }
  ]), [t]);
  const stageMessages = useMemo(() => ({
    idle: t('legacyAi.aiStudio.stageMessages.idle'),
    analyzing: t('legacyAi.aiStudio.stageMessages.analyzing'),
    converting: t('legacyAi.aiStudio.stageMessages.converting')
  }), [t]);
  const selectedFiles = Array.isArray(files) && files.length ? files : (file ? [file] : []);
  const primaryFile = selectedFiles[0] || null;
  const hasBatch = selectedFiles.length > 1;
  const stageMessage = stageMessages[stage] || stageMessages.idle;
  const safeProgress = Math.max(6, Math.min(100, Math.round(Number(progress || 0))));
  const isBusy = stage !== 'idle' || status === 'processing';
  const mediaLane = inferMediaLabel(primaryFile, t);
  const totalBatchSize = hasBatch
    ? selectedFiles.reduce((sum, item) => sum + Number(item?.size || 0), 0)
    : Number(primaryFile?.size || 0);

  const handlePromptKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    if (!disabled) {
      onSubmit?.();
    }
  };

  return (
    <section className="ai-neural-shell page-enter pt-28 pb-16 px-4">
      <div className="ai-neural-grid" />
      <div className="ai-neural-glow ai-neural-glow-a" />
      <div className="ai-neural-glow ai-neural-glow-b" />

      <div className="max-w-7xl mx-auto relative z-[1]">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200">
            <BrainCircuit size={13} />
            {t('legacyAi.aiStudio.badge')}
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight text-white">
            {t('legacyAi.aiStudio.heroTitle')}
          </h1>
          <p className="mt-4 max-w-2xl text-sm md:text-base leading-7 text-slate-300">
            {t('legacyAi.aiStudio.heroDescription')}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="ai-neural-pill"><Cpu size={13} /> {t('legacyAi.aiStudio.capabilities.webgpu')}</span>
            <span className="ai-neural-pill"><ShieldCheck size={13} /> {t('legacyAi.aiStudio.capabilities.privateFlow')}</span>
            {intent?.from && intent?.to ? (
              <span className="ai-neural-pill ai-neural-pill-accent">{intent.from} → {intent.to}</span>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px] items-start">
          <div className="space-y-5 min-w-0">
            <div
              className={`ai-neural-surface ai-neural-dropzone ${isDragOver ? 'is-dragover' : ''} ${primaryFile ? 'has-file' : ''}`}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              {!primaryFile ? (
                <div className="flex flex-col items-center justify-center text-center py-10 md:py-14">
                  <div className="ai-neural-drop-orb">
                    <Sparkles size={22} />
                  </div>
                  <div className="mt-6 text-2xl md:text-3xl font-semibold text-white">{t('legacyAi.aiStudio.dropTitle')}</div>
                  <div className="mt-3 max-w-xl text-sm md:text-base text-slate-400 leading-7">
                    {t('legacyAi.aiStudio.dropDescription')}
                  </div>
                  <button type="button" onClick={onBrowseClick} className="auth-primary-btn mt-7">
                    {t('btnSelect')}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/80">
                        {hasBatch ? t('legacyAi.aiStudio.batchLaneReady') : mediaLane}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white break-words">
                        {hasBatch ? t('legacyAi.aiStudio.filesLoaded', { count: selectedFiles.length }) : primaryFile.name}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-400">
                        <span className="ai-neural-pill">{formatFileSizeMb(totalBatchSize)}</span>
                        {primaryFile?.type ? <span className="ai-neural-pill">{primaryFile.type}</span> : null}
                        {hasBatch ? <span className="ai-neural-pill"><FileStack size={13} /> {t('legacyAi.aiStudio.multiFile')}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={onBrowseClick} className="auth-secondary-btn">
                        {t('btnReplaceFile')}
                      </button>
                      <button type="button" onClick={onClear} className="auth-secondary-btn">
                        {t('btnClear')}
                      </button>
                    </div>
                  </div>

                  {hasBatch && (
                    <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                      {selectedFiles.slice(0, 4).map((item) => item.name).join(' · ')}
                      {selectedFiles.length > 4 ? ' · ...' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>

            {batchStackNode}

            {(status === 'processing' || stage !== 'idle' || status === 'done' || (status === 'error' && conversionError)) && (
              <div className="ai-neural-surface rounded-[2rem] p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{t('legacyAi.aiStudio.pipelineState')}</div>
                    <div className="mt-2 text-xl font-semibold text-white">{stageMessage}</div>
                    <div className="mt-2 text-sm text-slate-400">
                      {status === 'processing' ? (pipelineStage || t('legacyAi.aiStudio.optimizingRoute')) : t('legacyAi.aiStudio.standingBy')}
                    </div>
                  </div>
                  {status === 'done' && downloadUrl ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={onDownload} className="auth-primary-btn">{t('download')}</button>
                      {canQuickLook ? <button type="button" onClick={onQuickLook} className="auth-secondary-btn">{t('legacyAi.aiStudio.quickLook')}</button> : null}
                      <button type="button" onClick={onReset} className="auth-secondary-btn">{t('legacyAi.aiStudio.newRequest')}</button>
                    </div>
                  ) : null}
                </div>

                {(status === 'processing' || stage !== 'idle') && (
                  <>
                    <div className="mt-5 ai-neural-progress-track">
                      <span className="ai-neural-progress-fill" style={{ width: `${safeProgress}%` }} />
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">{safeProgress}%</div>
                  </>
                )}

                {status === 'error' && conversionError ? (
                  <div className="auth-status-card auth-status-card-error mt-5">{conversionError}</div>
                ) : null}
              </div>
            )}

            <div className="ai-neural-surface rounded-[2rem] p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className={`ai-neural-stage ${isBusy ? 'is-active' : ''}`}>
                    <span className="ai-neural-stage-dot" />
                    <span>{stageMessage}</span>
                  </div>
                  {error ? <div className="mt-3 auth-status-card auth-status-card-error">{error}</div> : null}
                </div>
                {primaryFile ? (
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{mediaLane}</div>
                ) : null}
              </div>

              <div className={`mt-5 ai-neural-composer ${isBusy ? 'is-busy' : ''}`}>
                <textarea
                  value={prompt}
                  rows={3}
                  onChange={(event) => onPromptChange?.(event.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  placeholder={t('legacyAi.aiStudio.promptPlaceholder')}
                  className="ai-neural-textarea"
                />
                <button type="button" onClick={onSubmit} disabled={disabled} className="auth-primary-btn shrink-0">
                  {t('legacyAi.aiStudio.runPipeline')}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {promptSuggestions.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="ai-neural-chip"
                    onClick={() => onSuggestionPick?.(chip)}
                    disabled={stage !== 'idle'}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="ai-neural-surface rounded-[2rem] p-5 md:p-6">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{t('legacyAi.aiStudio.capabilityRack')}</div>
              <div className="mt-2 text-xl font-semibold text-white">{t('legacyAi.aiStudio.intentDrivenPresets')}</div>
              <div className="mt-4 space-y-3">
                {capabilityModules.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSuggestionPick?.(item.prompt)}
                      className="ai-neural-module"
                    >
                      <span className="ai-neural-module-icon">
                        <Icon size={16} />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-white">{item.title}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-400">{item.copy}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ai-neural-surface rounded-[2rem] p-5 md:p-6">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{t('legacyAi.aiStudio.executionLane')}</div>
              <div className="mt-2 text-xl font-semibold text-white">{t('legacyAi.aiStudio.localNeuralStack')}</div>
              <div className="mt-4 space-y-3">
                <div className="ai-neural-info-row">
                  <Cpu size={15} />
                  <span>{t('legacyAi.aiStudio.infoRows.browserFirst')}</span>
                </div>
                <div className="ai-neural-info-row">
                  <WandSparkles size={15} />
                  <span>{t('legacyAi.aiStudio.infoRows.oneFlow')}</span>
                </div>
                <div className="ai-neural-info-row">
                  <ShieldCheck size={15} />
                  <span>{t('legacyAi.aiStudio.infoRows.localPrivacy')}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
