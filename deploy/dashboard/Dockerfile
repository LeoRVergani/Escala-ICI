FROM node:22-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/app/package.json apps/app/package.json
COPY packages/contrato/package.json packages/contrato/package.json
COPY packages/contrato/package-lock.json packages/contrato/package-lock.json

RUN npm install -g npm@10.9.2 --no-audit --no-fund && npm ci --ignore-scripts --no-audit --no-fund

COPY . .

ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_AUTH_DOMAIN=""
ARG VITE_FIREBASE_PROJECT_ID=""
ARG VITE_FIREBASE_APP_ID=""
ARG VITE_FIREBASE_ENVIRONMENT=""
ARG VITE_MICROSOFT_ENTRA_TENANT_ID=""
ARG VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE="false"
ARG VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO="false"
ARG VITE_ESCALA_STAGING_PERMISSAO_AMPLA="false"
ARG VITE_FIREBASE_USE_EMULATORS="false"
ARG VITE_FIREBASE_LAN_MODE="false"
ARG VITE_FIREBASE_LAN_HOST=""
ARG VITE_FIREBASE_AUTH_EMULATOR_URL="http://127.0.0.1:9099"
ARG VITE_FIREBASE_FIRESTORE_EMULATOR_HOST="127.0.0.1"
ARG VITE_FIREBASE_FIRESTORE_EMULATOR_PORT="8080"
ARG VITE_DASHBOARD_URL="http://localhost:4173"
ARG VITE_EMPLOYEE_APP_URL="http://localhost:4174"
ARG FIREBASE_STAGING_CONFIRMATION=""

ENV VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY} \
    VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN} \
    VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID} \
    VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID} \
    VITE_FIREBASE_ENVIRONMENT=${VITE_FIREBASE_ENVIRONMENT} \
    VITE_MICROSOFT_ENTRA_TENANT_ID=${VITE_MICROSOFT_ENTRA_TENANT_ID} \
    VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=${VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE} \
    VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO=${VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO} \
    VITE_ESCALA_STAGING_PERMISSAO_AMPLA=${VITE_ESCALA_STAGING_PERMISSAO_AMPLA} \
    VITE_FIREBASE_USE_EMULATORS=${VITE_FIREBASE_USE_EMULATORS} \
    VITE_FIREBASE_LAN_MODE=${VITE_FIREBASE_LAN_MODE} \
    VITE_FIREBASE_LAN_HOST=${VITE_FIREBASE_LAN_HOST} \
    VITE_FIREBASE_AUTH_EMULATOR_URL=${VITE_FIREBASE_AUTH_EMULATOR_URL} \
    VITE_FIREBASE_FIRESTORE_EMULATOR_HOST=${VITE_FIREBASE_FIRESTORE_EMULATOR_HOST} \
    VITE_FIREBASE_FIRESTORE_EMULATOR_PORT=${VITE_FIREBASE_FIRESTORE_EMULATOR_PORT} \
    VITE_DASHBOARD_URL=${VITE_DASHBOARD_URL} \
    VITE_EMPLOYEE_APP_URL=${VITE_EMPLOYEE_APP_URL} \
    FIREBASE_STAGING_CONFIRMATION=${FIREBASE_STAGING_CONFIRMATION}

RUN if [ "$VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE" = "true" ]; then \
      npm run preflight:firebase -- --target=staging --require-write; \
    fi && npm run build:dashboard

RUN rm -f \
    dist/apps/dashboard/_headers \
    dist/apps/dashboard/_redirects \
    dist/apps/dashboard/manifest.webmanifest \
    dist/apps/dashboard/manifest-app.webmanifest \
    dist/apps/dashboard/service-worker.js \
    dist/apps/dashboard/icons/apple-touch-icon.png \
    dist/apps/dashboard/icons/icon-192.png \
    dist/apps/dashboard/icons/icon-512.png \
    dist/apps/dashboard/icons/icon-maskable-192.png \
    dist/apps/dashboard/icons/icon-maskable-512.png

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

COPY deploy/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/apps/dashboard /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

USER 101
