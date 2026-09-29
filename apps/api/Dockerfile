# TripVault API — production image.
# Build context is the repository root:  docker build -f apps/api/Dockerfile .
#
# Stage 1: install all workspace deps and compile @tripvault/shared + @tripvault/api.
# Stage 2: minimal runtime image with production deps only.

FROM node:20-slim AS build
WORKDIR /app

# Copy workspace manifests first for better layer caching.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci

# Copy sources and build (shared must build before api).
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @tripvault/shared \
 && npm run build --workspace @tripvault/api

# ---- Runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev && npm cache clean --force

# Compiled output. node_modules/@tripvault/* are symlinks into these dirs.
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist

# Writable directory for STORAGE_PROVIDER=local (mount a volume in prod).
RUN mkdir -p /app/storage
VOLUME /app/storage

EXPOSE 4000
# Platforms like Railway/Render inject PORT; config.ts honors it.
CMD ["node", "apps/api/dist/index.js"]
