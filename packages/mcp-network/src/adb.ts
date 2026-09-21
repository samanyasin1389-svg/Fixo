import { spawn } from "node:child_process";
import type { AdbDevice, DeviceStatus } from "@fixo/shared";

export class AdbError extends Error {
  constructor(
    message: string,
    readonly evidence: string[] = [],
  ) {
    super(message);
    this.name = "AdbError";
  }
}

export interface AdbRunner {
  run(args: string[], options?: { timeoutMs?: number }): Promise<{
    stdout: string;
    stderr: string;
    code: number;
  }>;
}

export function createSystemAdb(adbPath = process.env.ADB_PATH ?? "adb"): AdbRunner {
  return {
    async run(args, options = {}) {
      const timeoutMs = options.timeoutMs ?? 15_000;
      return new Promise((resolve, reject) => {
        const child = spawn(adbPath, args, {
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new AdbError(`adb timed out after ${timeoutMs}ms`, [args.join(" ")]));
        }, timeoutMs);

        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });
        child.on("error", (err) => {
          clearTimeout(timer);
          reject(
            new AdbError(
              `Failed to run adb (${adbPath}): ${err.message}. Install Android platform-tools and ensure adb is on PATH.`,
              [args.join(" ")],
            ),
          );
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve({ stdout, stderr, code: code ?? 1 });
        });
      });
    },
  };
}

export function parseAdbDevices(output: string): AdbDevice[] {
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith("List of devices"));

  const devices: AdbDevice[] = [];
  for (const line of lines) {
    const [serial, statusRaw] = line.split(/\s+/);
    if (!serial || !statusRaw) continue;
    if (serial === "*") continue;
    const status = normalizeStatus(statusRaw);
    devices.push({ serial, status });
  }
  return devices;
}

function normalizeStatus(raw: string): DeviceStatus {
  if (raw === "device" || raw === "unauthorized" || raw === "offline") return raw;
  return "unknown";
}

export async function listDevices(adb: AdbRunner): Promise<AdbDevice[]> {
  const result = await adb.run(["devices"]);
  if (result.code !== 0) {
    throw new AdbError(`adb devices failed: ${result.stderr || result.stdout}`, [
      "adb devices",
      result.stdout,
      result.stderr,
    ]);
  }
  return parseAdbDevices(result.stdout);
}

export async function resolveSerial(
  adb: AdbRunner,
  preferred?: string,
): Promise<{ serial: string; evidence: string[] }> {
  const devices = await listDevices(adb);
  const evidence = [`adb devices => ${JSON.stringify(devices)}`];
  const ready = devices.filter((d) => d.status === "device");

  if (preferred) {
    const match = devices.find((d) => d.serial === preferred);
    if (!match) {
      throw new AdbError(`Device ${preferred} not found`, evidence);
    }
    if (match.status !== "device") {
      throw new AdbError(
        `Device ${preferred} is ${match.status}. Unlock phone and allow USB debugging.`,
        evidence,
      );
    }
    return { serial: preferred, evidence };
  }

  if (ready.length === 0) {
    throw new AdbError(
      "No authorized Android device connected. Enable USB debugging and accept the RSA prompt.",
      evidence,
    );
  }
  if (ready.length > 1) {
    throw new AdbError(
      `Multiple devices connected (${ready.map((d) => d.serial).join(", ")}). Pass deviceSerial.`,
      evidence,
    );
  }
  return { serial: ready[0]!.serial, evidence };
}

export async function shell(
  adb: AdbRunner,
  serial: string,
  command: string,
  timeoutMs?: number,
): Promise<{ stdout: string; stderr: string; code: number; evidence: string }> {
  const args = ["-s", serial, "shell", command];
  const result = await adb.run(args, { timeoutMs });
  return {
    ...result,
    evidence: `adb -s ${serial} shell ${command}\nexit=${result.code}\nstdout=${result.stdout.trim()}\nstderr=${result.stderr.trim()}`,
  };
}

export async function getprop(
  adb: AdbRunner,
  serial: string,
  key: string,
): Promise<string | undefined> {
  const result = await shell(adb, serial, `getprop ${key}`);
  const value = result.stdout.trim();
  return value || undefined;
}
