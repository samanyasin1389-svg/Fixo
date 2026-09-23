import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePasargadApiKey } from "./pasargad.js";

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
