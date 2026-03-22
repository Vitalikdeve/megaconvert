import type { DeviceBundle, RegisterDeviceBundleInput } from "@messenger/shared";

export interface DeviceBundleRepository {
  register(userId: string, input: RegisterDeviceBundleInput): Promise<DeviceBundle>;
  takePreKeyBundle(userId: string, deviceId?: string): Promise<DeviceBundle | null>;
}
