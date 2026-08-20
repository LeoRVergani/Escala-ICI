# Checkpoint — Revisão Jornada 6x1: calendário central ampliado

## Decisão aprovada

A tela de revisão/importação da Jornada 6x1 segue o mockup aprovado pelo usuário: resumo executivo no topo, roster de colaboradores à esquerda, matriz/calendário mensal no centro e pendências da fonte abaixo. O card lateral **Detalhes do dia** foi removido para liberar largura ao calendário.

## Invariantes visuais

- O workspace desktop usa duas colunas: `190px minmax(0, 1fr)`.
- `.soc-import-review-roster` permanece à esquerda.
- `.soc-import-review-matrix-card` ocupa todo o espaço restante.
- A matriz mantém rolagem horizontal e todas as 31 datas da competência.
- O roster continua com busca, nomes/logins, turno padrão, remoção local e legenda compacta.
- A seleção de data continua no toolbar da matriz e destaca uma coluna.
- A seção `Pendências da fonte` permanece abaixo do workspace.
- Nenhum elemento `.soc-import-review-detail` deve ser renderizado.

## Invariantes funcionais

A remoção é somente de composição visual. Não alterar parser XLS, `ResultadoParse`, `indiceAlertas`, callbacks `onEditar`/`onRemover`, seleção de data, edição de células, assistente inicial 6x1, persistência Firebase ou regras de segurança.

Ao clicar em uma célula da matriz, a data deve continuar selecionada e o callback de edição deve abrir o mesmo fluxo anterior. A ausência do detalhe lateral não pode eliminar o contexto de data nem a ação de editar.

## Arquivos alterados nesta fase

| Arquivo | Alteração |
|---|---|
| `components/ScheduleImportReview.tsx` | Remoção do `useMemo`/renderização de `detalheDoDia` e do `<aside>` lateral. |
| `app/globals.css` | Workspace reduzido de três para duas colunas; estilos mortos do detalhe removidos; responsividade ajustada. |
| `docs/spec/REVISAO_JORNADA_6X1_LAYOUT_CALENDARIO.md` | Spec normativa do layout aprovado e critérios de aceite. |
| `CHECKPOINT-FASE-REVIEW-JORNADA-6X1-VISUAL.md` | Proteção contra regressão ao layout antigo. |

## Validação runtime registrada

No Dashboard local, após carregar `Escala-SOC-Controle-Agosto.xls`, foram confirmados: `detailCards = 0`, `workspaceColumns = 190px 751.094px`, `rosterWidth = 190px`, `dates = 31`. A captura real foi salva como `Escala-ICI-revisao-jornada-6x1-calendario-runtime.webp`.

## Regra para futuras IAs

Antes de alterar esta tela, ler este checkpoint e `docs/spec/REVISAO_JORNADA_6X1_LAYOUT_CALENDARIO.md`. Não restaurar o terceiro painel por conveniência de implementação. Se um detalhe diário voltar a ser necessário, ele deve ser proposto como drawer/modal ou nova alternativa visual, sem ocupar permanentemente a coluna direita, e somente após aprovação explícita.
