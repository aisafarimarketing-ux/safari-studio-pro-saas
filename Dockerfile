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
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

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
