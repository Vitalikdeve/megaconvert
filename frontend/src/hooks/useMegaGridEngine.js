import { useCallback, useEffect, useRef, useState } from 'react';

const UNSUPPORTED_SAB_MESSAGE = 'MegaGrid требует SharedArrayBuffer и cross-origin isolation.';

const createIdleState = () => ({
  status: 'idle',
  progress: 0,
  error: '',
  statusText: 'WASM-движок MegaGrid готов',
  engineReady: false
});

const supportsMegaGridEngine = () => {
  if (typeof window === 'undefined') return false;
  return typeof window.SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated === true;
};

const clampProgress = (value) => {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.min(100, next));
};

export default function useMegaGridEngine() {
  const [state, setState] = useState(createIdleState);
  const workerRef = useRef(null);
  const workerReadyRef = useRef(false);
  const nextJobIdRef = useRef(0);
  const pendingJobsRef = useRef(new Map());
  const isSupported = supportsMegaGridEngine();

  const ensureWorker = useCallback(() => {
    if (workerRef.current || !isSupported) return workerRef.current;

    const worker = new Worker(new URL('../workers/ffmpegWorker.js', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (event) => {
      const message = event.data || {};

      if (message.type === 'log') {
        if (message.message) {
          console.log('[MegaGrid][ffmpeg]', message.message);
        }
        return;
      }

      if (message.type === 'progress') {
        const progress = clampProgress(message.progress);
        setState((current) => ({
          ...current,
          progress: Math.max(current.progress, progress)
        }));
        return;
      }

      if (message.type === 'status') {
        setState((current) => ({
          ...current,
          status: message.status || current.status,
          statusText: message.text || current.statusText,
          error: message.status === 'error' ? current.error : ''
        }));
        return;
      }

      if (message.type === 'loaded') {
        workerReadyRef.current = true;
        const pendingLoad = pendingJobsRef.current.get(message.jobId);
        if (pendingLoad) {
          pendingJobsRef.current.delete(message.jobId);
          pendingLoad.resolve(true);
        }
        setState((current) => ({
          ...current,
          status: 'idle',
          progress: 0,
          error: '',
          statusText: 'FFmpeg Grid Engine готов',
          engineReady: true
        }));
        return;
      }

      if (message.type === 'segment-result' || message.type === 'buffer-result' || message.type === 'concat-result') {
        const pendingJob = pendingJobsRef.current.get(message.jobId);
        if (!pendingJob) return;
        pendingJobsRef.current.delete(message.jobId);
        setState((current) => ({
          ...current,
          status: 'idle',
          progress: 100,
          error: '',
          engineReady: true
        }));
        pendingJob.resolve(message);
        return;
      }

      if (message.type === 'error') {
        const nextError = String(message.message || 'MegaGrid worker failed');
        const pendingJob = pendingJobsRef.current.get(message.jobId);
        if (pendingJob) {
          pendingJobsRef.current.delete(message.jobId);
          pendingJob.reject(new Error(nextError));
        }
        setState((current) => ({
          ...current,
          status: 'error',
          error: nextError,
          statusText: nextError
        }));
      }
    };

    workerRef.current = worker;
    return worker;
  }, [isSupported]);

  const loadEngine = useCallback(async () => {
    if (!isSupported) throw new Error(UNSUPPORTED_SAB_MESSAGE);
    if (workerReadyRef.current) {
      setState((current) => ({ ...current, engineReady: true }));
      return true;
    }

    const worker = ensureWorker();
    const jobId = ++nextJobIdRef.current;
    setState((current) => ({
      ...current,
      status: 'loading',
      progress: 0,
      error: '',
      statusText: 'Загружаем FFmpeg Grid Engine...'
    }));

    const promise = new Promise((resolve, reject) => {
      pendingJobsRef.current.set(jobId, { resolve, reject, type: 'load' });
    });
    worker.postMessage({ type: 'load', jobId });
    return promise;
  }, [ensureWorker, isSupported]);

  const runJob = useCallback(async (type, payload, statusText) => {
    if (!isSupported) throw new Error(UNSUPPORTED_SAB_MESSAGE);
    await loadEngine();
    const worker = ensureWorker();
    const jobId = ++nextJobIdRef.current;

    setState((current) => ({
      ...current,
      status: type,
      progress: 1,
      error: '',
      statusText,
      engineReady: true
    }));

    const promise = new Promise((resolve, reject) => {
      pendingJobsRef.current.set(jobId, { resolve, reject, type });
    });
    worker.postMessage({ type, jobId, payload });
    return promise;
  }, [ensureWorker, isSupported, loadEngine]);

  const segmentMedia = useCallback(async (file, { segmentSeconds = 5 } = {}) => {
    const response = await runJob('segment', { file, segmentSeconds }, 'Разбиваем исходное видео на сегменты...');
    return {
      segmentExt: response.segmentExt,
      segments: Array.isArray(response.segments) ? response.segments : []
    };
  }, [runJob]);

  const convertBuffer = useCallback(async ({ buffer, fileName, format }) => {
    const response = await runJob(
      'convert-buffer',
      { buffer, fileName, format },
      'Worker обрабатывает сегмент через FFmpeg.wasm...'
    );
    return {
      fileName: response.fileName,
      mimeType: response.mimeType,
      size: Number(response.size || 0),
      buffer: response.buffer
    };
  }, [runJob]);

  const concatSegments = useCallback(async ({ segments, outputFileName, outputExt, mimeType }) => {
    const response = await runJob(
      'concat',
      { segments, outputFileName, outputExt, mimeType },
      'Склеиваем результат обратно в единый файл...'
    );
    return {
      fileName: response.fileName,
      mimeType: response.mimeType,
      size: Number(response.size || 0),
      buffer: response.buffer
    };
  }, [runJob]);

  const clearError = useCallback(() => {
    setState((current) => ({
      ...current,
      error: ''
    }));
  }, []);

  useEffect(() => () => {
    for (const pendingJob of pendingJobsRef.current.values()) {
      pendingJob.reject(new Error('MegaGrid worker disposed'));
    }
    pendingJobsRef.current.clear();
    workerRef.current?.postMessage({ type: 'dispose' });
    workerRef.current = null;
    workerReadyRef.current = false;
  }, []);

  return {
    ...state,
    isSupported,
    unsupportedMessage: UNSUPPORTED_SAB_MESSAGE,
    isBusy: state.status !== 'idle' && state.status !== 'error',
    loadEngine,
    segmentMedia,
    convertBuffer,
    concatSegments,
    clearError
  };
}
