# Spec — Visão geral operacional SOC + Plantão

**Status:** implementada e validada em runtime  
**Data:** agosto de 2026  
**Produto:** Escala ICI  
**Escopo:** dashboard do coordenador, sem alteração de schema, regras Firebase ou persistência

## 1. Objetivo

A Visão geral deve permitir que o coordenador acompanhe **SOC — Jornada 6x1** e **Plantão** diretamente em uma única tela. O resumo não substitui os editores existentes: ele funciona como uma superfície operacional de triagem, comparação e navegação.

A composição aprovada mantém a linguagem visual do Escala ICI: sidebar azul-marinho, navegação azul ativa, cabeçalho branco, canvas azul-claro, cards brancos, bordas finas, sombras discretas, ícones lineares e cores semânticas. A assimetria é funcional: os dois cards de operação são o foco principal, enquanto saúde, publicação, alertas e trocas formam o segundo nível de decisão.

> **Regra normativa:** a Visão geral resume as duas operações usando os estados já existentes no DashboardApp. Ela não cria uma segunda fonte de dados, não persiste métricas derivadas e não deve alterar o comportamento das telas Grade, Importação, Calendário de Plantão ou Trocas.

## 2. Ordem visual aprovada

A página segue a ordem abaixo, sem lacunas ou cards flutuantes:

1. Cabeçalho da página, com o eyebrow **Operação integrada**, título **Visão geral**, subtítulo e ações **Nova escala** e **Importar escala**.
2. Dois cards principais lado a lado: **SOC** e **Plantão**.
3. Faixa de resumo com **Colaboradores**, **Dias no período**, **Saúde das escalas** e **Pendências**.
4. Três cards inferiores alinhados: **Publicação da escala**, **Alertas por operação** e **Trocas pendentes**.

Em desktop, os cards principais usam duas colunas iguais e os cards inferiores usam a grade de 12 colunas existente. Em telas menores, os cards principais empilham e os cards inferiores passam para uma coluna ou duas colunas conforme o breakpoint. Não permitir overflow horizontal causado pelo dashboard.

## 3. Ações do cabeçalho

### 3.1 Nova escala

O botão **Nova escala** usa `abrirNovaEscala`, o mesmo fluxo já existente na tela Escalas. Ele abre o `ScheduleStartWizard` em modo `NOVA`, permitindo escolher Jornada 6x1 ou Plantão, resolver área/equipe/grupo e prosseguir para criação.

Esse botão é secundário e aparece imediatamente ao lado de **Importar escala**. Não criar um modal paralelo nem duplicar as regras de resolução de contexto.

### 3.2 Importar escala

O botão **Importar escala** usa `abrirImportarEscala`, o mesmo fluxo já existente na tela Escalas. Ele abre o wizard em modo `IMPORTAR` e mantém a resolução automática de tipo, destino e competência.

## 4. Card SOC — Jornada 6x1

O card SOC é acionável e chama `abrirOperacaoDoDashboard('JORNADA')`. O destino é construído com o `equipeId` do contexto Jornada atual, do resultado carregado ou do primeiro escopo permitido, e com a competência ativa.

Quando o contexto já é o mesmo, o clique abre a **Grade da equipe**. Quando o contexto é diferente, o clique usa `solicitarTrocaContexto`, preservando o guard de alterações não salvas. A troca atualiza o seletor superior para SOC e atualiza a competência antes de abrir a grade.

O card mostra:

| Campo | Fonte |
|---|---|
| Status | Derivado de documentos/alertas existentes: estável, revisão necessária ou sem escala. |
| Competência | `contextoEscalaAtivo.competencia` ou `COMPETENCIA_ATUAL`. |
| Período | `resultado.periodoInicio` e `resultado.periodoFim`. |
| Pessoas | `documentos.length`, representando os documentos de colaboradores da Jornada. |
| Alertas | `alertasVisiveis.length`. |
| Barra de saúde | Indicador visual derivado da quantidade de alertas; é apresentação, não dado persistido. |

O texto **Abrir operação SOC** é uma ação visível, mas o card inteiro também é clicável. O ícone e o rótulo não podem ser usados como único mecanismo de navegação.

## 5. Card Plantão

