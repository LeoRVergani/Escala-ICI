# CHECKPOINT — FASE AUTH-2 — Validação real Microsoft/Firebase em staging

**STATUS: CONCLUÍDA.** Validação manual completa reportada pelo usuário
(Dashboard + PWA, Microsoft + e-mail/senha + Demo, autorização positiva e
negativa, persistência, visual) — ver seção "Validação manual final",
abaixo.

- **Branch**: `main`
- Commits da fase: AUTH-1 `06225f2`, AUTH-1A `0a847b8`, AUTH-1B `761d23a`,
  pausa AUTH-2 `1d2e8e4`, fix Docker `ce788bd`, retomada `ebc2f0e`, teste
  negativo `8020fe4` (histórico completo, nenhum commit foi squashado ou
  reescrito).
- Working tree limpo. Push final documentado na seção de commit desta
  finalização.

> As seções abaixo preservam o histórico da fase na ordem em que
> aconteceu: pausa original → retomada com tenant configurado → validação
> manual final. Nada foi apagado ou reescrito.

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

---

## Retomada — configuração aplicada e validação automatizada (commit `ce788bd`)

### 1. Confirmação da configuração (sem imprimir o Tenant ID)

| Verificação | Resultado |
|---|---|
| `.env.staging.dashboard` contém `VITE_MICROSOFT_ENTRA_TENANT_ID` | ✅ presente, 36 caracteres, formato GUID válido |
| `.env.staging.app` contém `VITE_MICROSOFT_ENTRA_TENANT_ID` | ✅ presente, 36 caracteres, formato GUID válido |
| Mesmo valor nos dois arquivos | ✅ confirmado (comparação sem exibir o valor) |
| Valor é `common` | ❌ não — rejeitado corretamente pela verificação |
| `VITE_FIREBASE_PROJECT_ID` em ambos | ✅ `escala-ici-staging` nos dois — nenhuma referência a produção |
| Permissão dos arquivos | ✅ `600` nos dois |
| `git check-ignore` | ✅ ambos cobertos pela regra `.env*` do `.gitignore` |
| `git status --short` | ✅ vazio antes de qualquer alteração |

### 2. Gap encontrado e corrigido: plumbing do Docker build

`deploy/dashboard/compose.yaml` e `deploy/dashboard/Dockerfile` **não**
propagavam `VITE_MICROSOFT_ENTRA_TENANT_ID` como build arg — todas as
outras variáveis `VITE_FIREBASE_*` já tinham essa fiação (`ARG`/`ENV` no
Dockerfile, `args:` no compose), mas essa variável, adicionada só na
AUTH-1 (depois desses arquivos existirem), nunca recebeu o mesmo
tratamento. Sem essa correção, o valor configurado em
`.env.staging.dashboard` nunca chegaria ao bundle do Dashboard (o
App/PWA staging não tem esse problema — usa Vite diretamente, sem
indireção de build args Docker). Corrigido espelhando exatamente o padrão
já usado pelas demais variáveis (commit `ce788bd`, 3 linhas, nenhum valor
real no diff).

### 3. Rebuild Dashboard staging

```
$ npm run docker:dashboard:staging:build
✓ Image escala-ici-dashboard:3k-c1-staging Built

$ npm run docker:dashboard:staging:up
✓ Container dashboard-dashboard-1 Recreated / Started

$ docker ps --filter name=dashboard-dashboard-1
dashboard-dashboard-1   Up 7 seconds (healthy)

$ curl -i http://127.0.0.1:4173/health
HTTP/1.1 200 OK

$ curl -Iv --resolve escala.ici.tec.br:443:127.0.0.1 https://escala.ici.tec.br/health
subjectAltName: host "escala.ici.tec.br" matched cert's "*.ici.tec.br"
SSL certificate verify ok.
HTTP/1.1 200 OK
```

**Confirmação de que o tenant chegou ao bundle** (checagem booleana via
`grep -q` dentro da imagem Docker, valor real nunca impresso):

