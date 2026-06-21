import { createHash, randomBytes } from "node:crypto";

/** Prefix makes keys recognisable and greppable in logs/secret scanners. */
export const KEY_PREFIX = "auk_";

export function generateToken(): string {
  // 32 random bytes -> 43 url-safe chars. Plenty of entropy for a bearer key.
  return KEY_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenHint(token: string): string {
  return token.slice(-6);
}

/** Pull a bearer token out of an Authorization header or X-Upload-Key. */
export function extractToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const xkey = req.headers.get("x-upload-key");
  if (xkey) return xkey.trim();
  return null;
}
