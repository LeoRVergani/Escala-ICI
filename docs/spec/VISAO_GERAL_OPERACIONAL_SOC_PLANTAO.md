# Spec — Visão geral operacional SOC + Plantão

**Status:** implementada e validada em runtime — revisada em DASH-SIMPLES-1A<br>
**Data:** agosto de 2026 (revisão: 26/08/2026)<br>
**Produto:** Escala ICI  
**Escopo:** dashboard do coordenador, sem alteração de schema, regras Firebase ou persistência

> **Revisão DASH-SIMPLES-1A (26/08/2026):** decisão de produto aprovada após o
> diagnóstico de simplificação estrutural do Dashboard. Duas mudanças sobre a
> versão original deste documento:
> 1. O cluster de contexto (seletor SOC/Plantão + competência + status) **saiu
>    do header quando `tela === 'visao'`** — ver § 10. Ele nunca filtrou dados
>    da Visão geral (`resolverOperacoesDashboard()` já é independente do
>    contexto ativo, por causa do hotfix `984504e`/HOTFIX-PLANTAO-PUBLICADO-
>    APP-E-VISAO-GERAL-1), então mantê-lo ali era só carga cognitiva
>    redundante. Continua existindo, inalterado, dentro do workspace Escalas.
> 2. "Saúde das escalas" (§ 6, barra artificial em %), "Colaboradores"/"Dias
>    no período" e o card "Alertas por operação" (§ 8) foram removidos por
>    duplicarem informação já visível nos dois cards principais (status,
>    alertas, competência). Um único painel **Pendências** (ver § 8 revisado)
>    substitui "Alertas por operação" + "Trocas pendentes". "Publicação da
>    escala" (§ 7) foi mantida — é a única visão lado a lado das duas
>    operações e está coberta por testes de regressão que impedem a
>    divergência de status já corrigida uma vez (FASE-PLANTAO-POS-
>    PUBLICACAO-APP-VISUALIZACAO-1).

## 1. Objetivo

A Visão geral deve permitir que o coordenador acompanhe **SOC — Jornada 6x1** e **Plantão** diretamente em uma única tela. O resumo não substitui os editores existentes: ele funciona como uma superfície operacional de triagem, comparação e navegação.

A composição aprovada mantém a linguagem visual do Escala ICI: sidebar azul-marinho, navegação azul ativa, cabeçalho branco, canvas azul-claro, cards brancos, bordas finas, sombras discretas, ícones lineares e cores semânticas. A assimetria é funcional: os dois cards de operação são o foco principal, enquanto saúde, publicação, alertas e trocas formam o segundo nível de decisão.

> **Regra normativa:** a Visão geral resume as duas operações usando os estados já existentes no DashboardApp. Ela não cria uma segunda fonte de dados, não persiste métricas derivadas e não deve alterar o comportamento das telas Grade, Importação, Calendário de Plantão ou Trocas.

## 2. Ordem visual aprovada

A página segue a ordem abaixo, sem lacunas ou cards flutuantes:

1. Cabeçalho da página, com o eyebrow **Operação integrada**, título **Visão geral**, subtítulo e ações **Nova escala** e **Importar escala**. Nenhum seletor de contexto no header nesta tela (ver § 10).
2. Dois cards principais lado a lado: **SOC** e **Plantão**.
3. Dois cards inferiores alinhados: **Publicação da escala** e **Pendências** (alertas de cada operação + trocas aguardando aprovação, em linguagem humana).

*(Histórico: a versão original desta spec tinha uma faixa "Colaboradores/Dias no período/Saúde das escalas/Pendências" e três cards inferiores — "Publicação da escala", "Alertas por operação", "Trocas pendentes". Removida em DASH-SIMPLES-1A por redundância; ver §§ 6, 8, 9 abaixo.)*

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

## 6. Faixa Saúde das escalas — REMOVIDA em DASH-SIMPLES-1A