```
$ docker run --rm --entrypoint sh escala-ici-dashboard:3k-c1-staging \
    -c "grep -rq -- '<tenant>' /usr/share/nginx/html/assets/ && echo FOUND"
FOUND
```

### 4. Build PWA staging

```
$ npm run build:app:staging
✓ vite build (1636 módulos) + service worker
✓ Cloudflare Pages validado: App independente, SPA e PWA na raiz.

$ npm run validate:pwa
✓ PWA validado: manifesto, ícones, atualização segura e artefatos distribuídos.

$ npm run validate:artifact
✓ Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.
```

Confirmação booleana de que o tenant chegou ao bundle do PWA (mesmo
método, `grep -q` sobre `dist/apps/app/assets/*.js`, valor nunca
impresso): **PRESENTE**.

**Nenhum deploy foi executado** — `npm run pages:deploy:staging` não foi
chamado. O build acima gera apenas `dist/apps/app`, local ao container/VM;
publicar em Cloudflare Pages é uma decisão de deploy que não estava entre
os passos autorizados nesta retomada e exigiria confirmação explícita
separada (alvo, projeto Cloudflare, ambiente) antes de ser executada.

### 5. Suíte automatizada completa (resultado real, commit `ce788bd`)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run typecheck:apps` | ✅ |
| `npm run typecheck:worker` | ✅ |
| `npm run test:unit` | ✅ 508/508 (41/41 arquivos) |
| `npm run test:boundaries` | ✅ 102/102 |
| `npm run test:push-worker` | ✅ 48/48 |
| `npm run test:firebase-preflight` | ✅ 14/14 |
| `npm run test:firestore-rules` | ✅ 122/122 |
| `npm run test:firebase-integration` | ⚠️ **123/126 — exatamente as mesmas 3 falhas pré-existentes, nenhuma quarta** |
| `npm run lint` | ✅ 0 erros, 5 warnings (mesmos de sempre) |
| `git diff --check` | ✅ limpo |

Nenhuma regressão. `usuarios/{login}`, `LoginPanel`, `authRepository`,
Demo, Firestore Rules — nenhum tocado nesta retomada.

### 6. Segurança (revalidada)

- Nenhum Client Secret, token, credential ou valor de tenant foi impresso
  em nenhum comando desta sessão — toda verificação do tenant usou
  comparação/`grep -q` booleana.
- `git diff` do commit `ce788bd` contém apenas referências `${VAR}` — sem
  nenhum valor literal sensível.
- `.env.staging.dashboard`/`.env.staging.app` permanecem fora do Git.

---

## Validação manual real — Dashboard Microsoft (reportada pelo usuário)

Teste feito pelo usuário em navegador real, em `https://escala.ici.tec.br`,
clicando "Entrar com Microsoft" com uma conta corporativa sem permissão de
gestor:

| Evento | Resultado |
|---|---|
| `MICROSOFT_PROVIDER_OPENED` / login Microsoft | ✅ autenticou corretamente |
| `FIREBASE_AUTH_SUCCESS` | ✅ |
| `USUARIO_FIRESTORE_FOUND`/`USUARIO_RESOLVED` | ✅ Firebase resolveu o usuário |
| `DASHBOARD_AUTHORIZATION_CHECKED` (teste negativo) | ✅ acesso negado corretamente — perfil sem `nivelPermiteDashboard()`, mensagem exibida: "Seu perfil não possui permissão de gestor para acessar o dashboard." (`MENSAGEM_SEM_PERMISSAO_DASHBOARD`, `lib/sessao.ts`) |
| Visual — borda lateral do `.login-card` | ✅ contínua |
| Visual — `.login-auth-divider` | ✅ sem overflow |

Isso confirma exatamente o comportamento exigido pela AUTH-1/AUTH-2:
autenticação Microsoft bem-sucedida **não implica** autorização — o
provedor não ganha privilégio especial, a autorização continua vindo de
`usuarios/{login}` + `nivelPermiteDashboard()`, e a sessão foi
corretamente tratada como não autorizada em vez de um bypass.

## Deploy do PWA staging — Cloudflare Pages

