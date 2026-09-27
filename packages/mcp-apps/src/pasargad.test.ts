import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAccountSummary,
  extractPhone,
  extractShopId,
  formatVpnUsername,
  nextNumericUsernameFrom,
  normalizeDigits,
  normalizePasargadApiKey,
  userMatchesQuery,
  type PasargadUser,
} from "./pasargad.js";

describe("normalizePasargadApiKey", () => {
  it("rewrites PB_key_ mistype to pg_key_", () => {
    assert.equal(
      normalizePasargadApiKey("PB_key_7f06d9ad-8bd0-4e54-b419-e04aa914c2dd"),
      "pg_key_7f06d9ad-8bd0-4e54-b419-e04aa914c2dd",
    );
  });

  it("keeps already-correct pg_key_", () => {
    assert.equal(
      normalizePasargadApiKey("pg_key_7f06d9ad-8bd0-4e54-b419-e04aa914c2dd"),
      "pg_key_7f06d9ad-8bd0-4e54-b419-e04aa914c2dd",
    );
  });
});

describe("nextNumericUsernameFrom", () => {
  it("starts at 1 when empty", () => {
    assert.equal(nextNumericUsernameFrom([]), "1");
  });

  it("increments max pure-numeric and paren ids", () => {
    assert.equal(
      nextNumericUsernameFrom(["1", "09121234567(3)", "user", "2"]),
      "4",
    );
  });

  it("ignores phone numbers without shop id", () => {
    assert.equal(nextNumericUsernameFrom(["09121234567", "vpn-1", "5"]), "6");
  });
});

describe("formatVpnUsername / extract", () => {
  it("formats phone with shop id", () => {
    assert.equal(formatVpnUsername("0912 123 4567", 12), "09121234567(12)");
  });

  it("formats id-only when no phone", () => {
    assert.equal(formatVpnUsername("", 7), "7");
  });

  it("extracts phone and shop id", () => {
    assert.equal(extractPhone("09121234567(12)"), "09121234567");
    assert.equal(extractShopId("09121234567(12)"), "12");
    assert.equal(extractShopId("12"), "12");
  });

  it("normalizes persian digits", () => {
    assert.equal(normalizeDigits("۰۹۱۲"), "0912");
  });
});

describe("userMatchesQuery", () => {
  it("matches by shop id in parentheses", () => {
    assert.equal(userMatchesQuery("09121234567(12)", "12"), true);
    assert.equal(userMatchesQuery("09121234567(12)", "(12)"), true);
  });

  it("matches by phone", () => {
    assert.equal(userMatchesQuery("09121234567(12)", "09121234567"), true);
  });

  it("matches legacy numeric username", () => {
    assert.equal(userMatchesQuery("12", "12"), true);
  });
});

describe("buildAccountSummary", () => {
  it("computes remaining traffic and days", () => {
    const user: PasargadUser = {
      id: 1,
      username: "09120000000(1)",
      status: "active",
      expire: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      data_limit: 10 * 1024 * 1024 * 1024,
      used_traffic: 2 * 1024 * 1024 * 1024,
      subscription_url: "/sub/abc",
    };
    const s = buildAccountSummary(user, "https://panel.example");
    assert.equal(s.totalGb, 10);
    assert.equal(s.usedGb, 2);
    assert.equal(s.remainingGb, 8);
    assert.equal(s.expired, false);
    assert.ok((s.remainingDays ?? 0) >= 2);
    assert.equal(s.shopId, "1");
    assert.match(s.subscriptionUrl, /^https:\/\/panel\.example\/sub\/abc/);
  });
});
