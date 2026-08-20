# Spec visual — Modal D de atribuição de Plantão

**Status:** aprovado para implementação no editor de Plantão.
**Referência:** conceito visual D escolhido pelo usuário.
**Escopo:** criação e edição de uma atribuição de Plantão a partir de clique em “Adicionar”, seleção de pessoa e arraste de colaborador para um dia.

## Objetivo

O modal deve permitir que o coordenador escolha rapidamente um horário recorrente e, quando necessário, abra uma exceção manual sem abandonar o mesmo fluxo. A experiência privilegia os padrões do Grupo de Plantão, mantendo a possibilidade de informar datas e horários fora do padrão.

> **Princípio:** padrões recorrentes são a ação primária; horário fora do padrão é uma exceção explícita, visível e validada.

## Composição obrigatória

O modal usa uma composição central em duas colunas, com cabeçalho, área de seleção, área de detalhes, resumo e ações no rodapé.

| Região | Conteúdo obrigatório | Comportamento |
|---|---|---|
| Cabeçalho | Título “Adicionar plantão” ou “Editar plantão”, subtítulo curto e fechar | Escape, botão fechar e clique no backdrop fecham sem salvar |
| Coluna esquerda | “Padrões da escala” e cartões selecionáveis | Um clique aplica início, fim e deslocamento de dia do padrão |
| Coluna direita | Colaborador, data, horário selecionado e ação de exceção | Os campos refletem imediatamente o padrão escolhido |
| Resumo | Data, colaborador e intervalo | Sempre mostra o estado que será salvo |
| Rodapé | Cancelar, Salvar plantão e Excluir quando aplicável | Salvar reutiliza a validação e o callback da working copy existente |

## Cartões de horário

Os cartões devem ser apresentados na ordem **Noturno**, **5 horas** e **24 horas**. Padrões vindos do Grupo de Plantão têm precedência; grupos antigos sem `padraoHorarioSemanal` recebem os três presets de compatibilidade do editor. Padrões repetidos em dias diferentes aparecem uma única vez.

| Padrão | Intervalo | Duração | Tom visual | Uso |
|---|---:|---:|---|---|
| Noturno | 19:00 → 07:00 | 12h, termina no dia seguinte | `noite` | Plantão noturno recorrente |
| 5 horas | 19:00 → 00:00 | 5h, termina no dia seguinte | `noite` | Cobertura curta de transição |
| 24 horas | 19:00 → 19:00 | 24h, termina no dia seguinte | `vinte-quatro-horas` | Cobertura integral |

O cartão selecionado usa borda e fundo tonal, ícone de horário, radio visual preenchido e contraste suficiente. Nunca expor `fimDiaOffset` ao usuário; a interface deve dizer “dia seguinte” somente quando essa informação for operacionalmente útil.

## Cores semânticas

As cores abaixo devem permanecer consistentes entre o modal, calendário, legenda, chips, detalhes diários e futuros componentes de Plantão. Os quatro turnos regulares reutilizam a paleta já usada na Jornada 6x1; 24 horas possui um âmbar próprio.

| Tom | Cor base | Aplicação |
|---|---|---|
| Madrugada | `#7c5ce0` | Ícone, borda, seleção e chip de horários iniciados na madrugada |
| Manhã | `#13b99a` | Ícone, borda, seleção e chip de horários iniciados pela manhã |
| Tarde | `#e99b38` | Ícone, borda, seleção e chip de horários iniciados à tarde |
| Noite | `#2e8be6` | Ícone, borda, seleção e chip de plantões noturnos |
| 24 horas | `#d98218` | Ícone, borda, seleção e chip de cobertura de 24 horas |

A cor nunca deve ser a única forma de comunicar o horário. O cartão sempre apresenta título e intervalo textual, e o estado selecionado também usa borda, radio e fundo contrastante.

## Exceção fora do padrão

A ação secundária deve aparecer como botão contornado ou tracejado com o texto **“Definir horário fora do padrão”** e o apoio **“Use apenas quando a operação exigir uma exceção.”**. Ao acioná-la, o modal mantém o colaborador e a data inicial e revela:

- Data final;
- Hora inicial;
- Hora final.

Ao editar qualquer campo manual, o cartão de padrão deixa de ser selecionado, o resumo passa a indicar **Fora do padrão** e a validação existente continua bloqueando apenas plantonista ausente, datas vazias e fim anterior ou igual ao início. Duração diferente de 12h ou 24h é alerta, não bloqueio.

## Fluxos de entrada

| Entrada | Resultado esperado |
|---|---|
| Clique em “+ Adicionar” sem pessoa selecionada | Abre o modal com o primeiro padrão selecionado e colaborador pendente |
| Pessoa selecionada no roster + clique em um dia | Abre o mesmo modal com a pessoa preenchida |
| Arraste de pessoa para um dia | Abre o mesmo modal com pessoa e data preenchidas |
| Clique em um plantão existente | Abre o mesmo modal em modo edição e reconhece o padrão correspondente quando houver |
| “Salvar plantão” | Atualiza apenas a working copy e marca alterações não salvas |
| “Cancelar”, Escape ou fechar | Descarta alterações locais do modal |

## Responsividade e acessibilidade

Em desktop, o modal ocupa no máximo 820 px e usa duas colunas equilibradas. Até 760 px, as colunas empilham: padrões primeiro, detalhes depois. Todos os cartões são botões com `role="radio"` e `aria-checked`; controles de formulário mantêm foco visível, labels associadas e suporte ao teclado. A animação deve ser curta e respeitar `prefers-reduced-motion`.

## Regras de domínio preservadas

A implementação visual não persiste diretamente. O modal continua emitindo `FormularioAtribuicaoPlantao` para os callbacks existentes, e a persistência segue exclusivamente o fluxo de salvar rascunho. A configuração `padraoHorarioSemanal` é apenas fonte de sugestões; nunca recalcula atribuições existentes nem altera automaticamente o Grupo de Plantão.
