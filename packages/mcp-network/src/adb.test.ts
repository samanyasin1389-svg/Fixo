import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAdbDevices } from "./adb.js";

describe("parseAdbDevices", () => {
  it("parses authorized and unauthorized devices", () => {
    const output = `List of devices attached
emulator-5554\tdevice
ABCDEF123\tunauthorized
deadbeef\toffline
`;
    const devices = parseAdbDevices(output);
    assert.deepEqual(devices, [
      { serial: "emulator-5554", status: "device" },
      { serial: "ABCDEF123", status: "unauthorized" },
      { serial: "deadbeef", status: "offline" },
    ]);
  });

  it("returns empty list when no devices", () => {
    const output = `List of devices attached\n`;
    assert.deepEqual(parseAdbDevices(output), []);
  });
});
