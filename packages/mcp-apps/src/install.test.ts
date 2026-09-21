import test from "node:test";
import assert from "node:assert/strict";
import {
  INSTALL_SOURCE_OPTIONS,
  getInstallSourceOptions,
  buildModelSearchUrl,
} from "./install.js";
import { DEFAULT_SHOP_APPS } from "./aliases.js";

test("install source options include auto play model_search github", () => {
  const ids = INSTALL_SOURCE_OPTIONS.map((o) => o.id);
  assert.ok(ids.includes("auto"));
  assert.ok(ids.includes("play"));
  assert.ok(ids.includes("model_search"));
  assert.ok(ids.includes("github"));
  assert.ok(ids.includes("local_apk"));
  assert.ok(ids.includes("url"));
});

test("playReady false hides play source", () => {
  const ids = getInstallSourceOptions(false).map((o) => o.id);
  assert.equal(ids.includes("play"), false);
  assert.ok(ids.includes("model_search"));
  assert.ok(ids.includes("github"));
});

test("model search url encodes query", () => {
  const url = buildModelSearchUrl("whatsapp Xiaomi 23028RN4DG apk download");
  assert.ok(url.startsWith("https://duckduckgo.com/?q="));
  assert.ok(url.includes("whatsapp"));
});

test("default shop apps stay stable", () => {
  assert.equal(DEFAULT_SHOP_APPS.length, 4);
  assert.ok(DEFAULT_SHOP_APPS.some((a) => a.packageId === "com.whatsapp"));
});
