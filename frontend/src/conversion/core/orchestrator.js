import { createConversionContext } from './context';
import { runPipeline } from './pipeline';
import { ConversionError } from './errors';
import { LIMITS } from '../infra/limits';
import { createLogger } from '../observability/logger';
import { createMetrics } from '../observability/metrics';
import { createTracer } from '../observability/tracing';
import { runValidation } from '../validation';
import { validateMagicBytes } from '../validation/magicBytes';
import { detectFormat } from '../detection/detector';
import { normalizeFiles } from '../normalization/normalize';
import { getProcessor } from '../processors/registry';
import { createSession, generateAesKey, wrapKeyForWorker, encryptFileGcm, getCryptoSupport } from '../adapters/crypto';
import { uploadToStorage } from '../adapters/storage';
import { createJob, pollJob } from '../adapters/jobs';
import { verifyOutput } from '../verification';
import { computeChecksum } from '../verification/checksum';

const DEFAULT_STAGE_ORDER = ['validate', 'detect', 'normalize', 'convert', 'verify', 'deliver', 'cleanup'];

const buildJobPayload = ({
  toolId,
  batchMode,
  settings,
  encryption,
  uploadedItems
}) => {
  const payload = {
    tool: toolId,
    batch: batchMode ? 'true' : 'false',
    settings,
    encryption: encryption ? {
      enabled: true,
      keyWrap: encryption.wrap?.keyWrap,
      sessionId: encryption.session?.sessionId
    } : { enabled: false }
  };

  if (batchMode) {
    payload.items = uploadedItems;
  } else if (uploadedItems[0]) {
    const single = uploadedItems[0];
    payload.inputKey = single.inputKey;
    payload.originalName = single.originalName;
    payload.inputSize = single.inputSize;
    payload.inputFormat = single.inputFormat;
    payload.encryptedSize = single.encryptedSize;
    payload.encryption = { ...payload.encryption, ...single.encryption };
  }
  return payload;
};

