import { useCallback, useEffect, useRef, useState } from 'react';

const UNSUPPORTED_MESSAGE = 'Локальная FFmpeg-конвертация недоступна в этом браузере.';

const supportsFFmpeg = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return typeof window.SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated === true;
};

const clampProgress = (value) => {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) {
    return 0;
  }

  return Math.max(0, Math.min(100, next));
};

const resolveActionFormat = (file, actionType) => {
  const fileType = String(file?.type || '').toLowerCase();

  const actionMap = {
    image_to_jpg: {
      ext: 'jpg',
      mime: 'image/jpeg',
      args: ['-i', '{input}', '-q:v', '2', '{output}'],
    },
    compress_image: {
      ext: 'jpg',
      mime: 'image/jpeg',
      args: ['-i', '{input}', '-q:v', '8', '{output}'],
    },
    compress_mp4: {
      ext: 'mp4',
      mime: 'video/mp4',
      args: ['-i', '{input}', '-b:v', '1400k', '-b:a', '128k', '-movflags', '+faststart', '{output}'],
    },
    extract_audio: {
      ext: 'mp3',
      mime: 'audio/mpeg',
      args: ['-i', '{input}', '-vn', '-b:a', '192k', '{output}'],
    },
    audio_to_mp3: {
      ext: 'mp3',
      mime: 'audio/mpeg',
      args: ['-i', '{input}', '-vn', '-b:a', '192k', '{output}'],
    },
    compress_audio: {
      ext: 'mp3',
      mime: 'audio/mpeg',
      args: ['-i', '{input}', '-vn', '-b:a', '96k', '{output}'],
    },
  };

  if (actionMap[actionType]) {
    return actionMap[actionType];
  }

  if (actionType === 'generic_convert') {
    if (fileType.startsWith('image/')) {
      return actionMap.image_to_jpg;
    }

    if (fileType.startsWith('video/')) {
      return {
        ext: 'mp4',
        mime: 'video/mp4',
        args: ['-i', '{input}', '-movflags', '+faststart', '{output}'],
      };
    }

    if (fileType.startsWith('audio/')) {
      return actionMap.audio_to_mp3;
    }
  }

  if (actionType === 'generic_compress') {
    if (fileType.startsWith('image/')) {
      return actionMap.compress_image;
    }

    if (fileType.startsWith('video/')) {
      return actionMap.compress_mp4;
    }

    if (fileType.startsWith('audio/')) {
      return actionMap.compress_audio;
    }
  }

  return null;
};

const createIdleState = () => ({
  isReady: false,
  isLoading: false,
  isConverting: false,
  progress: 0,
  result: null,
  error: '',
});

export default function useFFmpeg() {
  const [state, setState] = useState(createIdleState);
  const workerRef = useRef(null);
  const readyRef = useRef(false);
  const nextJobIdRef = useRef(0);
  const pendingLoadRef = useRef(null);
  const pendingProcessRef = useRef(null);
  const resultUrlRef = useRef(null);
  const silentLoadRef = useRef(false);
  const isSupported = supportsFFmpeg();

  const revokeResultUrl = useCallback(() => {
    if (!resultUrlRef.current) {
      return;
    }

    URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current || !isSupported) {
      return workerRef.current;
    }

    const worker = new Worker(new URL('../workers/ffmpegWorker.js', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event) => {
      const message = event.data || {};

      if (message.type === 'progress') {
        const nextProgress = clampProgress(message.progress);
        setState((current) => ({
          ...current,
          progress: Math.max(current.progress, nextProgress),
        }));
        return;
      }

      if (message.type === 'loaded') {
        readyRef.current = true;
        setState((current) => ({
          ...current,
          isReady: true,
          isLoading: false,
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
          type: String(message.mimeType || 'application/octet-stream'),
        });
        const url = URL.createObjectURL(blob);
        resultUrlRef.current = url;

        const nextResult = {
          blob,
          url,
          fileName: message.fileName,
          size: Number(message.size || blob.size || 0),
          mimeType: String(message.mimeType || 'application/octet-stream'),
        };

        setState((current) => ({
          ...current,
          isConverting: false,
          progress: 100,
          error: '',
          result: nextResult,
        }));

        if (pendingProcessRef.current?.jobId === message.jobId) {
          pendingProcessRef.current.resolve(nextResult);
          pendingProcessRef.current = null;
        }

        return;
      }

      if (message.type === 'error') {
        const nextError = String(message.message || 'FFmpeg не смог обработать файл.');

        setState((current) => ({
          ...current,
          isLoading: false,
          isConverting: false,
          error: nextError,
        }));

        if (pendingProcessRef.current?.jobId === message.jobId) {
          pendingProcessRef.current.reject(new Error(nextError));
          pendingProcessRef.current = null;
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

  const loadFFmpeg = useCallback(async ({ silent = false } = {}) => {
    if (!isSupported) {
      throw new Error(UNSUPPORTED_MESSAGE);
    }

    if (readyRef.current) {
      setState((current) => ({
        ...current,
        isReady: true,
      }));
      return true;
    }

    if (pendingLoadRef.current) {
      return pendingLoadRef.current.promise;
    }

    silentLoadRef.current = silent;

    if (!silent) {
      setState((current) => ({
        ...current,
        isLoading: true,
        error: '',
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
      promise,
    };

    worker.postMessage({
      type: 'load',
      jobId,
    });

    return promise;
  }, [ensureWorker, isSupported]);

  const resetSession = useCallback(() => {
    revokeResultUrl();
    setState({
      ...createIdleState(),
      isReady: readyRef.current,
    });
  }, [revokeResultUrl]);

  const clearError = useCallback(() => {
    setState((current) => ({
      ...current,
      error: '',
    }));
  }, []);

  const processMedia = useCallback(async (file, actionType) => {
    if (!isSupported) {
      const error = new Error(UNSUPPORTED_MESSAGE);
      setState((current) => ({
        ...current,
        error: error.message,
      }));
      throw error;
    }

    if (!file) {
      throw new Error('Файл не выбран.');
    }

    const format = resolveActionFormat(file, actionType);
    if (!format) {
      const error = new Error('Для этого файла локальное действие пока недоступно.');
      setState((current) => ({
        ...current,
        error: error.message,
      }));
      throw error;
    }

    await loadFFmpeg({ silent: true });
    revokeResultUrl();

    const worker = ensureWorker();
    const jobId = ++nextJobIdRef.current;

    setState((current) => ({
      ...current,
      isConverting: true,
      progress: 2,
      error: '',
      result: null,
      isReady: true,
    }));

    return new Promise((resolve, reject) => {
      pendingProcessRef.current = {
        jobId,
        resolve,
        reject,
      };

      worker.postMessage({
        type: 'convert',
        jobId,
        payload: {
          file,
          format,
        },
      });
    });
  }, [ensureWorker, isSupported, loadFFmpeg, revokeResultUrl]);

  useEffect(() => {
    return () => {
      if (pendingLoadRef.current) {
        pendingLoadRef.current.reject(new Error('FFmpeg worker disposed'));
        pendingLoadRef.current = null;
      }

      if (pendingProcessRef.current) {
        pendingProcessRef.current.reject(new Error('FFmpeg worker disposed'));
        pendingProcessRef.current = null;
      }

      revokeResultUrl();
      workerRef.current?.postMessage({ type: 'dispose' });
      workerRef.current = null;
      readyRef.current = false;
    };
  }, [revokeResultUrl]);

  return {
    ...state,
    isSupported,
    unsupportedMessage: UNSUPPORTED_MESSAGE,
    loadFFmpeg,
    processMedia,
    resetSession,
    clearError,
  };
}
