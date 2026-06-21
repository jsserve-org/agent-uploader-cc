# syntax=docker/dockerfile:1

# ---- Base ----------------------------------------------------------------
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---- Dependencies --------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Build ---------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The placeholders only let `next build` evaluate modules; they are scoped to
# this RUN (not persisted as image ENV) and never used at runtime — the real
# values are injected by the container environment.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder \
    pnpm build

# ---- Runtime -------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV STORAGE_DIR=/data/uploads
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone server output + static assets.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Migrations + the standalone-traced deps needed to run them at startup.
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --chown=nextjs:nodejs scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
VOLUME ["/data/uploads"]

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
