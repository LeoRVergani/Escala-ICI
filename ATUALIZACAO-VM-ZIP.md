# Atualização segura da VM a partir do ZIP final

Este pacote deve substituir a pasta do projeto como uma unidade. **Não extraia
por cima de `/root/projetos/Escala-ICI-main`**: isso pode conservar arquivos
antigos que já não pertencem à versão nova. O procedimento abaixo monta a nova
versão ao lado, preserva a configuração privada e mantém a versão anterior para
rollback.

## 1. Preparar a nova versão sem interromper o serviço

Substitua `Escala-ICI-final-CODB-COSI-NOC-2026-08-30.zip` pelo nome exato do
arquivo recebido, se necessário.

```bash
cd /root/projetos
mkdir -p /root/projetos/escala-ici-release-nova
unzip -q /home/lvergani/Escala-ICI-final-CODB-COSI-NOC-2026-08-30.zip \
  -d /root/projetos/escala-ici-release-nova
cd /root/projetos/escala-ici-release-nova/Escala-ICI-main

# Preserve os ambientes reais; não os receba dentro do ZIP.
cp /root/projetos/Escala-ICI-main/.env.staging.dashboard .
test ! -f /root/projetos/Escala-ICI-main/.env.staging.app || \
  cp /root/projetos/Escala-ICI-main/.env.staging.app .
test ! -f /root/projetos/Escala-ICI-main/.env.staging.push-worker || \
  cp /root/projetos/Escala-ICI-main/.env.staging.push-worker .

npm run install:ci
npm run typecheck
npm run typecheck:apps
npm run test:unit
npm run test:boundaries
npm run build:apps
npm run firebase:staging:preflight
```

Se qualquer comando falhar, pare aqui: a versão em uso ainda não foi alterada.

## 2. Trocar as pastas com rollback disponível

```bash
cd /root/projetos
mv Escala-ICI-main Escala-ICI-main.backup-20260830
mv escala-ici-release-nova/Escala-ICI-main Escala-ICI-main
cd /root/projetos/Escala-ICI-main
```

Não copie `node_modules`, `dist`, `.git`, chaves privadas ou arquivos de log da
versão anterior.

## 3. Publicar Rules/índices e o Dashboard

As Rules fazem parte desta versão e devem ser publicadas no staging com a
confirmação literal abaixo. O erro mostrado anteriormente ocorreu porque essa
confirmação não foi informada.

```bash
npm run firebase:staging:preflight
npm run firebase:staging:deploy -- --confirm=DEPLOY_STAGING

npm run docker:dashboard:staging:build
npm run docker:dashboard:staging:up
docker compose --env-file .env.staging.dashboard \
  -f deploy/dashboard/compose.yaml \
  -f deploy/dashboard/compose.staging.yaml ps
curl --fail http://127.0.0.1:4173/health
```

## 4. Auditar e reparar o Grupo COSI no staging

A chave administrativa continua fora do projeto. Primeiro rode somente a
auditoria. A aplicação é conservadora e aborta se encontrar dados em Grupo
legado que exijam decisão humana.

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/home/lvergani/ARQUIVO-staging-firebase-adminsdk.json

# Somente leitura
npm run staging:repair:cosi

# Execute apenas se o plano exibido estiver correto
npm run staging:repair:cosi -- --apply --confirm=REPARAR_PLANTAO_COSI

# Confirma o estado final sem gravar novamente
npm run staging:repair:cosi
```

O script não move nem apaga plantões, competências, participantes ou rascunhos.
Se ele abortar por dados legados, guarde a saída e não altere esses documentos
manualmente antes de revisar o caso.

## 5. Publicar o App/PWA

Isso exige as credenciais Cloudflare já usadas pela VM e o projeto existente
`escala-ici-staging`.

```bash
export CLOUDFLARE_ACCOUNT_ID=<conta>
export CLOUDFLARE_API_TOKEN=<token-com-Cloudflare-Pages-Edit>
npx wrangler pages project list
npm run build:app:staging
npm run pages:deploy:staging -- --confirm=DEPLOY_STAGING
```

Pare se `escala-ici-staging` não aparecer na lista; não crie outro projeto.

## 6. Aceite funcional mínimo

1. Entre no Dashboard NOC, importe a planilha com a duplicidade conhecida,
   salve o rascunho e publique informando uma justificativa.
2. Reabra a competência e confirme que a pendência continua registrada.
3. Publique CODB e confira que DBA, Linux, Telecom e Windows aparecem separados,
   com contagens diferentes de zero.
4. Confira no App um usuário de cada posto do CODB e um participante do COSI.
5. Teste um usuário sem permissão e confirme que ele não administra o Grupo.

## 7. Rollback do Dashboard

Se a checagem de saúde ou o aceite falhar:

```bash
cd /root/projetos
mv Escala-ICI-main Escala-ICI-main.com-problema-20260830
mv Escala-ICI-main.backup-20260830 Escala-ICI-main
cd /root/projetos/Escala-ICI-main
npm run docker:dashboard:staging:build
npm run docker:dashboard:staging:up
curl --fail http://127.0.0.1:4173/health
```

O rollback de Rules ou de dados não deve ser improvisado. Se o problema estiver
nessas camadas, interrompa novas publicações e restaure somente a partir do
backup validado do staging.
