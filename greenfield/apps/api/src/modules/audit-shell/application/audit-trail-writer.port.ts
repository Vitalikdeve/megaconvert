import type { AuditRecordInput } from '../domain/audit-event';

export interface AuditTrailWriter {
  write(record: AuditRecordInput): Promise<void>;
}