O card Plantão é acionável e chama `abrirOperacaoDoDashboard('PLANTAO')`. O grupo é resolvido a partir do grupo ativo, do primeiro grupo administrável ou do primeiro grupo acessível já carregado. A competência preferida é a competência ativa; na ausência dela, usa a competência mais recente disponível no cache.

Quando existe rascunho/competência, o clique usa o fluxo de troca de contexto existente e abre a tela de revisão/edição de Plantão. Quando não existe escala, o contexto superior muda para Plantão e a tela Escalas mostra o estado **Nenhuma escala criada**, sem criar automaticamente um rascunho.

O card mostra:

| Campo | Fonte |
|---|---|
| Status | Competência/working copy e pendências do resultado Plantão. |
| Competência | Competência Plantão ativa ou competência geral como fallback visual. |
| Período | `CompetenciaPlantao.periodoInicio` e `periodoFim`. |
| Pessoas | Participantes do grupo já carregados ou participantes do contexto aberto. |
| Alertas | Erros, avisos e pendências de vínculo quando o resultado Plantão está aberto. |
| Métrica auxiliar | Quantidade de atribuições do `totalBruto` quando há competência. |

O card não inventa uma escala vazia. Se apenas o grupo existe, o status é **Sem escala**, a quantidade de alertas é zero e o texto informa que nenhuma escala foi criada.

## 6. Faixa Saúde das escalas

O card **Saúde das escalas** substitui o antigo card de horas planejadas na Visão geral. Ele compara SOC e Plantão em duas linhas, cada uma com status, barra visual e percentual de saúde de apresentação.

A porcentagem não é persistida e não representa uma nova regra de negócio. Ela é uma escala visual calculada para priorização:

- SOC parte de 100 e reduz por blocos de alertas, com limite inferior visual.
- Plantão parte de 100 e reduz por blocos de erros, avisos e pendências de vínculo; sem escala, mostra um nível visual baixo e status **Sem escala**.
- O texto inferior mostra o total de pendências operacionais, somando alertas SOC, pendências Plantão e trocas pendentes.

A cor deve comunicar estado sem depender exclusivamente dela: âmbar indica revisão necessária, verde indica estável, cinza indica sem escala. O texto do status é obrigatório para acessibilidade e compreensão.

## 7. Card Publicação da escala

O card compara a disponibilidade de SOC e Plantão:

- SOC mostra o título/resumo de publicação já calculado por `resolverResumoPublicacao`, com contagem publicados/documentos.
- Plantão mostra **Rascunho disponível** quando existe competência/working copy ou **Nenhuma escala criada** quando não existe.
- Cada linha é acionável e abre a operação correspondente.
- O botão **Ver escalas e histórico** leva para a tela de Escalas.

Não declarar Plantão como publicado nesta fase, pois o domínio atual mantém a publicação de Plantão separada do estado Jornada.

## 8. Card Alertas por operação

O card mostra duas linhas comparáveis:

- SOC: contagem de `alertasVisiveis` e rótulo Jornada 6x1.
- Plantão: contagem de erros/avisos/pendências do contexto Plantão e métrica auxiliar de participantes quando não há rascunho.

Cada linha abre a operação correspondente. O botão **Ver alertas do SOC** abre o detalhe de alerta existente quando houver um alerta selecionável; quando não houver, não deve criar dados artificiais.

## 9. Card Trocas pendentes

O card é uma ação direta para o coordenador. O resumo usa `trocasPendentesGestor.length`. O botão principal **Gerenciar trocas** chama `abrirTrocasDoDashboard`, abre a tela `trocas` e seleciona a primeira troca pendente quando houver.

Até duas trocas podem aparecer como prévia. Cada prévia mantém o comportamento existente: abre a tela de trocas e seleciona o `trocaId` correspondente. Quando não há trocas, o card mostra zero e uma mensagem neutra, mas continua acionável para a tela de histórico.

## 10. Contexto superior e competência

A Visão geral mantém o cluster superior já aprovado:

- seletor de contexto com Jornada SOC e Plantão;
- seletor de competência;
- status de rascunho/publicação/sem escala;
- ações globais existentes.

Os cards não alteram diretamente o texto do cabeçalho. Eles passam pelo mesmo `solicitarTrocaContexto`/`solicitarTrocaCompetencia` que protege alterações não salvas. O resultado esperado é:

