export function adminCookieIsSecure(
  value = process.env.ADMIN_COOKIE_SECURE,
) {
  return value?.trim().toLowerCase() === "true";
}
