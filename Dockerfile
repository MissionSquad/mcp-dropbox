FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV SQLITE_PATH=/data/mcp-dropbox.sqlite

RUN mkdir -p /data && chown -R node:node /data /app

COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/build ./build
COPY --from=build /app/README.md ./README.md
COPY --from=build /app/LICENSE ./LICENSE

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "build/index.js"]
