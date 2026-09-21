import test from "node:test";
import assert from "node:assert/strict";
import { INSTALL_SOURCE_OPTIONS } from "./install.js";
import { DEFAULT_SHOP_APPS } from "./aliases.js";

test("install source options include auto and manual picks", () => {
  const ids = INSTALL_SOURCE_OPTIONS.map((o) => o.id);
  assert.deepEqual(ids, ["auto", "play", "local_apk", "github"]);
});

test("default shop apps stay stable", () => {
  assert.equal(DEFAULT_SHOP_APPS.length, 4);
  assert.ok(DEFAULT_SHOP_APPS.some((a) => a.packageId === "com.whatsapp"));
});
