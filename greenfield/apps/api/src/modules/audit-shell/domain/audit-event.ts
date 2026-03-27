export interface AuditActorReference {
  id: string | null;
  type: string | null;
}

export interface AuditTargetReference {
  id: string | null;
  type: string | null;
}

export interface AuditRecordInput {
  action: string;
  actor?: AuditActorReference;
  category: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
  requestId?: string | null;
  target?: AuditTargetReference;
}

export interface AuditRecordResult {
  persisted: boolean;
  reason: 'disabled' | 'persisted';
}
