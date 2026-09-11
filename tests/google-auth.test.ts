import assert from "node:assert/strict";
import test from "node:test";
import { parseGoogleOAuthClient, parseGoogleOAuthToken } from "@/lib/calendar/google";

test("Google OAuth parsing accepts installed-app clients and profiled OpenClaw tokens", () => {
  assert.deepEqual(
    parseGoogleOAuthClient({
      installed: {
        client_id: "client-id",
        client_secret: "client-secret",
        redirect_uris: ["http://localhost"],
      },
    }),
    { clientId: "client-id", clientSecret: "client-secret", redirectUri: "http://localhost" },
  );
  assert.deepEqual(
    parseGoogleOAuthToken({
      normal: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expiry_date: 123,
        scope: "calendar",
        token_type: "Bearer",
      },
    }),
    {
      access_token: "access-token",
      refresh_token: "refresh-token",
      expiry_date: 123,
      scope: "calendar",
      token_type: "Bearer",
    },
  );
});

test("Google OAuth parsing accepts a direct token and rejects missing refresh tokens", () => {
  assert.equal(parseGoogleOAuthToken({ refresh_token: "refresh-token" }).refresh_token, "refresh-token");
  assert.throws(
    () => parseGoogleOAuthToken({ normal: { access_token: "expired" } }),
    /has no refresh token/,
  );
});