*Seção histórica.* O card **Saúde das escalas** (barra percentual de apresentação, `healthBarSoc`/`healthBarPlantao`/`rotuloSaudeDashboard`) e a faixa "Colaboradores"/"Dias no período" foram removidos. Cada operação já mostra status (estável/revisão necessária/sem escala) e contagem de alertas no próprio card principal (§ 4/§ 5) — a barra e a faixa duplicavam essa mesma informação sem agregar nada operacional. Nenhum dado foi persistido por essas seções; a remoção não tem impacto de schema/Rules.

## 7. Card Publicação da escala

O card compara a disponibilidade de SOC e Plantão:

- SOC mostra o título/resumo de publicação já calculado por `resolverResumoPublicacao`, com contagem publicados/documentos.
- Plantão mostra **Rascunho disponível** quando existe competência/working copy ou **Nenhuma escala criada** quando não existe.
- Cada linha é acionável e abre a operação correspondente.
- O botão **Ver escalas e histórico** leva para a tela de Escalas.

Não declarar Plantão como publicado nesta fase, pois o domínio atual mantém a publicação de Plantão separada do estado Jornada.

## 8. Card Pendências (substitui "Alertas por operação" + "Trocas pendentes" em DASH-SIMPLES-1A)

Um único painel `overview-pendencias-card`, em linguagem humana, com uma linha por pendência real:

- SOC: "N alerta(s) requer(em) atenção" (ou "Nenhum alerta pendente"), usando `alertasJornadaDashboard`. Abre o detalhe do alerta existente (`alertasVisiveis[0]`) quando houver um selecionável.
- Plantão (só quando `possuiOperacaoPlantaoDashboard`): mesmo padrão, usando `plantaoAlertasDashboard`. Abre a operação Plantão.
- Trocas: "N troca(s) aguardando aprovação" (ou "Nenhuma troca aguardando aprovação"), usando `trocasPendentesGestor.length`. Abre a tela `trocas` via `abrirTrocasDoDashboard`.

Quando há trocas pendentes, até duas aparecem como prévia abaixo das linhas (mesmo comportamento de antes: cada prévia abre a tela de trocas e seleciona o `trocaId` correspondente). Quando não há nenhuma pendência (nenhum alerta em nenhuma operação e nenhuma troca), o painel mostra "Nenhuma pendência operacional no momento." em vez de três linhas todas "zeradas".

Nenhuma linha cria dado artificial: cada contagem vem diretamente dos mesmos estados já usados pelos cards principais (§ 4/§ 5), nunca uma segunda fórmula.

## 10. Contexto superior e competência — REMOVIDO da Visão geral em DASH-SIMPLES-1A

A Visão geral **não exibe mais** o cluster de contexto no header (seletor SOC/Plantão, seletor de competência, badge de status). Motivo: `resolverOperacoesDashboard()` já monta a lista de operações e seus status de forma totalmente independente do `contextoEscalaAtivo` — o contexto só marcava qual operação estava "ativa" (destaque visual), nunca filtrava dado nenhum. Como a Visão geral já mostra as duas operações lado a lado o tempo todo, esse destaque não tinha função — só ocupava espaço e sugeria (incorretamente) que havia uma operação "selecionada" cujo estado era diferente das outras.

O cluster continua existindo, inalterado, em qualquer outra tela (`tela !== 'visao'`) — é lá que "qual escala estou trabalhando agora" tem significado real (dentro do workspace Escalas).

Os cards da Visão geral não dependem desse cluster: eles navegam diretamente via `abrirOperacaoDoDashboard(tipo)`, que internamente ainda usa `solicitarTrocaContexto`/`solicitarTrocaCompetencia` (protegendo alterações não salvas) ao entrar em Escalas — só que agora esse cluster só fica visível depois da navegação, não antes, na própria Visão geral. O resultado esperado é:

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
| Contexto SOC/Plantão no topo (fora da Visão geral — ver § 10) | `REDESIGN_WORKSPACE_ESCALAS.md` e `ScheduleContextSwitcher.tsx` |

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
6. A linha Trocas do painel Pendências abre a tela de trocas e seleciona a primeira pendência quando existe.
7. O header da Visão geral não mostra seletor de contexto/competência/status (§ 10); as demais telas continuam mostrando, inalteradas.
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
