import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertConfirmed, AdbError } from "./lib.js";

describe("assertConfirmed", () => {
  it("throws when not confirmed", () => {
    assert.throws(() => assertConfirmed(false, "disabling Wi-Fi"), AdbError);
  });

  it("passes when confirmed", () => {
    assert.doesNotThrow(() => assertConfirmed(true, "disabling Wi-Fi"));
  });
});
