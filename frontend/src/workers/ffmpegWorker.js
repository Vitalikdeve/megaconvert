import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

const ffmpeg = new FFmpeg();
let ffmpegReady = false;
let activeJobId = null;

const clampProgress = (value) => {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.min(100, Math.round(next)));
};

const getExtension = (name) => {
  const parts = String(name || '').trim().toLowerCase().split('.');
  if (parts.length < 2) return '';
  return parts.pop() || '';
};

const toSafeOutputName = (sourceName, ext) => {
  const cleaned = String(sourceName || 'converted-file')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.+/g, '.');
  const base = cleaned.includes('.') ? cleaned.slice(0, cleaned.lastIndexOf('.')) : cleaned;
  const normalizedBase = String(base || 'converted-file').replace(/[-_.]+$/g, '') || 'converted-file';
  return `${normalizedBase}.${ext}`;
};

const toTransferableBuffer = (fileData) => {
  const bytes = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

const ensureDir = async (dirPath) => {
  try {
    await ffmpeg.createDir(dirPath);
  } catch {
    // Directory may already exist.
  }
};

const cleanupDir = async (dirPath) => {
  if (!dirPath) return;
  try {
    const entries = await ffmpeg.listDir(dirPath);
    for (const entry of entries) {
      const name = String(entry?.name || '');
      if (!name || name === '.' || name === '..') continue;
      const childPath = `${dirPath}/${name}`;
      if (entry?.isDir) {
        await cleanupDir(childPath);
      } else {
        await ffmpeg.deleteFile(childPath).catch(() => {});
      }
    }
    await ffmpeg.deleteDir(dirPath).catch(() => {});
  } catch {
    // Ignore missing directory cleanup errors.
  }
};

const listFiles = async (dirPath) => {
  try {
    const entries = await ffmpeg.listDir(dirPath);
    return entries
      .filter((entry) => !entry?.isDir && entry?.name !== '.' && entry?.name !== '..')
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
  } catch {
    return [];
  }
};

const postMessageToMain = (payload, transfer = []) => {
  self.postMessage(payload, transfer);
};

const postStatus = (jobId, status, text) => {
  postMessageToMain({
    type: 'status',
    jobId,
    status,
    text
  });
};

ffmpeg.on('progress', ({ progress }) => {
  postMessageToMain({
    type: 'progress',
    jobId: activeJobId,
    progress: clampProgress(Number(progress || 0) * 100)
  });
});

ffmpeg.on('log', ({ message }) => {
  postMessageToMain({
    type: 'log',
    jobId: activeJobId,
    message: String(message || '')
  });
});

const ensureLoaded = async ({ jobId = null } = {}) => {
  if (ffmpegReady) return;
  postStatus(jobId, 'loading', 'Загружаем FFmpeg ядро...');
  await ffmpeg.load({
    coreURL,
    wasmURL
  });
  ffmpegReady = true;
  postMessageToMain({
    type: 'loaded',
    jobId
  });
};

const cleanupFiles = async (paths) => {
  await Promise.allSettled(
    paths.filter(Boolean).map((path) => ffmpeg.deleteFile(path))
  );
};

const resolveCommandArgs = (formatArgs, inputName, outputPath) => (
  Array.isArray(formatArgs)
    ? formatArgs.map((arg) => {
        if (arg === '{input}') return inputName;
        if (arg === '{output}') return outputPath;
        return String(arg);
      })
    : []
);

const handleConvert = async ({ jobId, file, format }) => {
  activeJobId = jobId;
  await ensureLoaded({ jobId });

  const inputExt = getExtension(file?.name) || 'bin';
  const inputName = `input-${jobId}.${inputExt}`;
  const outputPath = `output-${jobId}.${String(format?.ext || 'bin').trim()}`;
  const outputName = toSafeOutputName(file?.name, String(format?.ext || 'bin').trim());

  try {
    postStatus(jobId, 'converting', 'Локальная конвертация в процессе...');
    const buffer = await file.arrayBuffer();
    await ffmpeg.writeFile(inputName, new Uint8Array(buffer));
    await ffmpeg.exec(resolveCommandArgs(format?.args, inputName, outputPath));
    const outputData = await ffmpeg.readFile(outputPath);
    const bytes = outputData instanceof Uint8Array ? outputData : new Uint8Array(outputData);
    const transferableBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    postMessageToMain({
      type: 'result',
      jobId,
      fileName: outputName,
      mimeType: String(format?.mime || 'application/octet-stream'),
      size: bytes.byteLength,
      buffer: transferableBuffer
    }, [transferableBuffer]);
  } finally {
    activeJobId = null;
    await cleanupFiles([inputName, outputPath]);
  }
};

const handleSegment = async ({ jobId, file, segmentSeconds = 5 }) => {
  activeJobId = jobId;
  await ensureLoaded({ jobId });

  const inputExt = getExtension(file?.name) || 'mp4';
  const inputName = `grid-input-${jobId}.${inputExt}`;
  const segmentsDir = `segments-${jobId}`;
  const segmentPattern = `${segmentsDir}/chunk-%03d.${inputExt}`;

  try {
    postStatus(jobId, 'segmenting', 'Разбиваем исходный файл на сегменты...');
    const buffer = await file.arrayBuffer();
    await ensureDir(segmentsDir);
    await ffmpeg.writeFile(inputName, new Uint8Array(buffer));
    await ffmpeg.exec([
      '-i', inputName,
      '-c', 'copy',
      '-map', '0',
      '-f', 'segment',
      '-segment_time', String(Math.max(1, Number(segmentSeconds || 5))),
      '-reset_timestamps', '1',
      segmentPattern
    ]);

    const outputFiles = await listFiles(segmentsDir);
    const transfer = [];
    const segments = [];

    for (let index = 0; index < outputFiles.length; index += 1) {
      const entry = outputFiles[index];
      const segmentPath = `${segmentsDir}/${entry.name}`;
      const segmentData = await ffmpeg.readFile(segmentPath);
      const transferableBuffer = toTransferableBuffer(segmentData);
      transfer.push(transferableBuffer);
      segments.push({
        index,
        fileName: entry.name,
        size: transferableBuffer.byteLength,
        buffer: transferableBuffer
      });
    }

    postMessageToMain({
      type: 'segment-result',
      jobId,
      segmentExt: inputExt,
      segments
    }, transfer);
  } finally {
    activeJobId = null;
    await cleanupFiles([inputName]);
    await cleanupDir(segmentsDir);
  }
};

const handleConvertBuffer = async ({ jobId, buffer, fileName, format }) => {
  activeJobId = jobId;
  await ensureLoaded({ jobId });

  const inputExt = getExtension(fileName) || 'bin';
  const inputName = `grid-task-${jobId}.${inputExt}`;
  const outputExt = String(format?.ext || 'bin').trim() || 'bin';
  const outputPath = `grid-output-${jobId}.${outputExt}`;
  const outputName = toSafeOutputName(fileName, outputExt);

  try {
    postStatus(jobId, 'converting', 'Worker конвертирует сегмент...');
    await ffmpeg.writeFile(inputName, new Uint8Array(buffer));
    await ffmpeg.exec(resolveCommandArgs(format?.args, inputName, outputPath));
    const outputData = await ffmpeg.readFile(outputPath);
    const transferableBuffer = toTransferableBuffer(outputData);

    postMessageToMain({
      type: 'buffer-result',
      jobId,
      fileName: outputName,
      mimeType: String(format?.mime || 'application/octet-stream'),
      size: transferableBuffer.byteLength,
      buffer: transferableBuffer
    }, [transferableBuffer]);
  } finally {
    activeJobId = null;
    await cleanupFiles([inputName, outputPath]);
  }
};

const handleConcat = async ({ jobId, segments, outputFileName, outputExt, mimeType }) => {
  activeJobId = jobId;
  await ensureLoaded({ jobId });

  const concatDir = `concat-${jobId}`;
  const normalizedExt = String(outputExt || getExtension(outputFileName) || 'mp4').trim() || 'mp4';
  const safeOutputName = toSafeOutputName(outputFileName || 'megagrid-output', normalizedExt);
  const outputPath = `${concatDir}/${safeOutputName}`;
  const listPath = `${concatDir}/list.txt`;

  try {
    postStatus(jobId, 'merging', 'Склеиваем готовые сегменты обратно...');
    await ensureDir(concatDir);

    const manifestLines = [];
    for (let index = 0; index < (Array.isArray(segments) ? segments.length : 0); index += 1) {
      const segment = segments[index];
      const segmentExt = getExtension(segment?.fileName) || normalizedExt;
      const safeSegmentName = `part-${String(index).padStart(4, '0')}.${segmentExt}`;
      const segmentPath = `${concatDir}/${safeSegmentName}`;
      await ffmpeg.writeFile(segmentPath, new Uint8Array(segment?.buffer || new ArrayBuffer(0)));
      manifestLines.push(`file '${segmentPath}'`);
    }

    await ffmpeg.writeFile(listPath, manifestLines.join('\n'));
    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      outputPath
    ]);

    const outputData = await ffmpeg.readFile(outputPath);
    const transferableBuffer = toTransferableBuffer(outputData);

    postMessageToMain({
      type: 'concat-result',
      jobId,
      fileName: safeOutputName,
      mimeType: String(mimeType || 'application/octet-stream'),
      size: transferableBuffer.byteLength,
      buffer: transferableBuffer
    }, [transferableBuffer]);
  } finally {
    activeJobId = null;
    await cleanupDir(concatDir);
  }
};

self.onmessage = async (event) => {
  const { type, jobId, payload } = event.data || {};

  try {
    if (type === 'load') {
      await ensureLoaded({ jobId });
      return;
    }

    if (type === 'convert') {
      await handleConvert({
        jobId,
        file: payload?.file,
        format: payload?.format
      });
      return;
    }

    if (type === 'segment') {
      await handleSegment({
        jobId,
        file: payload?.file,
        segmentSeconds: payload?.segmentSeconds
      });
      return;
    }

    if (type === 'convert-buffer') {
      await handleConvertBuffer({
        jobId,
        buffer: payload?.buffer,
        fileName: payload?.fileName,
        format: payload?.format
      });
      return;
    }

    if (type === 'concat') {
      await handleConcat({
        jobId,
        segments: payload?.segments,
        outputFileName: payload?.outputFileName,
        outputExt: payload?.outputExt,
        mimeType: payload?.mimeType
      });
      return;
    }

    if (type === 'dispose') {
      ffmpeg.terminate();
      self.close();
    }
  } catch (error) {
    postMessageToMain({
      type: 'error',
      jobId,
      message: String(error?.message || 'Local conversion failed')
    });
  }
};
