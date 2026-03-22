import {
  legacyCallEventNames,
  realtimeEventNames,
  type CallAnswer,
  type CallEnd,
  type CallIceCandidate,
  type CallOffer
} from "@messenger/shared";
import type { Server as SocketServer } from "socket.io";

import type { PushNotificationService } from "../../notifications/application/push-notification.service";
import type { UserPresenceService } from "../../realtime/application/user-presence.service";

export class CallSignalingService {
  constructor(
    private readonly io: SocketServer,
    private readonly presenceService: UserPresenceService,
    private readonly pushNotificationService: PushNotificationService
  ) {}

  private emitToPeer(targetUserId: string, eventName: string, payload: unknown) {
    this.io.to(`user:${targetUserId}`).emit(eventName, payload);
  }

  async forwardOffer(payload: CallOffer) {
    this.emitToPeer(payload.toUserId, realtimeEventNames.callOffer, payload);
    this.emitToPeer(payload.toUserId, legacyCallEventNames.callOffer, payload);

    if (!(await this.presenceService.isUserOnline(payload.toUserId))) {
      await this.pushNotificationService.notifyUsers([payload.toUserId], {
        title: "Incoming call",
        body: `${payload.fromUserId} is calling you.`,
        tag: payload.callId,
        data: {
          conversationId: payload.conversationId,
          callId: payload.callId,
          media: payload.media
        }
      });
    }
  }

  forwardAnswer(payload: CallAnswer) {
    this.emitToPeer(payload.toUserId, realtimeEventNames.callAnswer, payload);
    this.emitToPeer(payload.toUserId, legacyCallEventNames.callAnswer, payload);
  }

  forwardIceCandidate(payload: CallIceCandidate) {
    this.emitToPeer(
      payload.toUserId,
      realtimeEventNames.callIceCandidate,
      payload
    );
    this.emitToPeer(payload.toUserId, legacyCallEventNames.callIceCandidate, payload);
  }

  forwardEnd(payload: CallEnd) {
    this.emitToPeer(payload.toUserId, realtimeEventNames.callEnd, payload);
  }
}
