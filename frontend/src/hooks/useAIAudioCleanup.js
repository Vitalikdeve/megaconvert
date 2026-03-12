import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const AudioContextClass = (
  typeof window !== 'undefined'
    ? (window.AudioContext || window.webkitAudioContext || null)
    : null
);
const OfflineAudioContextClass = (
  typeof window !== 'undefined'
    ? (window.OfflineAudioContext || window.webkitOfflineAudioContext || null)
    : null
);

const createIdleState = () => ({
  status: 'idle',
  progress: 0,
  error: '',
  statusText: 'AI-очистка звука готова к запуску',
  modelReady: false,
  modelDevice: '',
  modelId: '',
  samplingRate: 16000,
  lastCleanup: null
});

const supportsAIAudioCleanup = () => {
  if (typeof window === 'undefined') return false;
  return (
    typeof AudioContextClass === 'function' &&
    typeof OfflineAudioContextClass === 'function' &&
    typeof window.Worker !== 'undefined'
  );
};

const clampProgress = (value) => {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.min(100, Math.round(next)));
};

const getBaseFileName = (name) => {
  const normalized = String(name || 'audio')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.+/g, '.');

  if (!normalized.includes('.')) {
    return normalized || 'audio';
  }

  const base = normalized.slice(0, normalized.lastIndexOf('.'));
  return String(base || 'audio').replace(/[-_.]+$/g, '') || 'audio';
};

const cloneAudioBuffer = (audioBuffer, targetContext) => {
  const clone = targetContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    clone.copyToChannel(audioBuffer.getChannelData(channel), channel);
  }

  return clone;
};

const resampleToMono = async (audioBuffer, targetSampleRate) => {
  const offlineContext = new OfflineAudioContextClass(
    1,
    Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate)),
    targetSampleRate
  );
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);
  const rendered = await offlineContext.startRendering();
  return new Float32Array(rendered.getChannelData(0));
};

