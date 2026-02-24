export { runConversion } from './core/orchestrator';
export { decryptFileGcm } from './adapters/crypto';
export const PIPELINE_STAGES = ['validate', 'detect', 'normalize', 'convert', 'verify', 'deliver', 'cleanup'];
