# syntax=docker/dockerfile:1
# Built by GitHub Actions as ghcr.io/<owner>/paribelle-backend on every push to main,
# and run on the ThinkPad (pom's infra/compose.yml). Render builds from source instead.
#   docker run ... <image>                         the API
#   docker run ... <image> node run-migrations.js  pending migrations, then exit

# ---- toolchain (sharp builds from source when no prebuilt binary fits) ----
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* .npmrc* ./

# ---- production dependencies only ----
FROM base AS deps
# NODE_ENV=production also keeps the postinstall's `npm install sharp` from adding dev deps.
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force

# ---- build ----
FROM base AS build
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY run-migrations.js ./

# Product images land in public/uploads when Cloudinary isn't configured, and
# invoice PDFs in uploads/ — both must exist and be writable by the runtime user
# before that user is dropped into place.
RUN mkdir -p /app/public/uploads /app/uploads \
  && useradd --system --uid 10001 --create-home paribelle \
  && chown -R paribelle:paribelle /app/public /app/uploads
USER paribelle

ARG RELEASE=dev
ENV RELEASE=$RELEASE
EXPOSE 3001
CMD ["node", "dist/main"]