const renderFilteredBuffer = async (audioBuffer) => {
  const offlineContext = new OfflineAudioContextClass(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = cloneAudioBuffer(audioBuffer, offlineContext);

  const highPass = offlineContext.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 70;
  highPass.Q.value = 0.707;

  const lowPass = offlineContext.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = Math.min(8200, (audioBuffer.sampleRate / 2) - 250);
  lowPass.Q.value = 0.85;

  const compressor = offlineContext.createDynamicsCompressor();
  compressor.threshold.value = -26;
  compressor.knee.value = 16;
  compressor.ratio.value = 3.2;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.18;

  source.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(compressor);
  compressor.connect(offlineContext.destination);
  source.start(0);

  return offlineContext.startRendering();
};

const isInsideSpeechWindow = (time, segments, windowLead, windowTail, pointer) => {
  let segmentIndex = pointer;
  while (
    segmentIndex < segments.length &&
    time > (Number(segments[segmentIndex]?.end || 0) + windowTail)
  ) {
    segmentIndex += 1;
  }

  const segment = segments[segmentIndex] || null;
  if (!segment) {
    return { inSpeechWindow: false, segmentIndex };
  }

  const start = Number(segment.start || 0) - windowLead;
  const end = Number(segment.end || 0) + windowTail;
  return {
    inSpeechWindow: time >= start && time <= end,
    segmentIndex
  };
};

const estimateNoiseFloor = (monoData, sampleRate, speechSegments) => {
  if (!monoData?.length) return 0.0035;

  const sampleStep = Math.max(1, Math.floor(sampleRate / 250));
  let pointer = 0;
  let sumSquares = 0;
  let count = 0;

  for (let index = 0; index < monoData.length; index += sampleStep) {
    const time = index / sampleRate;
    const { inSpeechWindow, segmentIndex } = isInsideSpeechWindow(time, speechSegments, 0.1, 0.16, pointer);
    pointer = segmentIndex;

    if (inSpeechWindow) {
      continue;
    }

    const sample = monoData[index] || 0;
    sumSquares += sample * sample;
    count += 1;
  }

  if (!count) {
    let fallbackSquares = 0;
    const limit = Math.max(1, Math.floor(monoData.length / 18000));
    for (let index = 0; index < monoData.length; index += limit) {
      const sample = monoData[index] || 0;
      fallbackSquares += sample * sample;
    }
    return Math.max(0.0035, Math.sqrt(fallbackSquares / Math.max(1, Math.ceil(monoData.length / limit))) * 0.42);
  }

  return Math.max(0.0035, Math.sqrt(sumSquares / count));
};

const createGainResolver = (speechSegments, speechCoverage) => {
  const fallbackGain = speechCoverage >= 0.06 ? 0.34 : 0.68;
  const attackSeconds = 0.08;
  const releaseSeconds = 0.16;

  return (time, pointer) => {
    let segmentIndex = pointer;
    while (
      segmentIndex < speechSegments.length &&
      time > (Number(speechSegments[segmentIndex]?.end || 0) + releaseSeconds)
    ) {
      segmentIndex += 1;
    }

    const segment = speechSegments[segmentIndex] || null;
    if (!segment) {
      return { gain: fallbackGain, segmentIndex };
    }

    const start = Number(segment.start || 0);
    const end = Number(segment.end || 0);
    const leadStart = Math.max(0, start - attackSeconds);
    const tailEnd = end + releaseSeconds;

    if (time < leadStart || time > tailEnd) {
      return { gain: fallbackGain, segmentIndex };
    }

    if (time < start) {
      const ratio = (time - leadStart) / Math.max(attackSeconds, 0.0001);
      return {
        gain: fallbackGain + ((1 - fallbackGain) * Math.max(0, Math.min(1, ratio))),
        segmentIndex
      };
    }

    if (time <= end) {
      return { gain: 1, segmentIndex };
    }

    const ratio = 1 - ((time - end) / Math.max(releaseSeconds, 0.0001));
    return {
      gain: fallbackGain + ((1 - fallbackGain) * Math.max(0, Math.min(1, ratio))),
      segmentIndex
    };
  };
};

const applySpeechAwareCleanup = async (audioBuffer, speechSegments, speechCoverage) => {
  const filteredBuffer = await renderFilteredBuffer(audioBuffer);
  const monoReference = audioBuffer.numberOfChannels > 1
    ? new Float32Array(audioBuffer.length)
    : audioBuffer.getChannelData(0);

  if (audioBuffer.numberOfChannels > 1) {
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let index = 0; index < audioBuffer.length; index += 1) {
        monoReference[index] += channelData[index] / audioBuffer.numberOfChannels;
      }
    }
  }

  const noiseFloor = estimateNoiseFloor(monoReference, audioBuffer.sampleRate, speechSegments);
  const noiseGateThreshold = Math.min(0.045, Math.max(0.0042, noiseFloor * 2.15));
  const gainAtTime = createGainResolver(speechSegments, speechCoverage);
  const outputChannels = [];
  let peak = 0;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const original = audioBuffer.getChannelData(channel);
    const filtered = filteredBuffer.getChannelData(channel);
    const output = new Float32Array(audioBuffer.length);
    let pointer = 0;

    for (let index = 0; index < audioBuffer.length; index += 1) {
      const time = index / audioBuffer.sampleRate;
      const { gain, segmentIndex } = gainAtTime(time, pointer);
      pointer = segmentIndex;

      const mixed = (original[index] * 0.34) + (filtered[index] * 0.66);
      const gate = gain < 0.95 && Math.abs(mixed) < noiseGateThreshold ? 0.74 : 1;
      const value = mixed * gain * gate;
      output[index] = value;
      const absolute = Math.abs(value);
      if (absolute > peak) peak = absolute;
    }

    outputChannels.push(output);
  }

  const safePeak = Math.max(peak, 0.0001);
  const normalization = safePeak > 0.96
    ? 0.96 / safePeak
    : Math.min(1.16, 0.92 / safePeak);

  if (Math.abs(normalization - 1) > 0.01) {
    for (const channelData of outputChannels) {
      for (let index = 0; index < channelData.length; index += 1) {
        channelData[index] *= normalization;
      }
    }
  }

  return {
    channels: outputChannels,
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: audioBuffer.numberOfChannels,
    duration: audioBuffer.duration,
    noiseFloor,
    noiseGateThreshold
  };
};

const encodeWav = ({ channels, sampleRate, numberOfChannels }) => {
  const channelCount = Math.max(1, Number(numberOfChannels || channels?.length || 1));
  const length = channels?.[0]?.length || 0;
  const blockAlign = channelCount * 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < length; index += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, Number(channels?.[channel]?.[index] || 0)));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

