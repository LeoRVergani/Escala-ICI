# Checkpoint Fase 3A — Separação segura

## Base preservada

- Commit publicado de origem: `1b7cecb64d75af74929267f271f6723338d409e3`
- Site de produção: não alterado nesta fase
- Host de compatibilidade: preservado nas rotas `/dashboard` e `/app`

## Entregue

- Dashboard executável como SPA Vite independente
- App do colaborador executável como SPA Vite independente
- Builds separados em `dist/apps/dashboard` e `dist/apps/app`
- Repositórios Firebase separados em autenticação, leitura e escrita
- App do colaborador sem importações administrativas
- Testes estruturais para impedir regressão das fronteiras
- `.env.example` e instruções locais atualizadas

## Validação executada

```bash
npm run check:phase3a
```

Resultado:

- TypeScript do host: aprovado
- TypeScript dos dois SPAs: aprovado
- Testes originais: 21 aprovados
- Testes de fronteira: 3 aprovados
- ESLint: aprovado
- Build Dashboard: aprovado
- Build App: aprovado
- Build do host de compatibilidade: aprovado
- Artefato do Site: aprovado

## Como executar

Em dois terminais:

```bash
npm install
npm run dev:dashboard
```

```bash
npm run dev:app
```

- Dashboard: `http://localhost:4173`
- App do colaborador: `http://localhost:4174`

Sem Firebase configurado, use **Entrar na demonstração**.

## Próximo checkpoint

A Fase 3B implementará competência dinâmica, domínio do colaborador e a
experiência “Hoje / próximo turno” sem alterar as funções de gestão.
