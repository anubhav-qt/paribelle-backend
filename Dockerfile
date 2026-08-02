# syntax=docker/dockerfile:1

# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# sharp needs a toolchain when it falls back to building from source.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* .npmrc* ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* .npmrc* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Product images land here when Cloudinary isn't configured — must exist and
# be writable by the runtime user before that user is dropped into place.
RUN mkdir -p /app/public/uploads \
  && useradd --system --uid 10001 --create-home paribelle \
  && chown -R paribelle:paribelle /app/public
USER paribelle

EXPOSE 3001
CMD ["node", "dist/main"]
