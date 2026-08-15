# CHECKPOINT — FASE AUTH-2 — Validação real Microsoft/Firebase em staging

- **Branch**: `main`
- **HEAD nesta pausa**: `761d23a` (`chore(firebase): padroniza SDK na versão 12.17.1` — AUTH-1B)
- Commits anteriores: AUTH-1 `06225f2`, AUTH-1A `0a847b8`.
- Working tree limpo, `ahead of origin/main by 3`, nenhum push realizado.

Esta fase é de **configuração e validação real**, não de desenvolvimento —
a implementação Microsoft já existe e está coberta por testes automatizados
(ver `CHECKPOINT-FASE-AUTH-1-LOGIN-DUPLO-FIREBASE.md`). Nada foi
reimplementado, refatorado ou redesenhado nesta fase.

## O que foi confirmado nesta sessão (sem alterar nada)

### Git
- `git branch --show-current` → `main`
- `git rev-parse HEAD` → `761d23a`
- `git status --short` → vazio
- `git status --branch --short` → `## main...origin/main [ahead 3]`
- `git diff --check` → limpo

### Variável real do tenant (confirmada no código, não suposta)

```
lib/firebase/client.ts:35: const microsoftEntraTenantId = import.meta.env.VITE_MICROSOFT_ENTRA_TENANT_ID
```

Nome exato: **`VITE_MICROSOFT_ENTRA_TENANT_ID`**. `common` (ou vazio) é
tratado como "não configurado" por `microsoftProviderConfigurado()`
(`lib/firebase/client.ts`) — o botão Microsoft fica indisponível e
e-mail/senha continua funcionando normalmente (fail gracefully).

### Firebase project (confirmado, não presumido)

```
.env.staging.dashboard: VITE_FIREBASE_PROJECT_ID=escala-ici-staging
.env.staging.app:       VITE_FIREBASE_PROJECT_ID=escala-ici-staging
```

Nenhuma referência a projeto de produção em nenhum dos dois arquivos.
`firebase projects:list` (CLI já autenticado nesta VM como
`leorverga@gmail.com`) mostra **um único projeto acessível**:
`escala-ici-staging` — nenhum projeto de produção visível a essa
credencial, o que reduz o risco de apontar por engano para produção.

### Onde cada ambiente lê suas variáveis (auditado, não presumido)

- **Dashboard staging**: `.env.staging.dashboard`, consumido pelo Docker
  Compose (`docker:dashboard:staging:build`/`:up`, ver
  `deploy/dashboard/compose.staging.yaml`). Container atual
  (`dashboard-dashboard-1`) já rodando, `Up 3h`, **healthy** — construído
  a partir do código anterior a esta fase; **precisa de rebuild** depois
  que o tenant for adicionado, para que o botão Microsoft passe a ficar
  habilitado nesse ambiente.
- **PWA/App staging**: `scripts/build-app-staging.mjs` carrega
  `.env.staging.app` diretamente (`parseEnv` + `Object.assign(process.env,
  ...)`) antes de rodar `npm run build:app:pages`. Mesmo mecanismo,
  arquivo diferente do Dashboard — **não presumir que os dois usam o
  mesmo arquivo** (auditoria pedida na seção 6 confirma que são dois
  arquivos distintos: `.env.staging.dashboard` e `.env.staging.app`).

### Infraestrutura HTTPS/Nginx (revalidada, não recriada)

```
$ nginx -t
nginx: configuration file /etc/nginx/nginx.conf test is successful

$ ss -ltnp | grep -E ':(443|8088)\b'
LISTEN 0.0.0.0:8088  (nginx)
LISTEN 0.0.0.0:443   (nginx)
LISTEN [::]:8088     (nginx)
LISTEN [::]:443      (nginx)

$ curl -Iv --resolve escala.ici.tec.br:443:127.0.0.1 https://escala.ici.tec.br/health
subjectAltName: host "escala.ici.tec.br" matched cert's "*.ici.tec.br"
SSL certificate verify ok.
HTTP/1.1 200 OK

$ docker ps --filter name=dashboard
dashboard-dashboard-1   Up 3 hours (healthy)
```

Nginx **não foi alterado** — configuração em
`/etc/nginx/conf.d/escala-ici-dashboard.conf` é a mesma já validada em
fases anteriores (certificado `*.ici.tec.br`, emitido por GlobalSign,
TLSv1.3).

### Suíte automatizada (herdada da revalidação feita na AUTH-1B, mesmo commit `761d23a`)

