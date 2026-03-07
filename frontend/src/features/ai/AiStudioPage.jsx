import React from 'react';

const PROMPT_SUGGESTIONS = [
  'Сделать PDF вордом',
  'Аудио в MP3',
  'Картинку в PNG',
  'Сжать видео без потери качества'
];

const STAGE_MESSAGES = {
  idle: 'Готов к обработке',
  analyzing: 'ИИ анализирует запрос...',
  converting: 'ИИ выполняет конвертацию...'
};

const formatFileSizeMb = (size) => `${(Math.max(0, Number(size || 0)) / (1024 * 1024)).toFixed(2)} MB`;

export default function AiStudioPage({
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
  onReset
}) {
  const stageMessage = STAGE_MESSAGES[stage] || STAGE_MESSAGES.idle;
  const safeProgress = Math.max(6, Math.min(100, Math.round(Number(progress || 0))));
  const isBusy = stage !== 'idle' || status === 'processing';

  const handlePromptKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    if (!disabled) {
      onSubmit?.();
    }
  };

  return (
    <section className="ai-studio page-enter pt-32 pb-14 px-4">
      <div className="ai-studio-orb ai-studio-orb-a" />
      <div className="ai-studio-orb ai-studio-orb-b" />
      <div className="ai-studio-shell">
        <div className="ai-studio-copy text-center">
          <h1 className="ai-studio-title">AI-Ассистент MegaConvert</h1>
          <p className="ai-studio-subtitle">Загрузите файл и просто скажите, что с ним сделать</p>
        </div>

        <div
          className={`ai-studio-dropzone ${isDragOver ? 'is-dragover' : ''} ${file ? 'has-file' : ''}`}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {!file ? (
            <div className="ai-studio-dropzone-empty">
              <div className="ai-studio-dropzone-title">Перетащите файл в эту область</div>
              <div className="ai-studio-dropzone-subtitle">или загрузите его вручную</div>
              <button type="button" onClick={onBrowseClick} className="ai-studio-ghost-btn">
                Выбрать файл
              </button>
            </div>
          ) : (
            <div className="ai-studio-dropzone-file">
              <div className="ai-studio-file-label">Файл готов к AI-обработке</div>
              <div className="ai-studio-file-name">{file.name}</div>
              <div className="ai-studio-file-size">{formatFileSizeMb(file.size)}</div>
              <div className="ai-studio-file-actions">
                <button type="button" onClick={onBrowseClick} className="ai-studio-ghost-btn">
                  Заменить файл
                </button>
                <button type="button" onClick={onClear} className="ai-studio-ghost-btn">
                  Очистить
                </button>
              </div>
            </div>
          )}
        </div>

        {(status === 'processing' || stage !== 'idle') && (
          <div className="ai-studio-progress-card">
            <div className="ai-studio-progress-label">{stageMessage}</div>
            <div className="ai-studio-progress-track">
              <span className="ai-studio-progress-fill" style={{ width: `${safeProgress}%` }} />
            </div>
            <div className="ai-studio-progress-note">
              {status === 'processing' ? (pipelineStage || 'Оптимизируем маршрут и запускаем обработку') : 'Подготовка к запуску'}
            </div>
          </div>
        )}

        {status === 'done' && downloadUrl && (
          <div className="ai-studio-result ai-studio-result-success">
            <div className="ai-studio-result-title">Файл готов</div>
            <div className="ai-studio-result-actions">
              <button type="button" onClick={onDownload} className="ai-studio-primary-btn">
                Скачать
              </button>
              <button type="button" onClick={onReset} className="ai-studio-ghost-btn">
                Новый запрос
              </button>
            </div>
          </div>
        )}

        {status === 'error' && conversionError && (
          <div className="ai-studio-result ai-studio-result-error">
            {conversionError}
          </div>
        )}

        <div className="ai-studio-composer-wrap">
          <div className={`ai-studio-stage ${isBusy ? 'is-active' : ''}`}>
            <span className="ai-studio-stage-dot" />
            <span>{stageMessage}</span>
          </div>
          {intent?.from && intent?.to && (
            <div className="ai-studio-route">Маршрут: {intent.from} → {intent.to}</div>
          )}
          {error && <div className="ai-studio-error">{error}</div>}

          <div className={`ai-studio-composer ${isBusy ? 'is-busy' : ''}`}>
            <textarea
              value={prompt}
              rows={2}
              onChange={(event) => onPromptChange?.(event.target.value)}
              onKeyDown={handlePromptKeyDown}
              placeholder="Например: переделай этот PDF в Word и сохрани форматирование"
              className="ai-studio-textarea"
            />
            <button type="button" onClick={onSubmit} disabled={disabled} className="ai-studio-send-btn">
              Отправить
            </button>
          </div>

          <div className="ai-studio-chips">
            {PROMPT_SUGGESTIONS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="ai-studio-chip"
                onClick={() => onSuggestionPick?.(chip)}
                disabled={stage !== 'idle'}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
