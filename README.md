# agent-uploader

Mint single-use upload keys for AI agents. Each key comes with a ready-to-paste
prompt embedding the key and an exact `curl` command. An agent uploads a file
(an APK, a build artifact, anything) to your endpoint, gets back a share link,
and the file self-destructs after a retention window you choose (24h by default).

- **Next.js 16** (App Router, standalone output)
- **Tailwind CSS v4** + **shadcn/ui** (Base UI)
- **better-auth** for email/password auth
- **Drizzle ORM** over **PostgreSQL** (Drizzle is also the migrator)
- **Docker** image published to **GHCR** via a **GitHub Action** built on **Blacksmith**, on tag

## How it works

1. Sign up and create an **upload key**. Choose how long uploaded files live and
   how many uploads the key allows (single use by default).
2. Copy the generated **agent prompt** — it contains the raw key (shown once) and
   the `curl` command pointing at `POST /api/upload`.
3. Hand the prompt to your agent. It uploads with `Authorization: Bearer <key>`.
4. The response includes a `url`. The file is reachable there until it expires,
   then it's deleted.

Keys are stored only as SHA-256 hashes — the raw token is shown exactly once.

## Per-key controls

When you create a key you can attach policies that apply to everything uploaded
with it:

- **Retention** — files self-destruct after the chosen window (24h default).
- **Use limit** — single-use by default, or up to N uploads.
- **Folder / tag** — group uploads (agents can override per upload via
  `X-Folder` header or a `folder` form field). The dashboard filters by folder.
- **File-type allowlist** — restrict to extensions / MIME patterns
  (e.g. `.apk, application/zip`); other types are rejected with `415`.
- **Download cap** — delete each file after N downloads.
- **Download password** — share links require a password (`?pw=` or a form).
- **Upload webhook** — POST file metadata to a URL on every successful upload.
- **Rate limiting** — the upload endpoint is throttled per IP and per key.

The dashboard also shows **usage analytics** (files held, total downloads,
downloads in the last 7 days, storage used) and lets you **delete** any upload.

## App Store (Agent Downloader)

`/store` is a mobile-first store for your uploaded APKs:

- Uploaded `.apk` files are parsed for **package name, version, and icon**, so the
  store shows real app cards (builds of the same package are grouped, newest
  featured, older builds one tap away).
- Tapping **Install** downloads the APK served with the
  `application/vnd.android.package-archive` MIME type, so Android offers to
  install it directly (allow installs from your browser if prompted).
- A **QR code** opens the store on your phone — scan, log in, install.
- A search box filters by app name, package, or filename.

Log in on your phone, open `/store`, and install — no cable, no `adb`.

## API

> All uploads are rate-limited per IP and per key (`429` with `Retry-After`).

### `POST /api/upload`

Authenticate with the key as a bearer token (or `X-Upload-Key` header).

```bash
# multipart (recommended)
curl -X POST "$APP_URL/api/upload" \
  -H "Authorization: Bearer auk_xxx" \
  -F "file=@./app.apk"

# raw body
curl -X POST "$APP_URL/api/upload" \
  -H "Authorization: Bearer auk_xxx" \
  -H "X-Filename: app.apk" \
  --data-binary @./app.apk
```

Optionally set `-H "X-Folder: releases/android"` (or a `folder` form field) to
place the upload in a folder.

Response:

```json
{ "ok": true, "id": "…", "url": "https://…/f/…", "filename": "app.apk",
  "size": 12345, "contentType": "application/octet-stream",
  "folder": "releases/android", "expiresAt": "2026-01-01T00:00:00.000Z" }
```

### `GET /f/:id`

Downloads the file. Returns `410 Gone` once expired (and reaps it). If the key
set a download password, supply it as `?pw=…`, an `X-Download-Password` header,
or a bearer token; browsers get a small password form. If a download cap was set,
the file is deleted once the cap is reached.

### `DELETE /api/uploads/:id`

Deletes an upload you own (session-authenticated). Used by the dashboard.

### `POST /api/cleanup`

Reaps every expired upload. Guard it with `CLEANUP_SECRET` (sent as
`X-Cleanup-Secret` or a bearer token) and call it from cron.

## Local development

```bash
pnpm install
cp .env.example .env            # fill in DATABASE_URL + BETTER_AUTH_SECRET

# start Postgres (or use your own and point DATABASE_URL at it)
docker compose -f docker-compose.dev.yml up -d db

pnpm db:migrate                 # apply migrations
pnpm dev
```

Generate a new migration after editing `src/db/schema.ts`:

```bash
pnpm db:generate
```

## Run the whole stack in Docker

```bash
# build + run app and Postgres locally
docker compose -f docker-compose.dev.yml up --build

# or run the published image (set BETTER_AUTH_SECRET first)
BETTER_AUTH_SECRET=$(openssl rand -base64 32) docker compose up -d
```

The container runs pending migrations on startup, then serves on port 3000.
Uploaded blobs live on the `uploads` volume at `/data/uploads`.

## Releasing

Push a semver tag and the GitHub Action builds the image on a Blacksmith runner
and pushes it to `ghcr.io/jsserve-org/agent-uploader-cc`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Tags published: `vX.Y.Z` → `X.Y.Z`, `X.Y`, `X`, and `latest`.

### Make the GHCR package public (one-time)

New org container packages are **private** by default, and GitHub has no API to
change package visibility — it's a one-time web-UI step:

1. Open
   `https://github.com/orgs/jsserve-org/packages/container/agent-uploader-cc/settings`
2. Under **Danger Zone → Change visibility**, choose **Public** and confirm.
3. (Optional) Under **Repository source**, link the package to this repo so it
   shows on the repo page.

Verify it's anonymously pullable:

```bash
docker manifest inspect ghcr.io/jsserve-org/agent-uploader-cc:v0.1.0
```

Visibility sticks across future tag pushes, so this is only needed once.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | yes | Session signing secret (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | recommended | Public origin used in prompts/links (no trailing slash) |
| `STORAGE_DIR` | no | Where blobs are written (default `./data/uploads`, `/data/uploads` in Docker) |
| `MAX_UPLOAD_BYTES` | no | Hard per-upload size ceiling (default 2 GiB) |
| `CLEANUP_SECRET` | no | Shared secret guarding `POST /api/cleanup` |
| `UPLOAD_RATE_LIMIT` | no | Max upload requests per window, per IP and per key (default 30) |
| `UPLOAD_RATE_WINDOW_MS` | no | Rate-limit window in ms (default 60000) |
