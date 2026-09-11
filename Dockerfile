FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build:vps

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/bobar.sqlite
RUN mkdir -p /app/data /app/uploads && chown node:node /app/data /app/uploads
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/deployment/image-optimizer.mjs ./deployment/image-optimizer.mjs
COPY --from=builder --chown=node:node /app/scripts/optimize-existing-images.mjs ./scripts/optimize-existing-images.mjs
USER node
EXPOSE 3000
CMD ["node", "server.js"]
