# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /repo

# Copy root lockfiles first (better caching)
COPY package.json package-lock.json ./

# Copy workspace package.json so npm workspaces can resolve
COPY apps/llm/package.json apps/llm/package.json

# Install deps for the whole monorepo (workspace)
RUN npm ci

# Copy the rest of the repo and build only apps/llm
COPY . .
RUN npm run clean -w apps/llm && npm run build -w apps/llm

FROM node:20-alpine
WORKDIR /repo

ENV NODE_ENV=production
ENV PORT=8080

# Install ffmpeg for video generation
RUN apk add --no-cache ffmpeg

# Copy built server + deps
COPY --from=build /repo/apps/llm/dist ./apps/llm/dist
COPY --from=build /repo/apps/llm/package.json ./apps/llm/package.json
COPY --from=build /repo/node_modules ./node_modules

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -qO- http://127.0.0.1:8080/v1/health || exit 1
CMD ["node", "apps/llm/dist/index.js"]
