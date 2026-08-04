import assert from "node:assert/strict";
import test from "node:test";
import { adminCookieIsSecure } from "@/lib/security-config";

test("admin cookies default to LAN-compatible HTTP behavior", () => {
  assert.equal(adminCookieIsSecure(undefined), false);
  assert.equal(adminCookieIsSecure("false"), false);
});

test("admin cookies become secure only when explicitly enabled", () => {
  assert.equal(adminCookieIsSecure("true"), true);
  assert.equal(adminCookieIsSecure(" TRUE "), true);
});
