# CHECKPOINT — Nome do plantonista no App + escala individual em Minha equipe

## Diagnóstico dos horários do Plantão (Relatorio-PlantaoCOSI)
Planilha: dia útil 19:00 -> 07:00 (12h); fim de semana/feriado 19:00 -> 19:00 (24h). O importador lê
corretamente (conferido). Os prints do App (30/10 Bruno, 31/10 Jean, 01/11 Caroline, todos 19-19)
batem com o Controle de Plantão. Diferenças reais encontradas: nome aparecendo como login e
contatos vazios para quem não cadastrou.

## NOME-PLANTONISTA-1
- Causa: a atribuição publicada guarda só o login; o App busca o nome em `usuarios`, que um
  analista de outra equipe não pode ler (antes funcionava só por causa da regra aberta de 23/09).
- `ParticipantePlantao.nomeExibicao` (opcional, até 120 caracteres). Regras: aceito na criação e na
  atualização administrativa; o próprio plantonista continua só com contatos/cor.
- Dashboard grava o nome ao adicionar participante, ao salvar rascunho de Plantão e, ao abrir a aba
  do Plantão em Minha equipe, completa quem ainda não tem.
- App: `nomeExibicaoPlantonista` usa o cadastro, senão `nomeExibicao` do participante, senão o login.
  Única mudança no App.

## ESCALA-INDIVIDUAL-1 (Minha equipe, aba 6x1)
- Botão "Ver escala do mês" por pessoa: calendário (dom–sáb) com turno, Hora Extra e horário;
  navegação ‹ ›; resumo: dias trabalhados, horas, folgas sábado / dia de semana / domingo (DF/DU,
  mesmo critério do Controle de Plantão) e, quando houver, folga feriado, HE, férias, BH,
  aniversário, atestado; legenda completa. Mostra a publicada ou, se não houver, o rascunho.

## Validação
vitest 1517 ok · typecheck ok · lint 0 erros · test:boundaries 512/512 · build:apps ok.
Testes de regra novos (2) — rodar na VM antes de publicar as regras.
