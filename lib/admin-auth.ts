import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { safeStringEqual } from "@/lib/safe-compare";
import { adminCookieIsSecure } from "@/lib/security-config";

const COOKIE_NAME = "choreboard_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function signature(expiresAt: string) {
  return createHmac("sha256", sessionSecret()).update(expiresAt).digest("base64url");
}

export async function createAdminSession() {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const token = `${expiresAt}.${signature(expiresAt)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: adminCookieIsSecure(),
    maxAge: SESSION_SECONDS,
    path: "/",
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdminAuthenticated() {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return false;
    const [expiresAt, suppliedSignature, extra] = token.split(".");
    if (!expiresAt || !suppliedSignature || extra) return false;
    if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
    return safeStringEqual(suppliedSignature, signature(expiresAt));
  } catch {
    return false;
  }
}