Nenhum arquivo de código mudou entre a AUTH-1B e este ponto da AUTH-2 —
os números abaixo são os mesmos confirmados minutos antes, sobre o mesmo
HEAD, e permanecem válidos (reexecutar teria reproduzido exatamente o
mesmo resultado):

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run typecheck:apps` | ✅ |
| `npm run typecheck:worker` | ✅ |
| `npm run test:unit` | ✅ 508/508 |
| `npm run test:boundaries` | ✅ 102/102 |
| `npm run test:push-worker` | ✅ 48/48 |
| `npm run test:firebase-preflight` | ✅ 14/14 |
| `npm run test:firestore-rules` | ✅ 122/122 |
| `npm run test:firebase-integration` | ⚠️ 123/126 (mesmas 3 falhas pré-existentes) |
| `npm run lint` | ✅ 0 erros |
| `npm run build:app` / `build:dashboard` / `build:apps` / `build:app:pages` | ✅ |
| `npm run validate:pwa` / `validate:artifact` | ✅ |
| `git diff --check` | ✅ |

## Onde a fase foi pausada — e por quê

Dois bloqueios genuínos, nenhum deles contornável sem informação/acesso
que só o usuário tem:

### 1. Tenant ID do Microsoft Entra ID — valor real indisponível neste ambiente

O repositório de referência (EscalaSOC Android) não está disponível nesta
máquina, e este ambiente não tem acesso ao Microsoft Entra Admin Center.
Por instrução explícita desta fase, **o valor não foi inventado**.

**Decisão do usuário**: ele mesmo vai editar os arquivos de ambiente.

**Onde preencher** (arquivos já existentes, gitignored, nunca commitados):

- `.env.staging.dashboard` → adicionar `VITE_MICROSOFT_ENTRA_TENANT_ID=<tenant real>`
- `.env.staging.app` → adicionar a mesma linha, mesmo valor

Não usar `common`. Não colocar Client Secret em nenhum dos dois arquivos
(o Client Secret fica exclusivamente na configuração do provider Microsoft
no Firebase Console, nunca em `.env`).

### 2. Navegador real indisponível nesta sessão

`claude-in-chrome` confirmou que a extensão não está conectada nesta
sessão — sem ela, não há como clicar no fluxo Microsoft, abrir DevTools,
nem validar visualmente breakpoints/temas.

**Decisão do usuário**: ele mesmo fará a validação manual no navegador e
reportará o resultado.

## Checklist para o usuário validar manualmente (e reportar de volta)

Depois de preencher o tenant nos dois arquivos acima:

### Configuração externa (Firebase Console / Entra) — seções 7-9 da fase
- [ ] Firebase Console → projeto `escala-ici-staging` → Authentication →
      Sign-in method → `Email/Password = Enabled`, `Microsoft = Enabled`
      (com Client ID/Client Secret preenchidos).
- [ ] Authentication → Settings → Authorized domains contém
      `escala.ici.tec.br` (Dashboard) e o hostname estável do PWA staging
      (`escala-ici-staging.pages.dev`, confirmado em `.env.staging.app` —
      ou o domínio real efetivamente usado, se diferente).
- [ ] Redirect URI mostrada pelo Firebase Console para o provider
      Microsoft está cadastrada, **exatamente igual**, na App Registration
      do Entra (não adivinhar — copiar do Console).
- [ ] App Registration é a mesma já validada pelo EscalaSOC Android
      (mesmo tenant, mesmo Client ID).

### Rebuild (seções 12-13 — só depois do tenant configurado)
- [ ] `npm run docker:dashboard:staging:build` (ou o nome real, a
      confirmar em `npm run` antes de executar)
- [ ] `npm run docker:dashboard:staging:up`
- [ ] `docker ps` → Dashboard `healthy`
- [ ] `curl -i http://127.0.0.1:4173/health` e
      `curl -Iv --resolve escala.ici.tec.br:443:127.0.0.1 https://escala.ici.tec.br/health`
- [ ] `npm run build:app:pages` (com `.env.staging.app` já contendo o
      tenant) + `npm run validate:pwa` + `npm run validate:artifact`

### Validação funcional (seções 14-19)
- [ ] Dashboard e-mail/senha (baseline antes do Microsoft): HTTPS, visual,
      login, autorização, logout.
- [ ] Dashboard Microsoft: clicar "Entrar com Microsoft", registrar
      apenas eventos (nunca senha/token/credential):
      `MICROSOFT_PROVIDER_OPENED`, `ENTRA_LOGIN_SUCCESS`,
      `FIREBASE_AUTH_SUCCESS`, `FIREBASE_EMAIL_PRESENT`,
      `LOGIN_NORMALIZED`, `USUARIO_FIRESTORE_FOUND`, `USUARIO_ACTIVE`,
      `DASHBOARD_AUTHORIZATION_CHECKED`, `DASHBOARD_RENDERED`.
- [ ] PWA e-mail/senha e Microsoft, mesma sequência.
- [ ] Persistência (marcado/desmarcado) + F5 + logout + F5 novamente.
- [ ] Cancelamento do popup Microsoft — UI recuperada, sem sessão parcial.
- [ ] Visual real (DevTools): `.login-card`/`.login-auth-divider` em
      desktop, 360/390/412px, tema claro/escuro — bordas laterais,
      radius, sem overflow horizontal.

Quando o usuário reportar os resultados dessas verificações, este
checkpoint será atualizado com os resultados reais (✅/⚠️/❌ por item,
nunca "OK" sem evidência) e a fase prossegue a partir daí.

## Segurança

- Nenhum Client Secret, token, access token, ID token ou credential foi
  solicitado, exibido ou registrado nesta sessão.
- Nenhum valor de tenant foi inventado.
- Nenhuma Firestore Rule foi tocada.
- Nenhum arquivo `.env.staging.*` real foi commitado (permanecem
  gitignored).

## Produção

Não tocada. Nenhum deploy foi executado (nem staging, nem produção).

## Pendências (no momento desta pausa)

- Tenant Microsoft real — preenchimento pelo usuário em
  `.env.staging.dashboard`/`.env.staging.app`.
- Confirmação visual/Firebase Console/Entra — validação manual pelo
  usuário.
- Rebuild do Dashboard staging e build do PWA staging — após o tenant
  estar configurado.
- `MICROSOFT_REAL_STAGING = PENDENTE`.
- Três falhas pré-existentes de `test:firebase-integration` — fora do
  escopo desta fase (autenticação), permanecem para uma fase própria de
  Publicação/Escala.
- Divergência de versão Firebase do Dashboard — **resolvida na AUTH-1B**
  (não é mais pendência).
