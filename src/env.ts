/**
 * Centralised environment access. Throws early (at import time on the server)
 * when something required is missing so we fail loudly instead of at runtime.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  authSecret: required("BETTER_AUTH_SECRET"),
  // public origin used to build curl URLs and auth callbacks
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  // where uploaded blobs are written
  storageDir: process.env.STORAGE_DIR ?? "./data/uploads",
  // hard ceiling on a single upload regardless of per-key limits (bytes)
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 2 * 1024 * 1024 * 1024),
};

export type Env = typeof env;
