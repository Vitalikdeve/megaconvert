export interface ConversionJob {
  id: string;
  userId?: string;
  inputKey: string;
  outputFormat: string;
  encryptedKey: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  createdAt: number;
}
