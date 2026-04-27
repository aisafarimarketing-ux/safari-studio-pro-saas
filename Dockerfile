# Cache-busting marker — bumping this string forces Railway's
# Buildkit to recompute every layer below, which clears the
# transient "failed to compute cache key" / "/prisma: not found"
# errors that appear when a partially-cached build context drifts
# out of sync. Bump again if the same symptom returns.
# build-cache-rev: 2026-04-27-pdf-service-split

FROM node:22.12-slim

WORKDIR /app

# Build-time memory ceiling. next build with reactCompiler enabled has
# OOM'd on Railway with the default 4GB Node heap on bigger commits;
# 6GB fits comfortably inside the 8GB Railway plan and stops silent
# build failures.
ENV NODE_OPTIONS="--max-old-space-size=6144"

# Install deps first (cached separately from source). postinstall runs
# `prisma generate` automatically, so the redundant explicit call later
# is dropped.
#
# npm fetch retries: Railway's "Deployment failed during the network
# process" errors are almost always one of npm's package downloads
# timing out against the public registry. Default is 2 retries with
# a 10s minimum wait — bumping to 5 retries with a 20–120s window
# absorbs a transient blip without failing the whole build.
# --prefer-offline uses the cache when a package is already there,
# --no-audit / --no-fund cut noise + a few extra HTTP calls.
COPY package*.json ./
COPY prisma ./prisma
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm ci --prefer-offline --no-audit --no-fund

# Copy source
COPY . .

# Production build. Stamps the commit SHA into the image so /api/version
# can report it even when Railway env vars aren't injected (e.g., a
# manual deploy or a fork). The arg is optional — falls back gracefully
# at runtime.
ARG RAILWAY_GIT_COMMIT_SHA
ENV RAILWAY_GIT_COMMIT_SHA=${RAILWAY_GIT_COMMIT_SHA}
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
