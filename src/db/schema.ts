import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* better-auth core tables                                            */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

/* ------------------------------------------------------------------ */
/* application tables                                                 */
/* ------------------------------------------------------------------ */

/**
 * An upload key is a credential a user hands to an AI agent. By default it is
 * single-use: once an upload succeeds the key is burned. The key also carries
 * the retention window applied to whatever file is uploaded with it.
 */
export const uploadKey = pgTable("upload_key", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // human label so the user can tell keys apart in the dashboard
  label: text("label").notNull(),
  // sha-256 hex of the raw token; the raw token is shown to the user exactly once
  tokenHash: text("token_hash").notNull().unique(),
  // last 6 chars of the raw token, for display ("…a1b2c3")
  tokenHint: text("token_hint").notNull(),
  // how long an uploaded file lives, in seconds (e.g. 86400 = 24h)
  retentionSeconds: integer("retention_seconds").notNull(),
  // how many successful uploads this key permits (1 = single use)
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  // optional cap on the size of a single uploaded file, in bytes
  maxFileBytes: bigint("max_file_bytes", { mode: "number" }),
  // folder/tag applied to uploads from this key (agents may override per upload)
  defaultFolder: text("default_folder"),
  // comma-separated allowlist of extensions/MIME patterns (e.g. ".apk,application/zip")
  allowedTypes: text("allowed_types"),
  // cap on how many times each uploaded file can be downloaded (null = unlimited)
  maxDownloads: integer("max_downloads"),
  // sha-256 of a download password; when set, downloads require the password
  downloadPasswordHash: text("download_password_hash"),
  // optional URL POSTed with upload metadata on each successful upload
  webhookUrl: text("webhook_url"),
  revoked: boolean("revoked").notNull().default(false),
  // when the key itself stops being accepted (independent of file retention)
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * A file uploaded through a key. The blob lives on disk under STORAGE_DIR; this
 * row is the metadata and drives expiry.
 */
export const upload = pgTable("upload", {
  id: text("id").primaryKey(),
  keyId: text("key_id")
    .notNull()
    .references(() => uploadKey.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  // path on disk relative to STORAGE_DIR
  storageKey: text("storage_key").notNull(),
  // folder/tag for organising uploads (resolved from key/agent at upload time)
  folder: text("folder"),
  downloadCount: integer("download_count").notNull().default(0),
  // cap copied from the key at upload time; the file is reaped once reached
  maxDownloads: integer("max_downloads"),
  // download password hash copied from the key at upload time
  passwordHash: text("password_hash"),
  lastDownloadAt: timestamp("last_download_at"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

/**
 * One row per successful download, for usage analytics (downloads over time).
 */
export const downloadEvent = pgTable("download_event", {
  id: text("id").primaryKey(),
  uploadId: text("upload_id")
    .notNull()
    .references(() => upload.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  keyId: text("key_id"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export type UploadKey = typeof uploadKey.$inferSelect;
export type Upload = typeof upload.$inferSelect;
export type DownloadEvent = typeof downloadEvent.$inferSelect;
