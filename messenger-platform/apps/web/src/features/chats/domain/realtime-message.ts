import type { StoredReaction } from "@messenger/shared";

export type RealtimeMessageDeliveryStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "failed";

export interface RealtimeMessage {
  id: string;
  clientMessageId?: string;
  conversationId: string;
  senderUserId: string;
  senderDeviceId: string;
  author: string;
  role: "incoming" | "outgoing";
  body: string;
  createdAt: string;
  timestamp: string;
  reactions: string[];
  reactionDetails: StoredReaction[];
  deliveryStatus: RealtimeMessageDeliveryStatus;
  edited: boolean;
}
