# Spec — Revisão da Jornada 6x1 com calendário central ampliado

**Status:** aprovado para implementação local em agosto de 2026  
**Escopo:** tela de revisão/importação da escala SOC — Jornada 6x1  
**Referência visual:** composição aprovada pelo usuário, baseada em roster lateral, calendário mensal central e pendências da fonte  
**Decisão principal:** remover o card lateral **“Detalhes do dia”** para ampliar a matriz/calendário

## 1. Objetivo

A tela de revisão da Jornada 6x1 deve permitir que o coordenador compreenda a competência inteira em uma única superfície de trabalho. O calendário mensal é o centro da decisão; o roster ajuda a localizar pessoas; os cards de resumo e as pendências explicam a qualidade da importação.

O detalhe repetido de um único dia, anteriormente exibido em um card à direita, foi removido porque consumia largura horizontal e duplicava informação já disponível na matriz colorida. A seleção de dia continua existindo para destacar uma coluna, navegar pelo mês e abrir a edição da célula, mas não deve renderizar uma terceira coluna lateral.

> **Regra normativa:** a revisão SOC da Jornada 6x1 usa duas colunas no workspace desktop: `Colaboradores` à esquerda e `Calendário/Matriz` ocupando todo o espaço restante. Não reintroduzir `Detalhes do dia` como terceiro card lateral sem nova aprovação visual.

## 2. Composição aprovada

A ordem visual da página é fixa:

1. Cabeçalho superior do aplicativo, com contexto SOC, competência, status e ações globais.
2. Cabeçalho da revisão, com botão de retorno, título **Importar escala de Jornada 6x1** ou equivalente, nome da fonte e status.
3. Faixa de resumo executivo, com período, colaboradores, dias, alertas e saúde da origem.
4. Workspace principal em duas colunas:
   - **Roster de colaboradores**, com busca, login, nome, turno padrão, avatar e legenda compacta.
   - **Calendário/Matriz mensal**, com seletor de dia, navegação de competência, coluna de nomes fixa, datas, chips de turno, destaque de fim de semana, coluna selecionada e legenda de densidade.
5. Seção **Pendências da fonte**, com alertas preservados da validação do arquivo.

A seção de pendências permanece abaixo do workspace. Ela não deve ser movida para a coluna direita nem transformada em um detalhe lateral da data selecionada.

## 3. Grid do workspace

| Região | Regra desktop | Regra responsiva |
|---|---:|---:|
| Roster | Coluna fixa visual de aproximadamente 190px, com busca e lista rolável | Fica abaixo da matriz em telas estreitas |
| Matriz | `minmax(0, 1fr)` e todo o espaço restante | Ocupa a largura inteira antes do roster |
| Gap | 12px entre roster e matriz | 12px quando empilhado |
| Card de detalhe diário | Não renderizar | Não renderizar |
| Alertas | Abaixo das duas colunas | Abaixo da matriz e do roster |

A regra de largura é deliberadamente flexível: o roster não deve encolher até tornar nomes ilegíveis, e a matriz deve receber a largura liberada pela remoção do detalhe lateral. A matriz mantém rolagem horizontal para não comprimir as 31 datas da competência.

## 4. Matriz mensal

A matriz deve manter a competência completa entre `resultado.periodoInicio` e `resultado.periodoFim`, incluindo células vazias. Cada data permanece uma coluna independente e cada célula continua acionável para abrir a edição.

O cabeçalho da matriz apresenta o dia da semana e a data curta. Fins de semana usam a cor semântica já definida. A data selecionada recebe destaque de coluna, mas a seleção não cria uma lista duplicada de pessoas à direita.

Os grupos de turno seguem a ordem `Madrugada`, `Manhã`, `Tarde`, `Noite`, usando os chips e tokens semânticos existentes. Os códigos devem permanecer consistentes com a Jornada 6x1: `MD`, `M`, `T`, `N`, `X`, `DF`, `DU`, `BH` e demais códigos do catálogo.

## 5. Interação de seleção de dia

O seletor **Selecionar dia**, os botões de dia anterior/próximo e o destaque da coluna selecionada continuam obrigatórios. Ao clicar em uma célula, a tela deve:

- destacar a data correspondente;
- preservar a matriz inteira na mesma posição;
- chamar o callback de edição existente;
- manter a regra do assistente inicial 6x1 quando a célula estiver vazia;
- não abrir ou reconstruir um painel lateral de detalhes.

A remoção do card lateral é visual. Ela não remove o dado da célula, não altera o parser, não altera alertas e não modifica a persistência.

## 6. Roster

O roster continua sendo a referência rápida de pessoas. Cada item deve exibir avatar/abreviação, login, nome e código do turno padrão. A busca permanece no topo. A ação de remoção, quando disponível, continua local à competência e mantém a confirmação existente.

A legenda compacta do roster pode repetir apenas códigos essenciais. A legenda detalhada de densidade continua sob a matriz, e a legenda principal da escala permanece conforme o padrão global do dashboard.

## 7. Responsividade

Em larguras reduzidas, a matriz aparece primeiro e o roster fica abaixo, permitindo que o usuário veja o calendário antes de rolar até a lista. O calendário mantém rolagem horizontal. O card lateral de detalhes não deve aparecer como fallback responsivo; a remoção vale para todos os breakpoints.

## 8. Regras de não regressão

Não reintroduzir o layout antigo de três colunas (`roster + matriz + detalhes`). Não mover o calendário para uma coluna estreita por causa de um painel auxiliar. Não trocar a matriz por uma agenda diária como visão principal. Não remover a busca do roster, a navegação mensal, a seleção de data, os grupos de turno, os chips semânticos ou as pendências da fonte.

Também não alterar schema Firebase, regras de segurança, parser, cálculo de totais, lógica do assistente 6x1 ou fluxo de persistência nesta mudança. O objetivo desta spec é composição e hierarquia visual.

## 9. Referência de código

- `components/ScheduleImportReview.tsx`: renderiza o cabeçalho, resumo, roster, matriz e pendências.
- `app/globals.css`: define `.soc-import-review-workspace` com duas colunas e os estilos da matriz.
- `apps/dashboard/src/DashboardApp.tsx`: integra o resultado da importação e mantém os callbacks de edição/retorno.
- `docs/spec/JORNADA_6X1_ASSISTENTE_CICLO.md`: regras independentes da grade editável e do assistente inicial.

## 10. Critérios de aceite

A implementação é aceita quando o workspace mostra apenas roster e matriz, o calendário ocupa claramente o espaço liberado, a seleção de data continua funcionando, a matriz mantém todas as datas da competência, o roster continua pesquisável, os alertas continuam abaixo e nenhuma referência visual a **Detalhes do dia** aparece no DOM da revisão.
