FROM node:22-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/app/package.json apps/app/package.json
COPY apps/push-worker/package.json apps/push-worker/package.json
COPY packages/contrato/package.json packages/contrato/package.json
COPY packages/contrato/package-lock.json packages/contrato/package-lock.json

RUN npm ci --ignore-scripts --no-audit --no-fund

COPY apps/push-worker apps/push-worker

RUN npm run build --workspace @escala-ici/push-worker \
    && npm prune --omit=dev

FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/push-worker/dist ./dist
COPY --from=build /workspace/apps/push-worker/package.json ./package.json

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "dist/health.js"]

USER node

CMD ["node", "dist/index.js"]
