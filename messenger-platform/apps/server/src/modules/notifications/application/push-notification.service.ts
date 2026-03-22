import type { PushNotificationPayload, WebPushSubscription } from "@messenger/shared";
import webpush from "web-push";

import type { AppEnv } from "../../../config/env";
import type { NotificationSubscriptionRepository } from "../infrastructure/redis-notification.repository";

const isGoneResponse = (statusCode?: number) =>
  statusCode === 404 || statusCode === 410;

export class PushNotificationService {
  private readonly enabled: boolean;

  constructor(
    private readonly repository: NotificationSubscriptionRepository,
    private readonly env: AppEnv,
    private readonly isUserOnline: (userId: string) => Promise<boolean>
  ) {
    this.enabled = Boolean(env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY);

    if (this.enabled) {
      webpush.setVapidDetails(
        env.WEB_PUSH_SUBJECT,
        env.WEB_PUSH_PUBLIC_KEY as string,
        env.WEB_PUSH_PRIVATE_KEY as string
      );
    }
  }

  registerSubscription(userId: string, subscription: WebPushSubscription) {
    return this.repository.register(userId, subscription);
  }

  removeSubscription(userId: string, endpoint: string) {
    return this.repository.remove(userId, endpoint);
  }

  async notifyUsers(userIds: string[], payload: PushNotificationPayload) {
    if (!this.enabled) {
      return;
    }

    const uniqueUserIds = [...new Set(userIds)];

    for (const userId of uniqueUserIds) {
      if (await this.isUserOnline(userId)) {
        continue;
      }

      const subscriptions = await this.repository.listByUser(userId);

      await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification(subscription, JSON.stringify(payload));
          } catch (error) {
            if (
              typeof error === "object" &&
              error !== null &&
              "statusCode" in error &&
              isGoneResponse(
                typeof error.statusCode === "number" ? error.statusCode : undefined
              )
            ) {
              await this.repository.remove(userId, subscription.endpoint);
            }
          }
        })
      );
    }
  }
}
