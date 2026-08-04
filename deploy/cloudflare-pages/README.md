# App Escala ICI no Cloudflare Pages

Configure um projeto Pages exclusivo e temporário para o App do colaborador.
Na Fase 3K-B, o nome do projeto deve terminar em `-staging`.

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

## Deploy temporário de staging

Depois de autenticar o Wrangler (`npx wrangler login`) e confirmar que
`CLOUDFLARE_PAGES_PROJECT` termina em `-staging`:

```bash
npm run build:app:staging
npm run pages:deploy:staging -- --confirm=DEPLOY_STAGING
```

O segundo comando revalida o Firebase, refaz o build e publica somente
`dist/apps/app` no branch `staging`. Não use o nome definitivo de produção.
