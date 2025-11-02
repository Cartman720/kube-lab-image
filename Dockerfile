FROM oven/bun:latest AS base

WORKDIR /app

# Only copy package manifests first for better layer caching
COPY package.json bun.lock tsconfig.json bun.config.ts ./

RUN bun install --ci

# Now copy source
COPY src ./src
COPY public ./public

ENV PORT=8080
EXPOSE 8080

# Healthcheck is optional; leaving to Kubernetes probes
CMD ["bun", "run", "start"]


