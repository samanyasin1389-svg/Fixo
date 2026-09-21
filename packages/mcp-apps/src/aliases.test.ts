import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePackageId } from "./aliases.js";

describe("resolvePackageId", () => {
  it("passes through package ids", () => {
    assert.equal(resolvePackageId("com.whatsapp").packageId, "com.whatsapp");
  });

  it("resolves aliases", () => {
    assert.equal(resolvePackageId("whatsapp").packageId, "com.whatsapp");
    assert.equal(resolvePackageId("تلگرام").packageId, "org.telegram.messenger");
  });
});
