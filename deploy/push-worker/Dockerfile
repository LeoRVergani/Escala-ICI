# PUSH-WORKER-LEVE-1 — imagem enxuta do push-worker.
#
# Antes: `npm ci` do projeto INTEIRO (React, Vite, Firebase do navegador, planilhas… do App e do Dashboard) + `npm prune`, e o
# estágio final copiava ~800 MB de node_modules para um worker que só usa o `firebase-admin`. O `npm prune` do npm refaz a
# árvore de TODOS os workspaces e reinstala o que acabou de tirar — por isso o "exporting layers" levava de 6 a 13 minutos.
# Agora: (1) compila instalando SÓ o workspace do worker; (2) instala SÓ as dependências de produção do worker (~80 MB);
# (3) a imagem final leva apenas isso + o `dist`. Sem `npm prune`.
#
# Os package.json dos outros workspaces continuam sendo copiados porque o `npm ci` confere o package-lock contra todos.

FROM node:22-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/app/package.json apps/app/package.json
COPY apps/push-worker/package.json apps/push-worker/package.json
COPY packages/contrato/package.json packages/contrato/package.json
COPY packages/contrato/package-lock.json packages/contrato/package-lock.json

# Só o workspace do worker (inclui o TypeScript, para compilar) — não o projeto inteiro.
RUN npm ci --ignore-scripts --no-audit --no-fund --workspace @escala-ici/push-worker

COPY apps/push-worker apps/push-worker

RUN npm run build --workspace @escala-ici/push-worker

FROM node:22-alpine AS deps-prod

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/app/package.json apps/app/package.json
COPY apps/push-worker/package.json apps/push-worker/package.json
COPY packages/contrato/package.json packages/contrato/package.json
COPY packages/contrato/package-lock.json packages/contrato/package-lock.json

# Só as dependências de PRODUÇÃO do worker (firebase-admin e o que ele puxa). O elo do workspace aponta para uma pasta que
# não existe na imagem final, então sai.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund --workspace @escala-ici/push-worker \
    && rm -rf node_modules/@escala-ici

FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=deps-prod /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/push-worker/dist ./dist
COPY --from=build /workspace/apps/push-worker/package.json ./package.json

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "dist/health.js"]

USER node

CMD ["node", "dist/index.js"]
