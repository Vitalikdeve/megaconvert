export interface RealtimeOutboundEvent {
  channel: string;
  payload: Record<string, unknown>;
  type: string;
}

export interface RealtimePublishResult {
  accepted: boolean;
  reason: 'gateway-not-configured' | 'published';
}

export interface RealtimePublisher {
  publish(event: RealtimeOutboundEvent): Promise<RealtimePublishResult>;
}
