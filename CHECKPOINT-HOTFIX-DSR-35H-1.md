# CHECKPOINT — HOTFIX-DSR-35H-1 (descanso de 35h após folga)

## Regra (igual ao Controle de Plantão)
Entre o fim do último turno antes de uma folga e o início do turno de retorno,
o descanso mínimo é de 35h (DSR 24h + interjornada 11h).
Ex.: Noite no sábado (termina domingo 01:00) + DF no domingo + Manhã na segunda
07:00 = 30h → violação. Dias seguidos continuam com o mínimo de 11h.

## Implementação
- `lib/alertasEscala.ts`: `MINIMO_DESCANSO_APOS_FOLGA_HORAS = 35`.
  `detectarDescansoInsuficiente()` compara cada turno com o turno trabalhado anterior:
  dias seguidos → 11h (`regra: 'INTERJORNADA'`); separados só por folga (categoria
  DESCANSO: DF, DU, FOLGA, AN) → 35h (`regra: 'DSR'`, com `datasFolga`).
  Férias, atestado, BH ou dia sem escala no meio → regra não se aplica.
- Alerta ganhou `minimoHoras`, `regra`, `datasFolga`; textos em
  `tituloAlertaDescanso()`/`regraAlertaDescanso()`.
- Dashboard: sino, painel de alertas (DSR = crítico), grade (tooltip com 35h) e
  aviso de troca hipotética mostram a regra certa.
- Publicação: qualquer alerta operacional (6x1, 11h ou 35h) passa a exigir
  justificativa no modal, listando os alertas. Não bloqueia — o gestor decide.

## Validação
- Planilha real de novembro/2026: 0 alertas na versão atual; com o 15/11 de
  lvergani de volta para Manhã: 1 alerta "13/11 N → 15/11 M, 30h < 35h"
  (mesmo número do Controle de Plantão).
- vitest 1506 ok (10 novos). typecheck raiz/apps ok, lint 0 erros, build:apps ok.
- test:boundaries 506/509 (falhas 31, 225, 361 já existiam).

## Limite conhecido
A regra roda dentro do período 26→25 de cada escala; a virada entre duas
competências (dia 25 → 26) não é comparada, como já acontecia com as 11h.
