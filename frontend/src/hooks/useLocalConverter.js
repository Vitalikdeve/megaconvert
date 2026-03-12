import { useCallback, useEffect, useRef, useState } from 'react';

const UNSUPPORTED_SAB_MESSAGE = 'Ваш браузер не поддерживает локальную конвертацию. Пожалуйста, воспользуйтесь облачным конвертером';

const createIdleState = () => ({
  status: 'idle',
  progress: 0,
  error: '',
  statusText: 'Готов к локальной обработке',
  result: null,
  engineReady: false
});

const supportsLocalConversion = () => {
  if (typeof window === 'undefined') return false;
  return typeof window.SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated === true;
};

export default function useLocalConverter() {
  const [state, setState] = useState(createIdleState);
  const workerRef = useRef(null);
  const workerReadyRef = useRef(false);
  const nextJobIdRef = useRef(0);
  const pendingLoadRef = useRef(null);
  const pendingConvertRef = useRef(null);
  const resultUrlRef = useRef(null);
  const silentLoadRef = useRef(false);
  const isSupported = supportsLocalConversion();

  const revokeResultUrl = useCallback(() => {
    if (!resultUrlRef.current) return;
    URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
  }, []);

  const applyIdleState = useCallback(({ keepEngineReady = workerReadyRef.current } = {}) => {
    revokeResultUrl();
    setState({
      ...createIdleState(),
      engineReady: keepEngineReady
    });
  }, [revokeResultUrl]);

  const ensureWorker = useCallback(() => {
    if (workerRef.current || !isSupported) return workerRef.current;

    const worker = new Worker(new URL('../workers/ffmpegWorker.js', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (event) => {
      const message = event.data || {};

      if (message.type === 'log') {
        if (message.message) {
          console.log('[MegaConvert][ffmpeg]', message.message);
        }
        return;
      }

      if (message.type === 'progress') {
        const progress = Math.max(0, Math.min(100, Number(message.progress || 0)));
        console.log('[MegaConvert][ffmpeg-progress]', progress);
        setState((current) => ({
          ...current,
          progress: Math.max(current.progress, progress)
        }));
        return;
      }

      if (message.type === 'status') {
        if (!silentLoadRef.current || message.status !== 'loading') {
          setState((current) => ({
            ...current,
            status: message.status || current.status,
            statusText: message.text || current.statusText,
            error: message.status === 'error' ? current.error : ''
          }));
        }
        return;
      }

      if (message.type === 'loaded') {
        workerReadyRef.current = true;
        setState((current) => ({
          ...current,
          engineReady: true,
          status: current.status === 'loading' ? 'idle' : current.status,
          statusText: current.status === 'loading' ? 'FFmpeg готов к запуску' : current.statusText
        }));
        if (pendingLoadRef.current) {
          pendingLoadRef.current.resolve(true);
          pendingLoadRef.current = null;
        }
        silentLoadRef.current = false;
        return;
      }

      if (message.type === 'result') {
        revokeResultUrl();
        const blob = new Blob([message.buffer], {
          type: String(message.mimeType || 'application/octet-stream')
        });
        const url = URL.createObjectURL(blob);
        resultUrlRef.current = url;

        setState((current) => ({
          ...current,
          status: 'done',
          progress: 100,
          error: '',
          statusText: 'Конвертация завершена. Файл готов к скачиванию.',
          result: {
            fileName: message.fileName,
            size: Number(message.size || blob.size || 0),
            url
          }
        }));

        if (pendingConvertRef.current?.jobId === message.jobId) {
          pendingConvertRef.current.resolve({
            fileName: message.fileName,
            size: Number(message.size || blob.size || 0),
            url
          });
          pendingConvertRef.current = null;
        }
        return;
      }

      if (message.type === 'error') {
        const nextError = String(message.message || 'Не удалось выполнить локальную конвертацию.');
        setState((current) => ({
          ...current,
          status: 'error',
          error: nextError,
          statusText: 'Конвертация завершилась с ошибкой'
        }));

        if (pendingConvertRef.current?.jobId === message.jobId) {
          pendingConvertRef.current.reject(new Error(nextError));
          pendingConvertRef.current = null;
        } else if (pendingLoadRef.current) {
          pendingLoadRef.current.reject(new Error(nextError));
          pendingLoadRef.current = null;
        }
        silentLoadRef.current = false;
      }
    };

    workerRef.current = worker;
    return worker;
  }, [isSupported, revokeResultUrl]);

  const loadEngine = useCallback(async ({ silent = false } = {}) => {
    if (!isSupported) {
      throw new Error(UNSUPPORTED_SAB_MESSAGE);
    }

    if (workerReadyRef.current) {
      setState((current) => ({ ...current, engineReady: true }));
      return true;
    }

    if (pendingLoadRef.current) {
      return pendingLoadRef.current.promise;
    }

    silentLoadRef.current = silent;
    if (!silent) {
      setState((current) => ({
        ...current,
        status: 'loading',
        statusText: 'Загружаем FFmpeg ядро...',
        error: ''
      }));
    }

    const worker = ensureWorker();
    const jobId = ++nextJobIdRef.current;
    let resolvePending;
    let rejectPending;
    const promise = new Promise((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
    pendingLoadRef.current = {
      resolve: resolvePending,
      reject: rejectPending,
      promise
    };
    worker.postMessage({
      type: 'load',
      jobId
    });
    return promise;
  }, [ensureWorker, isSupported]);

  const reset = useCallback(() => {
    applyIdleState();
  }, [applyIdleState]);

  const clearError = useCallback(() => {
    setState((current) => ({
      ...current,
      error: ''
    }));
  }, []);

  const startConversion = useCallback(async (file, format) => {
    if (!isSupported) {
      const error = new Error(UNSUPPORTED_SAB_MESSAGE);
      setState((current) => ({
        ...current,
        status: 'error',
        error: error.message,
        statusText: error.message
      }));
      throw error;
    }

    if (!file) {
      throw new Error('Файл для конвертации не выбран.');
    }

    await loadEngine();
    revokeResultUrl();

    const jobId = ++nextJobIdRef.current;
    const worker = ensureWorker();
    const payload = {
      file,
      format
    };

    setState((current) => ({
      ...current,
      status: 'converting',
      progress: 2,
      error: '',
      statusText: 'Локальная конвертация в процессе...',
      result: null
    }));

    return new Promise((resolve, reject) => {
      pendingConvertRef.current = { jobId, resolve, reject };
      worker.postMessage({
        type: 'convert',
        jobId,
        payload
      });
    });
  }, [ensureWorker, isSupported, loadEngine, revokeResultUrl]);

  useEffect(() => {
    return () => {
      if (pendingLoadRef.current) {
        pendingLoadRef.current.reject(new Error('FFmpeg worker disposed'));
        pendingLoadRef.current = null;
      }
      if (pendingConvertRef.current) {
        pendingConvertRef.current.reject(new Error('FFmpeg worker disposed'));
        pendingConvertRef.current = null;
      }
      revokeResultUrl();
      workerRef.current?.postMessage({ type: 'dispose' });
      workerRef.current = null;
      workerReadyRef.current = false;
    };
  }, [revokeResultUrl]);

  return {
    ...state,
    isSupported,
    unsupportedMessage: UNSUPPORTED_SAB_MESSAGE,
    isBusy: state.status === 'loading' || state.status === 'converting',
    loadEngine,
    startConversion,
    reset,
    clearError
  };
}
