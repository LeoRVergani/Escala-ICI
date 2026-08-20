# Checkpoint — Integração ChatGPT do pacote visual com main 2cf03e4

## Base

- Base do usuário: `Escala-ICI-main.zip`, commit informado no pacote: `2cf03e4c5cec9bb72a2f524a4b1e7ab3ca7ca25a`.
- Pacote visual integrado: `Escala-ICI-projeto-completo-wizard-atualizado(1).zip`.
- Nenhum push ou deploy foi executado.

## Integração aplicada

- Visão geral operacional SOC + Plantão.
- Wizard unificado de `Nova escala` e `Importar escala`.
- Revisão visual da Jornada 6x1 com calendário central ampliado.
- Assistente de ciclo inicial 6x1.
- Modal visual de atribuição de Plantão.
- Botão compacto de retorno para `Escalas`.
- Specs novas e validações de runtime fornecidas pelo pacote visual.

## Correções feitas nesta integração

- O botão `Alterar` do wizard volta para a escolha de tipo (`Jornada 6x1` / `Plantão`) usando `onEscolherTipo(null)`.
- A criação inline de Plantão permite criar uma equipe responsável no próprio wizard quando não houver equipe disponível.
- O seletor de equipe responsável no Plantão ganhou placeholder explícito.
- Os presets do Plantão foram alinhados ao pedido operacional: `19:00 → 07:00` (12h), `19:00 → 00:00` (5h) e `19:00 → 19:00` (24h).
- O preset `Diurno 00:00 → 19:00` foi removido dos presets de compatibilidade; esse horário ainda pode ser usado por exceção manual ou preservado se vier importado.
- Legenda, demo, testes e specs foram atualizados para refletir o preset de 5h.
- `docs/spec/README.md` foi criado para reduzir ambiguidade sobre quais specs seguir.

## Validação executada no sandbox

Executado com sucesso:

```bash
git diff --check
node --test tests/app-boundaries.test.mjs tests/local-launchers.test.mjs tests/deployment-boundaries.test.mjs tests/uuid-boundaries.test.mjs tests/push-worker-boundaries.test.mjs tests/pwa-push-click-routing.test.mjs tests/plantao-preview-boundaries.test.mjs tests/plantao-model-boundaries.test.mjs tests/plantao-dashboard-administracao-boundaries.test.mjs tests/ui-org-boundaries.test.mjs tests/plantao-conferencia-contabil-boundaries.test.mjs tests/plantao-editor-boundaries.test.mjs tests/dashboard-navegacao-boundaries.test.mjs tests/dashboard-contexto-escala-boundaries.test.mjs tests/plantao-padrao-horario-boundaries.test.mjs tests/plantao-roster-drag-boundaries.test.mjs tests/plantao-limites-competencia-boundaries.test.mjs
```

Resultado dos boundary tests executados: **235 testes aprovados, 0 falhas**.

## Validação não executada no sandbox

Não foi possível executar `npm ci`, `npm run check`, `typecheck`, `vitest`, `lint` e `build` no sandbox porque as dependências não estavam instaladas de forma completa e a instalação via npm ficou indisponível/timeout no ambiente.

## Próximo passo recomendado

Aplicar em branch local de teste e rodar:

```bash
npm ci
npm run check
git diff --check
```

Somente depois avaliar commit/push.
