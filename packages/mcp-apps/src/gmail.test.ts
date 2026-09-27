import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateGmailPassword, GMAIL_SIGNUP_URL } from "./gmail.js";

describe("generateGmailPassword", () => {
  it("returns expected length with mixed character classes", () => {
    const pw = generateGmailPassword(14);
    assert.equal(pw.length, 14);
    assert.match(pw, /[A-Z]/);
    assert.match(pw, /[a-z]/);
    assert.match(pw, /[0-9]/);
    assert.match(pw, /[!@#$%]/);
  });

  it("produces varying passwords", () => {
    const a = generateGmailPassword();
    const b = generateGmailPassword();
    // Extremely unlikely to collide
    assert.notEqual(a, b);
  });
});

describe("GMAIL_SIGNUP_URL", () => {
  it("points at Google signup", () => {
    assert.match(GMAIL_SIGNUP_URL, /^https:\/\/accounts\.google\.com\/signup/);
  });
});
