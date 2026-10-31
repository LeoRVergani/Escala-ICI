# CHECKPOINT — TROCA-FOLGA-1 (troca de folga pelo próprio colaborador)

## Regra
- No App, no detalhe de um dia futuro da escala publicada:
  - folga DF/DU -> "Trocar esta folga por outro dia" (escolhe um dia de trabalho que vira folga);
  - dia de trabalho comum -> "Folgar neste dia" (escolhe uma folga DF/DU que vira trabalho).
- O dia de folga recebe exatamente o turno do dia de trabalho: horas do mês iguais.
- "Apto": a troca não pode criar nenhum alerta novo de 6x1 / 11h / 35h (mesmas regras da
  publicação). Cada dia candidato aparece apto ou bloqueado com o motivo. Só dias a partir de amanhã;
  Hora Extra, feriado, férias etc. não entram.
- Sem colega: nasce PENDENTE_GESTOR e aparece na aba "Gestor" do App e em Trocas do Dashboard.
- O coordenador aprova no Dashboard (aplica a troca na escala publicada e notifica a pessoa) ou
  recusa; a pessoa pode cancelar enquanto o coordenador não decidiu.
- Validação repetida no servidor do App (repositório) e na aprovação (escala mudou -> recria).

## Dados / Rules (PRECISA PUBLICAR)
- `SolicitacaoTrocaReal.tipo = 'FOLGA'`, `dataTroca`; destinatário = o próprio solicitante.
- create: ramo FOLGA (destinatário = autor, PENDENTE_GESTOR, dataTroca diferente de data).
- update: solicitante cancela a troca FOLGA em PENDENTE_GESTOR. Aprovação continua
  `podeAdministrarJornada`.
- Aprovação: um só documento, uma só gravação (antes gravaria duas vezes o mesmo doc).
- Recusa: notificações sem duplicar quando solicitante = destinatário.

## Testes
- lib/trocaFolga.test.ts (4): apto, 7 dias seguidos bloqueado, dia passado/código/rascunho, horas iguais.
- Regras: 5 testes novos (criar, negar variações, cancelar, colega não cancela em PENDENTE_GESTOR,
  gestor aprova). Rodar na VM antes de publicar.
- vitest 1525 ok · typecheck ok · lint 0 erros · test:boundaries 512/512 · build:apps ok.
