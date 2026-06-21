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

## API

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

Response:

```json
{ "ok": true, "id": "…", "url": "https://…/f/…", "filename": "app.apk",
  "size": 12345, "contentType": "application/octet-stream",
  "expiresAt": "2026-01-01T00:00:00.000Z" }
```

### `GET /f/:id`

Downloads the file. Returns `410 Gone` once expired (and reaps it).

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

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | yes | Session signing secret (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | recommended | Public origin used in prompts/links (no trailing slash) |
| `STORAGE_DIR` | no | Where blobs are written (default `./data/uploads`, `/data/uploads` in Docker) |
| `MAX_UPLOAD_BYTES` | no | Hard per-upload size ceiling (default 2 GiB) |
| `CLEANUP_SECRET` | no | Shared secret guarding `POST /api/cleanup` |
