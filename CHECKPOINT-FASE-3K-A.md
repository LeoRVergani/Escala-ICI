# Checkpoint — Fase 3K-A

## Objetivo

Separar a implantação do App do colaborador e do Dashboard sem duplicar o
parser, os modelos ou o contrato Firebase e sem realizar qualquer publicação
externa.

## Estado de entrada confirmado

- laboratório Firebase local aprovado no Windows;
- Dashboard e App Vite com builds separados;
- rascunho, publicação, histórico, rollback e notificações em tempo real;
- App somente leitura e PWA instalável;
- escrita no Firebase oficial bloqueada.

## Entregue

### App do colaborador

- artefato estático em `dist/apps/app` compatível com Cloudflare Pages;
- scripts `build:app:pages` e `preview:app:pages`;
- fallback SPA em `_redirects`;
- cache e cabeçalhos básicos em `_headers`;
- PWA independente com `id`, `start_url` e `scope` na raiz `/`;
- service worker sensível ao escopo da instalação;
- manifesto `/app` separado para preservar o host de compatibilidade.

### Dashboard

- Dockerfile multi-stage com Node 22 somente no build;
- runtime Nginx sem privilégios na porta 8080;
- endpoint `/health` e `HEALTHCHECK`;
- fallback correto para a SPA;
- Compose com filesystem somente leitura, `no-new-privileges` e capabilities
  removidas;
- configuração Firebase recebida apenas como argumento do build;
- escrita oficial bloqueada por padrão;
- nenhum código do App incluído como entrada executável do Dashboard.

### Contratos e documentação

- validação automatizada dos dois artefatos;
- testes que impedem misturar as entradas administrativas e de consulta;
- instruções separadas em `deploy/dashboard` e `deploy/cloudflare-pages`;
- laboratório Windows/Linux preservado.

## NÃO FAZER nesta fase

- não executar deploy no Cloudflare Pages;
- não publicar imagem em registry;
- não configurar credenciais reais;
- não habilitar escrita no Firebase oficial;
- não introduzir Firebase Admin ou service account;
- não separar fisicamente o monorepo em dois repositórios;
- não alterar regras de escala, parser, visual ou fluxo de publicação.

## Validação

```bash
npm run check:phase3ka
```

Teste opcional em computador com Docker:

```bash
npm run docker:dashboard:build
npm run docker:dashboard:up
curl http://localhost:4173/health
```

## Próximo marco

Fase 3K-B: preparar um projeto Firebase exclusivo de homologação e validar os
dois artefatos separados sem tocar na produção.
