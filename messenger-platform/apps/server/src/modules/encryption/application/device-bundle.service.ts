import type { RegisterDeviceBundleInput } from "@messenger/shared";

import type { DeviceBundleRepository } from "../domain/device-bundle.entity";

export class DeviceBundleService {
  constructor(private readonly repository: DeviceBundleRepository) {}

  register(userId: string, input: RegisterDeviceBundleInput) {
    return this.repository.register(userId, input);
  }

  takePreKeyBundle(userId: string, deviceId?: string) {
    return this.repository.takePreKeyBundle(userId, deviceId);
  }
}
