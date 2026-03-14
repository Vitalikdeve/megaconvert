import React from 'react';
import { useTranslation } from 'react-i18next';

export default function SmartAssistantPanel({
  file = null,
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
  disabled = false,
  stage = 'idle',
  intent = null,
  error = ''
}) {
  const { t } = useTranslation();
  const stageLabels = {
    analyzing: t('legacyAi.smartAssistant.stageLabels.analyzing'),
    converting: t('legacyAi.smartAssistant.stageLabels.converting')
  };
  const stageLabel = stageLabels[stage] || '';
  const buttonLabel = stageLabel || t('btnSend');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 ai-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500">AI Assistant</div>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">{t('legacyAi.smartAssistant.title')}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {t('legacyAi.smartAssistant.description')}
          </p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          Groq Router
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div
          className={`dropzone rounded-2xl border ${file ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50/80'} p-6 text-center ${isDragOver ? 'is-dragover' : ''}`}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {file ? (
            <div className="text-left">
              <div className="text-xs uppercase tracking-widest text-slate-500">{t('legacyAi.smartAssistant.fileLoaded')}</div>
              <div className="mt-2 text-base font-semibold text-slate-900 break-all">{file.name}</div>
              <div className="mt-1 text-sm text-slate-500">
                {(Number(file.size || 0) / (1024 * 1024)).toFixed(2)} MB
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onBrowseClick}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('btnReplaceFile')}
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('btnClear')}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-base font-semibold text-slate-900">{t('legacyAi.smartAssistant.dropTitle')}</div>
              <div className="mt-2 text-sm text-slate-500">{t('legacyAi.smartAssistant.dropHint')}</div>
              <button
                type="button"
                onClick={onBrowseClick}
                className="mt-4 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('btnSelect')}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="text-xs uppercase tracking-widest text-slate-500">{t('legacyAi.smartAssistant.promptLabel')}</label>
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange?.(event.target.value)}
            rows={6}
            placeholder={t('legacyAi.smartAssistant.promptPlaceholder')}
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={onSubmit}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {buttonLabel}
            </button>
            {intent?.from && intent?.to && (
              <div className="text-xs text-slate-600">
                {t('legacyAi.smartAssistant.routeLabel')} <strong>{intent.from}</strong> → <strong>{intent.to}</strong>
              </div>
            )}
          </div>

          {stageLabel && (
            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              {stageLabel}
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