| Clique | Contexto após a ação | Destino |
|---|---|---|
| Card SOC | SOC + competência da Jornada | Grade da equipe ou fluxo de troca protegido |
| Card Plantão | Plantão + competência do grupo | Editor/revisão Plantão ou Escalas sem escala |
| Card Trocas | Contexto preservado | Tela Trocas |
| Nova escala | Contexto ainda não alterado até seleção do wizard | Wizard Nova escala |
| Importar escala | Contexto ainda não alterado até seleção do wizard | Wizard Importar escala |

## 11. Compatibilidade com telas anteriores

Esta mudança não altera as seguintes decisões previamente aprovadas:

| Área preservada | Documento de referência |
|---|---|
| Grade 6x1 fixa, 31 datas e coluna sticky | `JORNADA_6X1_ASSISTENTE_CICLO.md` |
| Assistente de seis dias e edição individual | `JORNADA_6X1_ASSISTENTE_CICLO.md` |
| Calendário mensal de Plantão | `PLANTAO_MODAL_D.md` e specs de Plantão existentes |
| Modal D com Noturno/5h/24h e exceção manual | `PLANTAO_MODAL_D.md` |
| Botão compacto de retorno `Escalas` | `NAVEGACAO_RETORNO_ESCALAS.md` |
| Revisão Jornada 6x1 com roster e calendário central, sem detalhe lateral | `REVISAO_JORNADA_6X1_LAYOUT_CALENDARIO.md` |
| Contexto SOC/Plantão no topo | `REDESIGN_WORKSPACE_ESCALAS.md` e `ScheduleContextSwitcher.tsx` |

Não remover ou reverter qualquer uma dessas implementações ao alterar a Visão geral.

## 12. Acessibilidade e interação

Cards acionáveis usam elementos `button`, não hiperlinks antigos, e possuem estados de foco visível. O texto acompanha ícones e cores. O dashboard deve suportar teclado, manter ordem de foco lógica e não depender de hover para revelar a ação.

A composição deve permanecer legível com zoom e em larguras reduzidas. Em telas pequenas, os cards empilham; nenhum conteúdo essencial pode ser cortado horizontalmente. Os nomes das operações, status, contagens e ações devem continuar visíveis.

## 13. Restrições de domínio

Não criar campos Firebase para `healthBarSoc`, `healthBarPlantao`, `pendenciasDashboard` ou qualquer métrica de apresentação. Não modificar schema, Rules, parser, persistência, publicação, cálculo da Jornada 6x1, calendário Plantão, Modal D ou fluxo de Trocas. Os cálculos são derivados somente para renderização.

## 14. Critérios de aceite

A implementação é aceita quando:

1. A Visão geral mostra SOC e Plantão na mesma tela.
2. Os cards apresentam valores derivados de estados reais já carregados.
3. Nova escala aparece ao lado de Importar escala e abre o wizard existente.
4. O card Plantão troca o contexto superior para Plantão e a competência correspondente.
5. O card SOC faz o mesmo para SOC.
6. O card Trocas abre a tela de trocas e seleciona a primeira pendência quando existe.
7. Saúde das escalas substitui Horas planejadas sem cards quebrados.
8. Não há overflow horizontal no desktop validado.
9. As telas antigas e seus padrões visuais continuam intactos.
10. Typecheck, testes, lint, build e validação de artefato passam.

## 15. Arquivos de implementação

- `apps/dashboard/src/DashboardApp.tsx`: derivados de dados, handlers e JSX da Visão geral.
- `app/globals.css`: composição visual, estados, ações, responsividade e saúde.
- `docs/spec/VISAO_GERAL_OPERACIONAL_SOC_PLANTAO.md`: este documento normativo.
- `docs/validation/dashboard-overview-research-2026-08.md`: pesquisa de referências atuais usada na concepção.

## Referências de pesquisa

[1]: https://www.thoughtspot.com/data-trends/dashboard-design-examples-best-practices "ThoughtSpot — Dashboard Design: Examples and Best Practices"

[2]: https://www.myshyft.com/blog/dashboard-layout-principles/ "Shyft — Essential Dashboard UX Design for Powerful Shift Management"

[3]: https://insightsoftware.com/blog/the-dos-and-donts-of-dashboard-design/ "insightsoftware — Dashboard Design Guide: Trends, Examples, + Best Practices"