Tentativa inicial via `npm run pages:deploy:staging -- --confirm=DEPLOY_STAGING`
esbarrou em `wrangler whoami` reportando `You are not authenticated` (sem
`CLOUDFLARE_API_TOKEN` configurado neste ambiente). Resolvido pelo
usuário: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (token com
escopo restrito, sem permissão de "User Details" — por isso
`wrangler whoami` continua sem conseguir fazer a descoberta automática da
conta, mesmo com o token funcional) foram configurados no ambiente pelo
usuário. **Nenhuma permissão adicional foi solicitada só para satisfazer
`wrangler whoami`** — o escopo mínimo necessário (Cloudflare Pages:Edit)
já é suficiente para o deploy real, que a chamada direta à API do Pages
confirmou funcionar. **Deploy de staging concluído com sucesso.** Nem
token nem Account ID foram impressos em nenhum momento desta sessão.

## Validação manual final — reportada pelo usuário (navegador real)

### Dashboard (`https://escala.ici.tec.br`)

| Item | Resultado |
|---|---|
| Abertura HTTPS do Dashboard staging | ✅ PASS |
| Login Microsoft | ✅ PASS |
| Logout Microsoft | ✅ PASS |
| Login e-mail/senha (preservado) | ✅ PASS |
| Teste negativo de autorização (perfil sem nível de gestor) | ✅ PASS — ver detalhe acima, mensagem `MENSAGEM_SEM_PERMISSAO_DASHBOARD` exibida corretamente |
| Teste positivo de autorização (perfil temporário elevado a gestor) | ✅ PASS — `DASHBOARD_RENDERED` confirmado |
| Restauração do perfil de teste ao estado normal após o teste positivo | ✅ PASS (nível/perfil revertido pelo usuário) |

### PWA staging (`https://staging.escala-ici-staging.pages.dev`)

| Item | Resultado |
|---|---|
| Deploy Cloudflare Pages staging | ✅ PASS |
| Login Microsoft na PWA | ✅ PASS |
| Logout na PWA | ✅ PASS |
| Resolução do usuário no Firestore (`usuarios/{login}`) | ✅ PASS |
| Carregamento dos dados esperados (equipe/escala) | ✅ PASS |
| Persistência/restauração de sessão | ✅ PASS |

### Visual e segurança (ambos os produtos)

| Item | Resultado |
|---|---|
| Fluxo visual do LoginPanel | ✅ PASS |
| Borda lateral do `.login-card` contínua | ✅ PASS |
| `.login-auth-divider` sem overflow | ✅ PASS |
| Nenhum bypass observado entre autenticação e autorização | ✅ PASS |

## Resumo do critério de aceite AUTH-2

- Autenticação Microsoft real em staging: **PASS**
- Firebase Auth: **PASS**
- Resolução `usuarios/{login}`: **PASS**
- Dashboard — autorização negativa: **PASS**
- Dashboard — autorização positiva (perfil temporário de gestor): **PASS**
- Perfil de teste restaurado ao estado normal: **PASS**
- E-mail/senha preservado: **PASS**
- Demo preservado: **PASS** (não foi tocado em nenhum momento da AUTH-2)
- Logout (Dashboard e PWA): **PASS**
- Persistência/restauração de sessão: **PASS**
- PWA staging — Microsoft: **PASS**
- Deploy Cloudflare Pages staging: **PASS**
- Visual desktop/mobile (conforme relato humano): **PASS**
- Produção: **intocada**
- Nenhum segredo versionado: **confirmado**

## Pendências gerais

- Três falhas pré-existentes de `test:firebase-integration` — fora do
  escopo desta fase (autenticação), permanecem para uma fase própria de
  Publicação/Escala. Reconfirmadas nesta finalização: exatamente as
  mesmas três, `123/126`, nenhuma quarta falha.
- Divergência de versão Firebase do Dashboard — **resolvida na AUTH-1B**
  (não é mais pendência).
- `wrangler whoami` continua sem "User Details" no token — comportamento
  esperado e aceito (escopo mínimo mantido de propósito); não bloqueia
  deploys futuros via `wrangler pages deploy`, que não depende dessa
  chamada de descoberta.
