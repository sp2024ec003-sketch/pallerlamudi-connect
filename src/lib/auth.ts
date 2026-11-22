/**
 * SECURITY TODO: Replace with Auth.js or another production identity provider.
 * This placeholder intentionally denies requests unless a server-side secret
 * is supplied. Never expose ADMIN_API_SECRET to the browser.
 */
export function requireAdmin(request: Request) {
  const expected = process.env.ADMIN_API_SECRET;
  const supplied = request.headers.get("x-admin-secret");
  if (!expected || !supplied || supplied !== expected) {
    throw new Error("Unauthorized");
  }
}
