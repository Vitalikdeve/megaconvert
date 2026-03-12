import {
  AutoModelForAudioFrameClassification,
  AutoProcessor,
  env
} from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/pyannote-segmentation-3.0';
const CONFIDENCE_THRESHOLD = 0.42;
const LEAD_PADDING_SECONDS = 0.12;
const TAIL_PADDING_SECONDS = 0.18;
const MIN_SEGMENT_SECONDS = 0.14;

let model = null;
let processor = null;
let engineMeta = null;
let loadingPromise = null;

env.allowLocalModels = false;
env.useBrowserCache = true;

const postMessageToMain = (payload, transfer = []) => {
  self.postMessage(payload, transfer);
};

const postStatus = (jobId, status, text, progress = null) => {
  postMessageToMain({
    type: 'status',
    jobId,
    status,
    text,
    progress
  });
};

const postLog = (jobId, message) => {
  postMessageToMain({
    type: 'log',
    jobId,
    message
  });
};

const mergeSpeechSegments = (segments, totalDuration) => {
  const prepared = (Array.isArray(segments) ? segments : [])
    .filter((segment) => Number.isFinite(segment?.start) && Number.isFinite(segment?.end))
    .map((segment) => ({
      start: Math.max(0, Number(segment.start) - LEAD_PADDING_SECONDS),
      end: Math.min(totalDuration, Number(segment.end) + TAIL_PADDING_SECONDS),
      confidence: Number(segment.confidence || 0),
      speakerId: Number(segment.id || 0)
    }))
    .filter((segment) => (
      segment.end > segment.start &&
      segment.confidence >= CONFIDENCE_THRESHOLD &&
      (segment.end - segment.start) >= MIN_SEGMENT_SECONDS
    ))
    .sort((left, right) => left.start - right.start);

  if (!prepared.length) {
    return [];
  }

  const merged = [prepared[0]];
  for (let index = 1; index < prepared.length; index += 1) {
    const current = prepared[index];
    const previous = merged[merged.length - 1];
    if (current.start <= previous.end) {
      previous.end = Math.max(previous.end, current.end);
      previous.confidence = Math.max(previous.confidence, current.confidence);
    } else {
      merged.push(current);
    }
  }

  return merged;
};

const calculateSpeechCoverage = (segments, totalDuration) => {
  if (!totalDuration || totalDuration <= 0) return 0;
  const covered = segments.reduce((sum, segment) => {
    if (!segment) return sum;
    return sum + Math.max(0, Number(segment.end || 0) - Number(segment.start || 0));
  }, 0);
  return Math.max(0, Math.min(1, covered / totalDuration));
};

const loadModelForDevice = async (device) => {
  const nextProcessor = await AutoProcessor.from_pretrained(MODEL_ID);
  const nextModel = await AutoModelForAudioFrameClassification.from_pretrained(MODEL_ID, { device });

  return {
    processor: nextProcessor,
    model: nextModel,
    device
  };
};

const ensureLoaded = async ({ jobId = null } = {}) => {
  if (engineMeta && model && processor) {
    return engineMeta;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const attempts = [];

    try {
      postStatus(jobId, 'loading-model', 'Загружаем AI-модель очистки звука...', 10);

      let loaded = null;
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        try {
          postStatus(jobId, 'loading-model', 'Подготавливаем WebGPU-ускорение...', 18);
          loaded = await loadModelForDevice('webgpu');
        } catch (error) {
          attempts.push(`webgpu: ${String(error?.message || error)}`);
          postLog(jobId, `AI worker fallback from WebGPU to WASM: ${String(error?.message || error)}`);
        }
      }

      if (!loaded) {
        postStatus(jobId, 'loading-model', 'Запускаем совместимый AI fallback...', 24);
        loaded = await loadModelForDevice('wasm');
      }

      model = loaded.model;
      processor = loaded.processor;
      engineMeta = {
        modelId: MODEL_ID,
        device: loaded.device,
        samplingRate: Number(
          processor?.feature_extractor?.config?.sampling_rate ||
          processor?.sampling_rate ||
          16000
        )
      };

      postMessageToMain({
        type: 'loaded',
        jobId,
        ...engineMeta
      });

      return engineMeta;
    } catch (error) {
      const details = attempts.length ? ` (${attempts.join(' | ')})` : '';
      throw new Error(`Не удалось инициализировать AI-модель${details}: ${String(error?.message || error)}`);
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
};

const handleAnalyze = async ({ jobId, buffer }) => {
  const meta = await ensureLoaded({ jobId });
  postStatus(jobId, 'analyzing', 'AI выделяет речевые сегменты...', 46);

  const audio = new Float32Array(buffer || new ArrayBuffer(0));
  const totalDuration = audio.length / Math.max(1, meta.samplingRate);
  const inputs = await processor(audio);
  const { logits } = await model(inputs);
  const diarization = processor.post_process_speaker_diarization(logits, audio.length)?.[0] || [];
  const speechSegments = mergeSpeechSegments(diarization, totalDuration);
  const speechCoverage = calculateSpeechCoverage(speechSegments, totalDuration);

  postMessageToMain({
    type: 'analysis-result',
    jobId,
    device: meta.device,
    samplingRate: meta.samplingRate,
    modelId: meta.modelId,
    speechCoverage,
    speechSegments
  });
};

self.onmessage = async (event) => {
  const { type, jobId, payload } = event.data || {};

  try {
    if (type === 'load') {
      await ensureLoaded({ jobId });
      return;
    }

    if (type === 'analyze') {
      await handleAnalyze({
        jobId,
        buffer: payload?.buffer
      });
      return;
    }

    if (type === 'dispose') {
      await model?.dispose?.();
      model = null;
      processor = null;
      engineMeta = null;
      self.close();
    }
  } catch (error) {
    postMessageToMain({
      type: 'error',
      jobId,
      message: String(error?.message || 'AI audio cleanup failed')
    });
  }
};
