"use client";

import {
  createLocalPreKeyMaterial,
  createPreKeyBundle,
  type LocalPreKeyMaterial
} from "@messenger/crypto";

import { API_URL } from "@/config/api";
import { requestJson } from "@/shared/infrastructure/http-client";

const buildStorageKey = (userId: string, deviceId: string) =>
  `messenger:e2ee:device:${userId}:${deviceId}`;

interface StoredDeviceBundle {
  version: 1;
  material: LocalPreKeyMaterial;
  registeredAt?: string;
}

const readStoredBundle = (
  userId: string,
  deviceId: string
): StoredDeviceBundle | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(buildStorageKey(userId, deviceId));

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredDeviceBundle;
  } catch {
    window.localStorage.removeItem(buildStorageKey(userId, deviceId));
    return null;
  }
};

const persistStoredBundle = (
  userId: string,
  deviceId: string,
  value: StoredDeviceBundle
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    buildStorageKey(userId, deviceId),
    JSON.stringify(value)
  );
};

export const ensureRegisteredDeviceBundle = async (options: {
  userId?: string;
  deviceId?: string;
  token?: string;
}) => {
  if (!options.userId || !options.deviceId || !options.token) {
    return null;
  }

  const existing = readStoredBundle(options.userId, options.deviceId);

  if (existing?.registeredAt) {
    return existing.material;
  }

  const material =
    existing?.material ??
    (await createLocalPreKeyMaterial({
      registrationId: options.userId,
      oneTimePreKeyCount: 10
    }));
  const bundle = createPreKeyBundle(material);

  await requestJson({
    url: `${API_URL}/v1/encryption/devices/register`,
    method: "POST",
    body: {
      deviceId: options.deviceId,
      label: "Web browser",
      registrationId: bundle.registrationId,
      identitySigningPublicKey: bundle.identitySigningPublicKey,
      identityDhPublicKey: bundle.identityDhPublicKey,
      signedPreKeyId: bundle.signedPreKeyId,
      signedPreKeyPublicKey: bundle.signedPreKeyPublicKey,
      signedPreKeySignature: bundle.signedPreKeySignature,
      oneTimePreKeys: bundle.oneTimePreKeys
    },
    headers: {
      Authorization: `Bearer ${options.token}`,
      "x-device-id": options.deviceId
    }
  });

  persistStoredBundle(options.userId, options.deviceId, {
    version: 1,
    material,
    registeredAt: new Date().toISOString()
  });

  return material;
};
