import { z } from "zod";

export const DeviceStatusSchema = z.enum([
  "device",
  "unauthorized",
  "offline",
  "unknown",
]);

export const AdbDeviceSchema = z.object({
  serial: z.string(),
  status: DeviceStatusSchema,
});

export const DeviceInfoSchema = z.object({
  serial: z.string(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  androidVersion: z.string().optional(),
  sdk: z.string().optional(),
});

export const NetworkStatusSchema = z.object({
  wifiEnabled: z.boolean().nullable(),
  mobileDataEnabled: z.boolean().nullable(),
  airplaneMode: z.boolean().nullable(),
  wifiConnected: z.boolean().nullable(),
  wifiSsid: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  raw: z.record(z.string()).optional(),
});

export const ToolResultSchema = z.object({
  ok: z.boolean(),
  deviceSerial: z.string().optional(),
  status: z.string(),
  message: z.string(),
  before: NetworkStatusSchema.optional(),
  after: NetworkStatusSchema.optional(),
  evidence: z.array(z.string()).default([]),
  data: z.unknown().optional(),
});

export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;
export type AdbDevice = z.infer<typeof AdbDeviceSchema>;
export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;
export type NetworkStatus = z.infer<typeof NetworkStatusSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;

export const ListDevicesInputSchema = z.object({});

export const DeviceSerialInputSchema = z.object({
  deviceSerial: z.string().optional(),
});

export const SetEnabledInputSchema = z.object({
  deviceSerial: z.string().optional(),
  enabled: z.boolean(),
  confirmed: z.boolean().default(false),
});
