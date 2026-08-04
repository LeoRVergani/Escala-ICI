# Dashboard Escala ICI em Docker

Este contêiner serve somente o Dashboard administrativo. O App do colaborador
não é copiado para a imagem.

## Teste local sem Firebase configurado

```bash
docker compose -f deploy/dashboard/compose.yaml up --build -d
docker compose -f deploy/dashboard/compose.yaml ps
```

- Dashboard: `http://localhost:4173`
- Saúde: `http://localhost:4173/health`

Sem as variáveis Firebase, use **Entrar na demonstração**. Para encerrar:

```bash
docker compose -f deploy/dashboard/compose.yaml down
```

## Homologação online — Fase 3K-B

Defina as variáveis `VITE_FIREBASE_*` e `VITE_EMPLOYEE_APP_URL` no ambiente do
build. O Firebase Web SDK usa configuração pública; credenciais administrativas,
service accounts e arquivos `.env` não entram na imagem.

```bash
cp .env.staging.dashboard.example .env.staging.dashboard
npm run firebase:staging:preflight
npm run docker:dashboard:staging:build
npm run docker:dashboard:staging:up
```

O Dashboard responde em `http://localhost:4173`. O build para antes do Vite se
o ambiente não for `staging`, se faltar a confirmação ou se o Project ID não
terminar em `-staging`, `-hml` ou `-homolog`.

```bash
npm run docker:dashboard:staging:down
```

## Laboratório pela rede interna — Fase 3K-C

O Dashboard Docker publica a porta 4173 em todas as interfaces da VM. Para
conectá-lo ao Firebase Emulator exposto por um IPv4 privado, copie o exemplo e
ajuste o endereço:

```bash
cp .env.emulator-lan.example .env.emulator-lan
docker compose --env-file .env.emulator-lan -f deploy/dashboard/compose.yaml up --build -d
```

O modo LAN só funciona quando `VITE_FIREBASE_ENVIRONMENT=local`,
`VITE_FIREBASE_LAN_MODE=true` e Auth/Firestore usam exatamente o mesmo IPv4
privado. Essa configuração não habilita escrita oficial.

O exemplo LAN define `DASHBOARD_BIND_ADDRESS=0.0.0.0` deliberadamente para o
teste pelo IPv4 privado. Com o fallback seguro de UUID da Fase 3K-C.1, importar,
editar a Grade e salvar rascunho funcionam diretamente em
`http://IP-PRIVADO:4173`, sem túnel SSH. Esse modo continua sendo laboratório:
não use contas ou planilhas reais e não exponha as portas dos emuladores fora
da rede de testes.

## Dashboard definitivo na VM interna — Fase 3K-C.1

Por padrão, o Compose agora publica o Dashboard somente em
`127.0.0.1:4173`. Coloque o proxy reverso HTTPS da VM na frente desse endereço
e exponha apenas a porta 443 para a rede corporativa.

O arquivo `Caddyfile.intranet.example` mostra a configuração para um Caddy
instalado no host e um certificado emitido pela PKI corporativa. Se o proxy
reverso já estiver em um contêiner, não inicie outro Caddy na mesma porta:
conecte o proxy e o Dashboard a uma rede Docker compartilhada e use
`dashboard:8080` como upstream.

No ambiente definitivo:

- use Firebase de homologação ou produção por HTTPS;
- mantenha `VITE_FIREBASE_USE_EMULATORS=false`;
- mantenha `VITE_FIREBASE_LAN_MODE=false`;
- não publique 4000, 4174, 8080 ou 9099;
- configure `VITE_EMPLOYEE_APP_URL` com a URL HTTPS do PWA no Cloudflare Pages.

O IP privado pode continuar sendo usado no laboratório. Para uso por pessoas,
prefira um nome DNS interno e um certificado confiável nos dispositivos.
