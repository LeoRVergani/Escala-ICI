# CHECKPOINT — CHECKUP-VISUAL-1 (Hora Extra no Dashboard + inconsistências visuais)

## Dashboard — grade de revisão da importação (ScheduleImportReview)
- HE com turno aparece com a COR do turno (ex.: "T" laranja), borda tracejada e selo "HE";
  a dica da célula mostra "Hora Extra · Tarde 13:00–19:00".
- Legenda abaixo da grade: turnos, X/DF/DU/Folga/BH, Hora Extra (cor do turno), contador de
  dias seguidos e ícone de descanso abaixo do mínimo. Substitui a legenda de "densidade"
  (Baixa/Alta/Sem dados), que não correspondia a nada na grade.
- Mini-legenda lateral ganhou o chip HE.
- Células/avatares usam os tokens de período (`--periodo-*`): corrige o tema escuro (cores
  misturadas com `white`) e dá cor a FOLGA/AN, que ficavam sem estilo. Especificidade via
  `:where()` para não apagar os destaques de 7º dia/erro de fonte.

## Dashboard — contadores coerentes
- "Alertas" (Visão geral e Hub de Escalas) contam só violações de regra (6x1, 11h, 35h), igual
  ao sino e à revisão. "Publicação incompleta" é status (selo Rascunho), não alerta.
- "Pessoas" de uma Jornada = pessoas NA escala (igual ao cartão da escala); sem escala, cai para
  os ativos da equipe. Antes: Hub 10 × cartão 9.
- Histórico "Ver alterações": HE mostra o turno ("Tarde · Hora Extra · 13:00–19:00").

## App
- Cards da Agenda seguem a competência exibida no calendário (setas ‹ ›):
  "Total de dias" mostrava 61 (duas competências somadas) contra 24 trabalhados de uma só.
  Agora mostra os dias da competência e o período (ex.: 26/10 a 25/11).
- Trabalhados mostra "+N HE" (HE não entra nas horas de jornada); Descansos inclui Folga feriado.
- Sino/atualizações: HE mostra o turno real.

## Dados
- `AlteracaoEscala` ganhou `turnoAnterior?`/`turnoNovo?` (só gravados quando há turno; eventos
  antigos continuam válidos). A comparação entre revisões passou a considerar `t`.

## Validação
- vitest 1517 ok (2 novos). typecheck raiz/apps ok. lint 0 erros (10 avisos, era 11).
- test:boundaries 511/511 — a falha 362 era teste desatualizado (a tela passou a navegar por
  competência); o teste agora aceita `escalaDaCompetenciaAtual ?? escalaVisivelApp`.
- build:apps ok.
