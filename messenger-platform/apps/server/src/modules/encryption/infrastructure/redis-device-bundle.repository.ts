import type { DeviceBundle, RegisterDeviceBundleInput } from "@messenger/shared";

import { createRedisClient, ensureRedisConnection } from "../../../core/redis";
import type { DeviceBundleRepository } from "../domain/device-bundle.entity";

const deviceKey = (deviceId: string) => `messenger:encryption:device:${deviceId}`;
const userDevicesKey = (userId: string) =>
  `messenger:encryption:user:${userId}:devices`;

export class InMemoryDeviceBundleRepository implements DeviceBundleRepository {
  private readonly bundles = new Map<string, DeviceBundle>();

  private readonly devicesByUser = new Map<string, string[]>();

  async register(userId: string, input: RegisterDeviceBundleInput) {
    const now = new Date().toISOString();
    const existing = this.bundles.get(input.deviceId);
    const bundle: DeviceBundle = {
      ...input,
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    this.bundles.set(input.deviceId, bundle);
    const devices = this.devicesByUser.get(userId) ?? [];

    if (!devices.includes(input.deviceId)) {
      devices.push(input.deviceId);
      this.devicesByUser.set(userId, devices);
    }

    return bundle;
  }

  async takePreKeyBundle(userId: string, deviceId?: string) {
    const devices = this.devicesByUser.get(userId) ?? [];
    const resolvedDeviceId = deviceId ?? devices[0];

    if (!resolvedDeviceId) {
      return null;
    }

    const bundle = this.bundles.get(resolvedDeviceId);

    if (!bundle) {
      return null;
    }

    const nextPreKey = bundle.oneTimePreKeys[0];
    const remainingPreKeys = bundle.oneTimePreKeys.slice(1);

    this.bundles.set(resolvedDeviceId, {
      ...bundle,
      oneTimePreKeys: remainingPreKeys,
      updatedAt: new Date().toISOString()
    });

    return {
      ...bundle,
      oneTimePreKeys: nextPreKey ? [nextPreKey] : []
    };
  }
}

export class RedisDeviceBundleRepository implements DeviceBundleRepository {
  private readonly redis;

  constructor(private readonly redisUrl: string) {
    this.redis = createRedisClient(
      redisUrl,
      "messenger-device-bundle-repository"
    );
  }

  async register(userId: string, input: RegisterDeviceBundleInput) {
    await ensureRedisConnection(this.redis);

    const now = new Date().toISOString();
    const existingPayload = await this.redis.get(deviceKey(input.deviceId));
    const existing = existingPayload
      ? (JSON.parse(existingPayload) as DeviceBundle)
      : null;

    const bundle: DeviceBundle = {
      ...input,
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await this.redis
      .multi()
      .set(deviceKey(input.deviceId), JSON.stringify(bundle))
      .sadd(userDevicesKey(userId), input.deviceId)
      .exec();

    return bundle;
  }

  async takePreKeyBundle(userId: string, deviceId?: string) {
    await ensureRedisConnection(this.redis);

    const resolvedDeviceId =
      deviceId ?? (await this.redis.srandmember(userDevicesKey(userId)));

    if (!resolvedDeviceId) {
      return null;
    }

    const payload = await this.redis.get(deviceKey(resolvedDeviceId));

    if (!payload) {
      return null;
    }

    const bundle = JSON.parse(payload) as DeviceBundle;
    const nextPreKey = bundle.oneTimePreKeys[0];
    const updatedBundle: DeviceBundle = {
      ...bundle,
      oneTimePreKeys: bundle.oneTimePreKeys.slice(1),
      updatedAt: new Date().toISOString()
    };

    await this.redis.set(deviceKey(resolvedDeviceId), JSON.stringify(updatedBundle));

    return {
      ...bundle,
      oneTimePreKeys: nextPreKey ? [nextPreKey] : []
    };
  }

  async close() {
    if (this.redis.status !== "end") {
      await this.redis.quit();
    }
  }
}
