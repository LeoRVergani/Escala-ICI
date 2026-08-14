# App Escala ICI no Cloudflare Pages

Projeto Pages real e já em uso: **`escala-ici-staging`** (variável
`CLOUDFLARE_PAGES_PROJECT` em `.env.staging.app`). Alias público estável:
`https://staging.escala-ici-staging.pages.dev`. Cada deploy também gera uma
URL imutável específica daquele build (ex.: `https://<hash>.escala-ici-staging.pages.dev`)
— use o alias para testar manualmente, não a URL imutável do deploy anterior.

Não crie um novo projeto Pages para esta finalidade — o projeto já existe.
Se o Wrangler oferecer criar um projeto durante o deploy (normalmente porque
`CLOUDFLARE_PAGES_PROJECT` está errado ou a conta não enxerga o projeto
existente), **pare** e confira o valor antes de confirmar qualquer coisa.

## Build

- diretório raiz: raiz deste monorepo;
- comando: `npm ci && npm run build:app:pages`;
- diretório de saída: `dist/apps/app`;
- versão do Node.js: 22 ou superior.

Copie `.env.staging.app.example` para `.env.staging.app` e configure os mesmos
valores no ambiente do Pages. O App mantém escrita oficial `false` e não
incorpora o repositório administrativo.

Os arquivos `_redirects` e `_headers` mantêm o fallback da SPA, os assets
versionados, o service worker atualizável e os cabeçalhos básicos de segurança.

## Teste local do artefato

```bash
npm run build:app:pages
npm run preview:app:pages
```

Abra `http://127.0.0.1:4174`. O manifesto, o escopo e o início do PWA usam a
raiz `/`, compatível com o domínio `pages.dev`.

## Deploy de staging

### Autenticação não interativa na VM

Na VM, a autenticação do Wrangler é feita por variáveis de ambiente
carregadas **somente na sessão do shell**, nunca salvas em arquivo nem no
Git:

```bash
export CLOUDFLARE_ACCOUNT_ID=<conta>
export CLOUDFLARE_API_TOKEN=<token>
```

O token precisa ter a permissão mínima **`Cloudflare Pages: Edit`** —
nunca um token de conta inteira. Antes de qualquer deploy, confirme que o
projeto correto já existe (sem criar nada novo):

```bash
npx wrangler pages project list
```

Se `escala-ici-staging` não aparecer na lista, **pare** — não crie um
projeto novo sem confirmar antes com quem administra a conta Cloudflare.

### Deploy

Depois de autenticado e confirmado que `CLOUDFLARE_PAGES_PROJECT=escala-ici-staging`:

```bash
npm run build:app:staging
npm run pages:deploy:staging -- --confirm=DEPLOY_STAGING
```

O segundo comando revalida o Firebase, refaz o build e publica somente
`dist/apps/app` no branch Pages `staging`. Se o Wrangler perguntar se deve
criar um projeto novo, responda não e investigue a configuração antes de
prosseguir — nunca use o nome definitivo de produção.

### Verificação pós-deploy

Depois do deploy, confirme no alias público
(`https://staging.escala-ici-staging.pages.dev`):

- `service-worker.js` responde e corresponde à versão esperada do PWA (na
  publicação mais recente, `push-pwa-2b2a` — confira
  `apps/app/src/sw/serviceWorker.js` se o valor divergir);
- o manifesto (`manifest.webmanifest`) carrega e aponta `start_url`/`scope`
  para `/`;
- não existe `firebase-messaging-sw.js` separado (o projeto usa um único
  service worker, ver `scripts/validate-pwa.mjs`).

### Aviso conhecido — `dist/server/wrangler.json`

O Wrangler pode emitir um aviso sobre `dist/server/wrangler.json` durante o
build/deploy do App. Isso é **apenas aviso** quando o deploy publica
corretamente `dist/apps/app` e a verificação pós-deploy acima passa. Pare e
investigue somente se o deploy falhar de fato ou se o conteúdo publicado não
corresponder ao build esperado (por exemplo, se um artefato do Dashboard
aparecer publicado no lugar do App).
