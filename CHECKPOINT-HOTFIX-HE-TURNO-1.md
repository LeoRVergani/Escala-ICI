# CHECKPOINT — HOTFIX-HE-TURNO-1 (Hora Extra com turno)

## Problema
No App, um dia de Hora Extra aparecia como "HE — Sem horário de trabalho".
A aba Escalistas só tem `HE` na célula; o turno real (Madrugada/Manhã/Tarde/Noite)
está na aba Escala e era ignorado para HE. O analista não sabia em que horário trabalharia.

## Solução
- `Dia.t` (opcional): turno em que a HE acontece. O dia continua `c: 'HE'`.
- Importador (`parser.ts`): HE busca o turno na aba Escala (mesmo índice dos dias
  numéricos) e grava `{ c: 'HE', t, i, f, vd }` via `criarDiaHoraExtra()`. Sem o login
  na aba Escala, mantém `{ c: 'HE' }` e gera aviso na prévia.
- `m` não é preenchido na HE: `totais.min`/`diasTrabalhados` seguem iguais ao
  Controle de Plantão (HE conta só em `totais.he`).
- `resolverJornadaDia()` ganhou `periodo` (cor/ícone: `t` na HE, senão `codigo`) e
  `horaExtra`; descrição vira "Tarde · Hora Extra", horário/duração do turno real.
- App: chip com cor do turno + selo "HE" (calendário, semana, agenda, Hoje, próximo
  turno, lembretes, legenda). Equipe agrupa a HE no turno real. HE continua fora
  das trocas (comportamento anterior).
- Dashboard: grade mostra cor do turno + selo; editor troca o botão "HE" por
  "Hora Extra · Madrugada/Manhã/Tarde/Noite".

## Validação
- Planilha real de novembro/2026: 13 dias de HE resolvidos, 0 erros, 0 avisos de HE;
  lvergani 15/11 = HE Tarde 13:00–19:00; totais 24 dias / 144:00 / he 1.
- vitest: 1496 testes ok (7 novos). typecheck raiz/apps ok. lint 0 erros. build:apps ok.
- test:boundaries: 506/509; as 3 falhas (31, 225, 361) já existiam antes deste hotfix.
  Testes 13 (app-boundaries) e 7 (dashboard-contexto-escala) atualizados para
  `periodo` e para a nova assinatura de `editarCelula`.

## Depois do deploy
Reimportar/republicar a escala de novembro para os dias de HE ganharem turno.
Dias de HE já publicados sem `t` continuam aparecendo como antes.