export const runConversion = async ({
  toolId,
  files,
  batchMode,
  settings,
  apiBase,
  authHeaders,
  encryptionEnabled = true,
  stageLabels,
  hooks = {},
  limits = LIMITS,
  emitEvent
}) => {
  const processor = getProcessor(toolId);
  if (!processor) {
    throw new ConversionError('UNSUPPORTED_TOOL', `Unsupported tool: ${toolId}`);
  }
  const logger = createLogger(emitEvent);
  const metrics = createMetrics(emitEvent);
  const tracer = createTracer(emitEvent);

  const ctx = createConversionContext({
    toolId,
    files,
    batchMode,
    settings,
    apiBase,
    authHeaders,
    encryptionEnabled,
    stageLabels,
    hooks,
    limits,
    processor
  });

  const steps = [
    {
      name: 'validate',
      run: async (context) => {
        const maxPerFile = limits.maxFileBytesByCategory?.[processor.category];
        await runValidation({
          files: context.files,
          allowedExts: processor.inputs,
          maxFileBytes: { perFile: maxPerFile, batchLimits: limits }
        });
      }
    },
    {
      name: 'detect',
      run: async (context) => {
        const detected = [];
        for (const file of context.files) {
          const magic = await validateMagicBytes(file, processor.inputs);
          const fallback = magic.detected || await detectFormat(file);
          detected.push({
            format: magic.detected || fallback,
            name: file.name
          });
        }
        context.detectedFormats = detected;
      }
    },
    {
      name: 'normalize',
      run: async (context) => {
        context.normalizedFiles = normalizeFiles(context.files, limits.maxFileNameLength);
      }
    },
    {
      name: 'convert',
      run: async (context) => {
        hooks.onProgress?.(20);
        const uploadItems = [];
        const cryptoSupport = getCryptoSupport();
        const encryptionAvailable = context.encryptionEnabled && cryptoSupport.webCrypto;
        if (context.encryptionEnabled && !encryptionAvailable) {
          context.warnings.push({
            code: 'CLIENT_ENCRYPTION_DISABLED',
            message: 'Client encryption is disabled on this device because Web Crypto is unavailable.',
            details: cryptoSupport
          });
          logger?.warn('client_encryption_disabled', cryptoSupport);
        }
        let encryptionKey = null;
        let encryption = null;
        if (encryptionAvailable) {
          try {
            encryptionKey = generateAesKey();
            const session = await createSession(apiBase, authHeaders, { logger });
            const wrap = wrapKeyForWorker(encryptionKey, session.publicKey);
            encryption = { key: encryptionKey, session, wrap };
          } catch (error) {
            const code = error?.code || 'UNKNOWN';
            const isRecoverable = ['SESSION_CREATE_FAILED', 'NETWORK_ERROR', 'TIMEOUT', 'QUEUE_UNAVAILABLE'].includes(code);
            if (!isRecoverable) throw error;
            context.warnings.push({
              code: 'CLIENT_ENCRYPTION_FALLBACK',
              message: 'Client encryption session failed. Continuing without client-side encryption.',
              details: { code, reason: error?.message || String(error) }
            });
            logger?.warn('client_encryption_fallback', {
              code,
              reason: error?.message || String(error)
            });
            encryptionKey = null;
            encryption = null;
          }
        }

        for (let i = 0; i < context.normalizedFiles.length; i += 1) {
          const fileInfo = context.normalizedFiles[i];
          const originalFile = fileInfo.file;
          const checksum = await computeChecksum(originalFile, limits.checksumMaxBytes);
          const encrypted = encryptionKey ? await encryptFileGcm(originalFile, encryptionKey) : { blob: originalFile, meta: null };
          const uploaded = await uploadToStorage(apiBase, authHeaders, encrypted.blob, fileInfo.safeName, limits.uploadTimeoutMs, logger);
          const detectedFormat = context.detectedFormats?.[i]?.format;
          const extensionFormat = fileInfo.safeName.split('.').pop().toLowerCase();
          const inputFormat = detectedFormat && processor.inputs.includes(detectedFormat)
            ? detectedFormat
            : extensionFormat;
          uploadItems.push({
            inputKey: uploaded.inputKey,
            originalName: fileInfo.originalName,
            inputSize: originalFile.size,
            inputFormat,
            encryption: encrypted.meta || undefined,
            encryptedSize: encrypted.blob.size,
            checksum: checksum ? { alg: 'SHA-256', value: checksum } : undefined
          });
          const progress = 25 + Math.round(((i + 1) / context.normalizedFiles.length) * 20);
          hooks.onProgress?.(progress);
        }

        const payload = buildJobPayload({
          toolId,
          batchMode,
          settings,
          encryption,
          uploadedItems: uploadItems
        });
        const created = await createJob(apiBase, authHeaders, payload, 20_000);
        const jobId = created.jobId || created.id;
        context.job = { id: jobId, status: 'queued' };
        context.encryption = encryption;
        hooks.onJobCreated?.({ jobId, encryption });
        metrics.increment('conversion_jobs', 1, { tool: toolId });

        const finalJob = await pollJob({
          apiBase,
          authHeaders,
          jobId,
          limits,
          logger,
          onUpdate: (job) => {
            hooks.onJobUpdate?.(job);
            if (job.status === 'verifying') hooks.onStatus?.('verifying');
            if (job.status === 'running') hooks.onStatus?.('running');
            if (job.progress !== undefined && job.progress !== null) {
              const normalized = Math.min(95, Math.max(45, Number(job.progress)));
              hooks.onProgress?.(normalized);
            }
          },
          onProgress: (progress) => {
            if (progress) {
              const normalized = Math.min(95, Math.max(45, progress));
              hooks.onProgress?.(normalized);
            }
          },
          onEta: hooks.onEta
        });

        context.job = finalJob;
        context.output = {
          downloadUrl: finalJob.downloadUrl || finalJob.outputUrl || null,
          outputMeta: finalJob.outputMeta || null
        };
        if (finalJob.status === 'failed') {
          throw new ConversionError('CONVERSION_FAILED', finalJob.error?.message || 'Conversion failed.', {
            error: finalJob.error
          });
        }
        if (finalJob.status === 'expired') {
          throw new ConversionError('CONVERSION_EXPIRED', 'Job expired.');
        }
      }
    },
    {
      name: 'verify',
      run: async (context) => {
        hooks.onProgress?.(96);
        const verification = await verifyOutput({
          url: context.output?.downloadUrl,
          expectedExt: processor.output
        });
        if (!verification.ok) {
          context.warnings.push(verification);
          throw new ConversionError('VERIFY_FAILED', 'Output verification failed.', { verification });
        }
      }
    },
    {
      name: 'deliver',
      run: async (context) => {
        hooks.onProgress?.(99);
        hooks.onComplete?.({
          jobId: context.job?.id,
          downloadUrl: context.output?.downloadUrl,
          outputMeta: context.output?.outputMeta,
          warnings: context.warnings,
          encryption: context.encryption
        });
      }
    },
    {
      name: 'cleanup',
      run: async (context) => {
        hooks.onProgress?.(100);
        logger.info('cleanup', { jobId: context.job?.id });
      }
    }
  ];

  const stageOrder = DEFAULT_STAGE_ORDER.map((name) => steps.find((step) => step.name === name)).filter(Boolean);
  await runPipeline(stageOrder, ctx, logger, tracer);
  metrics.timing('conversion_duration_ms', Date.now() - ctx.startedAt, { tool: toolId });

  return {
    jobId: ctx.job?.id,
    downloadUrl: ctx.output?.downloadUrl,
    outputMeta: ctx.output?.outputMeta,
    encryption: ctx.encryption,
    warnings: ctx.warnings
  };
};
