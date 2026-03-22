import {
  deviceBundleQuerySchema,
  registerDeviceBundleSchema
} from "@messenger/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { DeviceBundleService } from "../application/device-bundle.service";

const userParamsSchema = z.object({
  userId: z.string().min(1)
});

export const registerEncryptionRoutes = (
  app: FastifyInstance,
  dependencies: {
    deviceBundleService: DeviceBundleService;
  }
) => {
  app.post(
    "/v1/encryption/devices/register",
    {
      preHandler: [app.authenticate]
    },
    async (request) => {
      const body = registerDeviceBundleSchema.parse(request.body);
      const user = request.user as { userId: string };
      const data = await dependencies.deviceBundleService.register(
        user.userId,
        body
      );

      return {
        data
      };
    }
  );

  app.get(
    "/v1/encryption/users/:userId/pre-key-bundle",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const params = userParamsSchema.parse(request.params);
      const query = deviceBundleQuerySchema.parse(request.query);
      const data = await dependencies.deviceBundleService.takePreKeyBundle(
        params.userId,
        query.deviceId
      );

      if (!data) {
        reply.code(404);
        return {
          error: "device_bundle_not_found"
        };
      }

      return {
        data
      };
    }
  );
};
