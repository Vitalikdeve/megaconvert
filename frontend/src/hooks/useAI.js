import { useCallback, useRef, useState } from 'react';
import { pipeline } from '@xenova/transformers';

const MODEL_ID = 'Xenova/modnet';
const TASK = 'background-removal';

let sharedPipelinePromise = null;
let sharedPipelineInstance = null;
let sharedDevice = null;

const supportsWebGPU = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return typeof navigator.gpu !== 'undefined';
};

const normalizeProgress = (update) => {
  if (!update) {
    return 0;
  }

  if (typeof update.progress === 'number') {
    const value = update.progress <= 1 ? update.progress * 100 : update.progress;
    return Math.max(0, Math.min(100, value));
  }

  if (typeof update.loaded === 'number' && typeof update.total === 'number' && update.total > 0) {
    return Math.max(0, Math.min(100, (update.loaded / update.total) * 100));
  }

  if (update.status === 'ready' || update.status === 'done') {
    return 100;
  }

  return 0;
};

const buildResultName = (name) => {
  const cleaned = String(name || 'image')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.+/g, '.');
  const base = cleaned.includes('.') ? cleaned.slice(0, cleaned.lastIndexOf('.')) : cleaned;
  const normalizedBase = String(base || 'image').replace(/[-_.]+$/g, '') || 'image';
  return `${normalizedBase}-no-bg.png`;
};

export default function useAI() {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelDevice, setModelDevice] = useState(sharedDevice);
  const [error, setError] = useState('');
  const objectUrlRef = useRef(null);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const loadModel = useCallback(async () => {
    if (sharedPipelineInstance) {
      setModelDevice(sharedDevice);
      setModelProgress(100);
      return sharedPipelineInstance;
    }

    if (sharedPipelinePromise) {
      setIsModelLoading(true);
      return sharedPipelinePromise;
    }

    setError('');
    setIsModelLoading(true);
    setModelProgress(0);

    const onProgress = (update) => {
      const nextProgress = normalizeProgress(update);
      setModelProgress((current) => Math.max(current, nextProgress));
    };

    const createPipeline = async (device) => pipeline(TASK, MODEL_ID, {
      device,
      progress_callback: onProgress,
    });

    sharedPipelinePromise = (async () => {
      try {
        const preferredDevice = supportsWebGPU() ? 'webgpu' : 'wasm';

        try {
          sharedPipelineInstance = await createPipeline(preferredDevice);
          sharedDevice = preferredDevice;
        } catch (preferredError) {
          if (preferredDevice !== 'webgpu') {
            throw preferredError;
          }

          sharedPipelineInstance = await createPipeline('wasm');
          sharedDevice = 'wasm';
        }

        setModelDevice(sharedDevice);
        setModelProgress(100);
        return sharedPipelineInstance;
      } finally {
        sharedPipelinePromise = null;
        setIsModelLoading(false);
      }
    })();

    return sharedPipelinePromise;
  }, []);

  const resetSession = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setIsProcessing(false);
    setError('');
  }, []);

  const removeBackground = useCallback(async (file) => {
    if (!file) {
      throw new Error('Файл не выбран.');
    }

    setError('');
    const model = await loadModel();
    setIsProcessing(true);

    const sourceUrl = URL.createObjectURL(file);
    objectUrlRef.current = sourceUrl;

    try {
      const output = await model(sourceUrl);
      const image = Array.isArray(output) ? output[0] : output;

      if (!image || typeof image.toBlob !== 'function') {
        throw new Error('Нейросеть не смогла подготовить PNG-результат.');
      }

      const blob = await image.toBlob('image/png');
      return {
        blob,
        fileName: buildResultName(file.name),
        mimeType: 'image/png',
        size: blob.size,
      };
    } catch (nextError) {
      const message = String(nextError?.message || 'Не удалось выполнить AI-обработку изображения.');
      setError(message);
      throw new Error(message);
    } finally {
      setIsProcessing(false);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    }
  }, [loadModel]);

  return {
    isModelLoading,
    isProcessing,
    modelProgress,
    modelDevice,
    error,
    clearError,
    loadModel,
    removeBackground,
    resetSession,
  };
}
