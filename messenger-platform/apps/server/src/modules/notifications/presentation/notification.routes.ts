import {
  registerPushSubscriptionSchema,
  removePushSubscriptionSchema
} from "@messenger/shared";
import type { FastifyInstance } from "fastify";

import type { PushNotificationService } from "../application/push-notification.service";

export const registerNotificationRoutes = (
  app: FastifyInstance,
  dependencies: {
    pushNotificationService: PushNotificationService;
  }
) => {
  app.post(
    "/v1/notifications/subscriptions",
    {
      preHandler: [app.authenticate]
    },
    async (request) => {
      const body = registerPushSubscriptionSchema.parse(request.body);
      const user = request.user as { userId: string };
      await dependencies.pushNotificationService.registerSubscription(
        user.userId,
        body.subscription
      );

      return {
        data: {
          ok: true
        }
      };
    }
  );

  app.delete(
    "/v1/notifications/subscriptions",
    {
      preHandler: [app.authenticate]
    },
    async (request) => {
      const body = removePushSubscriptionSchema.parse(request.body);
      const user = request.user as { userId: string };
      await dependencies.pushNotificationService.removeSubscription(
        user.userId,
        body.endpoint
      );

      return {
        data: {
          ok: true
        }
      };
    }
  );
};
