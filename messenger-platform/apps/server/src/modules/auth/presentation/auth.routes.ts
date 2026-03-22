import {
  authCredentialsSchema,
  authSessionSchema,
  jwtClaimsSchema,
  usersQuerySchema
} from "@messenger/shared";
import type { FastifyInstance } from "fastify";

import type { AppEnv } from "../../../config/env";
import type { DistributedRateLimitService } from "../../security/application/distributed-rate-limit.service";
import type { AuthService } from "../application/auth.service";

const buildAuthPayload = (options: {
  user: Awaited<ReturnType<AuthService["register"]>>;
  accessToken: string;
  deviceId: string;
}) =>
  authSessionSchema.parse({
    user: options.user,
    userId: options.user.id,
    accessToken: options.accessToken,
    token: options.accessToken,
    deviceId: options.deviceId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

const resolveDeviceId = (request: {
  headers: Record<string, unknown>;
}) => {
  const rawHeader = request.headers["x-device-id"];
  return typeof rawHeader === "string" && rawHeader.length > 0
    ? rawHeader
    : crypto.randomUUID();
};

export const registerAuthRoutes = (
  app: FastifyInstance,
  dependencies: {
    authService: AuthService;
    env: AppEnv;
    rateLimitService: DistributedRateLimitService;
  }
) => {
  app.post("/register", async (request, reply) => {
    const body = authCredentialsSchema.parse(request.body);
    const deviceId = resolveDeviceId(request);

    const user = await dependencies.authService.register(body);
    const claims = jwtClaimsSchema.parse({
      userId: user.id,
      username: user.username,
      deviceId
    });
    const accessToken = await reply.jwtSign(claims, {
      expiresIn: dependencies.env.JWT_EXPIRES_IN
    });

    return buildAuthPayload({
      user,
      accessToken,
      deviceId
    });
  });

  app.post("/login", async (request, reply) => {
    const body = authCredentialsSchema.parse(request.body);
    const deviceId = resolveDeviceId(request);
    const rateLimitKey = `login:${request.ip}:${body.username.toLowerCase()}`;
    const rateLimit = await dependencies.rateLimitService.check(rateLimitKey, {
      limit: dependencies.env.LOGIN_RATE_LIMIT_MAX,
      windowSeconds: dependencies.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS
    });

    if (!rateLimit.allowed) {
      reply.code(429);
      return {
        error: "Too many login attempts. Please wait and try again.",
        resetAt: rateLimit.resetAt
      };
    }

    const user = await dependencies.authService.login(body);

    if (!user) {
      reply.code(401);
      return {
        error: "Invalid username or password."
      };
    }

    const claims = jwtClaimsSchema.parse({
      userId: user.id,
      username: user.username,
      deviceId
    });
    const accessToken = await reply.jwtSign(claims, {
      expiresIn: dependencies.env.JWT_EXPIRES_IN
    });

    return buildAuthPayload({
      user,
      accessToken,
      deviceId
    });
  });

  app.get(
    "/users",
    {
      preHandler: [app.authenticate]
    },
    async (request) => {
      const query = usersQuerySchema.parse(request.query);
      const user = request.user as { userId: string };
      const data = (await dependencies.authService.listUsers(query.q)).filter(
        (entry) => entry.id !== user.userId
      );

      return {
        data
      };
    }
  );
};