export default function useAIAudioCleanup() {
  const [state, setState] = useState(createIdleState);
  const workerRef = useRef(null);
  const workerReadyRef = useRef(false);
  const nextJobIdRef = useRef(0);
  const pendingLoadRef = useRef(null);
  const pendingAnalyzeRef = useRef(null);
  const isSupported = useMemo(() => supportsAIAudioCleanup(), []);

  const setStatus = useCallback((status, statusText, progress, extra = {}) => {
    setState((current) => ({
      ...current,
      status,
      statusText: statusText || current.statusText,
      progress: clampProgress(progress),
      error: status === 'error' ? current.error : '',
      ...extra
    }));
  }, []);

  const reset = useCallback(() => {
    setState((current) => ({
      ...createIdleState(),
      modelReady: current.modelReady,
      modelDevice: current.modelDevice,
      modelId: current.modelId,
      samplingRate: current.samplingRate
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((current) => ({
      ...current,
      error: ''
    }));
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current || !isSupported) {
      return workerRef.current;
    }

    const worker = new Worker(new URL('../workers/aiAudioWorker.js', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (event) => {
      const message = event.data || {};

      if (message.type === 'log') {
        if (message.message) {
          console.log('[MegaConvert][ai-audio]', message.message);
        }
        return;
      }

      if (message.type === 'status') {
        setState((current) => ({
          ...current,
          status: message.status || current.status,
          statusText: message.text || current.statusText,
          progress: message.progress == null ? current.progress : clampProgress(message.progress)
        }));
        return;
      }

      if (message.type === 'loaded') {
        workerReadyRef.current = true;
        setState((current) => ({
          ...current,
          modelReady: true,
          modelDevice: String(message.device || ''),
          modelId: String(message.modelId || ''),
          samplingRate: Number(message.samplingRate || current.samplingRate || 16000),
          status: current.status === 'loading-model' ? 'idle' : current.status,
          statusText: current.status === 'loading-model'
            ? 'AI-модель готова к запуску'
            : current.statusText
        }));

        if (pendingLoadRef.current) {
          pendingLoadRef.current.resolve({
            device: String(message.device || ''),
            modelId: String(message.modelId || ''),
            samplingRate: Number(message.samplingRate || 16000)
          });
          pendingLoadRef.current = null;
        }
        return;
      }

      if (message.type === 'analysis-result') {
        if (pendingAnalyzeRef.current?.jobId === message.jobId) {
          pendingAnalyzeRef.current.resolve({
            speechSegments: Array.isArray(message.speechSegments) ? message.speechSegments : [],
            speechCoverage: Number(message.speechCoverage || 0),
            modelId: String(message.modelId || ''),
            device: String(message.device || ''),
            samplingRate: Number(message.samplingRate || 16000)
          });
          pendingAnalyzeRef.current = null;
        }
        return;
      }

      if (message.type === 'error') {
        const nextError = String(message.message || 'Не удалось выполнить AI-очистку звука.');
        setState((current) => ({
          ...current,
          status: 'error',
          progress: current.progress || 0,
          error: nextError,
          statusText: 'AI-очистка завершилась с ошибкой'
        }));

        if (pendingAnalyzeRef.current?.jobId === message.jobId) {
          pendingAnalyzeRef.current.reject(new Error(nextError));
          pendingAnalyzeRef.current = null;
        } else if (pendingLoadRef.current) {
          pendingLoadRef.current.reject(new Error(nextError));
          pendingLoadRef.current = null;
        }
      }
    };

    workerRef.current = worker;
    return worker;
  }, [isSupported]);

  const loadEngine = useCallback(async ({ silent = false } = {}) => {
    if (!isSupported) {
      throw new Error('Браузер не поддерживает AI-очистку звука в локальном режиме.');
    }

    if (workerReadyRef.current) {
      return {
        device: state.modelDevice,
        modelId: state.modelId,
        samplingRate: state.samplingRate
      };
    }

    if (pendingLoadRef.current) {
      return pendingLoadRef.current.promise;
    }

    if (!silent) {
      setStatus('loading-model', 'Загружаем AI-модель очистки звука...', 6, { error: '' });
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
  }, [ensureWorker, isSupported, setStatus, state.modelDevice, state.modelId, state.samplingRate]);

  const analyzeSpeech = useCallback(async (monoData) => {
    const worker = ensureWorker();
    const jobId = ++nextJobIdRef.current;
    const transferable = monoData.buffer.slice(monoData.byteOffset, monoData.byteOffset + monoData.byteLength);

    return new Promise((resolve, reject) => {
      pendingAnalyzeRef.current = { jobId, resolve, reject };
      worker.postMessage({
        type: 'analyze',
        jobId,
        payload: {
          buffer: transferable
        }
      }, [transferable]);
    });
  }, [ensureWorker]);

  const cleanupAudio = useCallback(async (file) => {
    if (!isSupported) {
      const error = new Error('Браузер не поддерживает AI-очистку звука в локальном режиме.');
      setState((current) => ({
        ...current,
        status: 'error',
        error: error.message,
        statusText: error.message
      }));
      throw error;
    }

    if (!file) {
      throw new Error('Файл для AI-очистки не выбран.');
    }

    const engineMeta = await loadEngine();
    const audioContext = new AudioContextClass({
      sampleRate: engineMeta.samplingRate
    });

    try {
      setStatus('decoding', 'Декодируем аудио в память браузера...', 16, {
        error: '',
        lastCleanup: null
      });

      const encodedBuffer = await file.arrayBuffer();
      const decoded = await audioContext.decodeAudioData(encodedBuffer.slice(0));
      setStatus('resampling', 'Готовим аудио для AI-анализа...', 28);

      const monoData = await resampleToMono(decoded, engineMeta.samplingRate);
      setStatus('analyzing', 'AI анализирует голос и фон...', 42);

      const analysis = await analyzeSpeech(monoData);
      setStatus(
        'denoising',
        analysis.speechCoverage >= 0.04
          ? 'Применяем speech-aware очистку...'
          : 'Речь распознана слабо, применяем мягкую очистку...',
        68
      );

      const cleaned = await applySpeechAwareCleanup(
        decoded,
        analysis.speechSegments,
        analysis.speechCoverage
      );

      setStatus('encoding', 'Упаковываем очищенное аудио в WAV...', 90);
      const cleanedBlob = encodeWav(cleaned);
      const cleanedFileName = `${getBaseFileName(file.name)}-ai-clean.wav`;
      const cleanedFile = new File([cleanedBlob], cleanedFileName, {
        type: 'audio/wav'
      });

      const summary = {
        file: cleanedFile,
        blob: cleanedBlob,
        fileName: cleanedFileName,
        format: 'wav',
        duration: cleaned.duration,
        sampleRate: cleaned.sampleRate,
        numberOfChannels: cleaned.numberOfChannels,
        speechCoverage: analysis.speechCoverage,
        speechSegments: analysis.speechSegments,
        modelId: analysis.modelId,
        modelDevice: analysis.device,
        noiseFloor: cleaned.noiseFloor,
        noiseGateThreshold: cleaned.noiseGateThreshold
      };

      setState((current) => ({
        ...current,
        status: 'done',
        progress: 100,
        error: '',
        statusText: 'AI-очистка завершена. Чистый звук готов к конвертации.',
        modelReady: true,
        modelDevice: analysis.device || current.modelDevice,
        modelId: analysis.modelId || current.modelId,
        samplingRate: analysis.samplingRate || current.samplingRate,
        lastCleanup: summary
      }));

      return summary;
    } catch (error) {
      const nextError = String(error?.message || 'Не удалось выполнить AI-очистку звука.');
      setState((current) => ({
        ...current,
        status: 'error',
        error: nextError,
        statusText: 'AI-очистка завершилась с ошибкой'
      }));
      throw error;
    } finally {
      await audioContext.close().catch(() => {});
    }
  }, [analyzeSpeech, isSupported, loadEngine, setStatus]);

  useEffect(() => {
    return () => {
      if (pendingLoadRef.current) {
        pendingLoadRef.current.reject(new Error('AI audio worker disposed'));
        pendingLoadRef.current = null;
      }
      if (pendingAnalyzeRef.current) {
        pendingAnalyzeRef.current.reject(new Error('AI audio worker disposed'));
        pendingAnalyzeRef.current = null;
      }

      workerRef.current?.postMessage({ type: 'dispose' });
      workerRef.current = null;
      workerReadyRef.current = false;
    };
  }, []);

  return {
    ...state,
    isSupported,
    isBusy: ['loading-model', 'decoding', 'resampling', 'analyzing', 'denoising', 'encoding'].includes(state.status),
    loadEngine,
    cleanupAudio,
    reset,
    clearError
  };
}
