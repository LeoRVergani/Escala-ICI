# CHECKPOINT — Notificações claras, cabeçalho por cima, FOLGA no calendário, exclusão de Grupo pelo admin

## Notificações sempre na frente
Causa: em `app/globals.css`, `position: sticky; top: 0; z-index` estavam por engano dentro de
`.topbar::before`. O cabeçalho ficava sem camada própria e os cards da página (posicionados depois
dele) cobriam o painel do sino e o menu do usuário. As linhas voltaram para `.topbar`
(`z-index: 60`); modais (200) continuam acima. Vale para o App e o Dashboard.

## Notificações compreensíveis (App)
Cada atualização mostra: motivo, mês da competência, revisão e data de publicação, "N dias da sua
escala mudaram" e, por dia, data com dia da semana + "Antes" e "Agora" lado a lado com o chip
colorido do turno (HE com selo). Eventos antigos de Hora Extra sem turno gravado têm o turno deduzido
pelo horário (13:00–19:00 → Tarde).

## FOLGA no calendário (App)
O chip do calendário é um círculo de 24px; códigos longos (FOLGA, AFA) vazavam. Agora recebem
`data-longo` e viram pílula.

## Exclusão de Grupo de Plantão pelo ADMIN_SISTEMA
- O admin administra qualquer Grupo na tela (as Rules já concediam via `souAdminSistema()`); antes,
  um Grupo com Matriz que não listava o admin aparecia como "só consulta", sem Editar/Excluir.
- A confirmação lista os vínculos: equipe responsável, equipes que consultam, participantes,
  responsáveis na Matriz, rascunhos e competências publicadas/canceladas, além de avisar se há
  outro grupo com o mesmo nome. O card mostra o ID técnico do grupo.
- Admin pode excluir mesmo com competência publicada: grupo, participantes e rascunhos são
  removidos; vínculos ativos da Matriz são desativados; as competências publicadas ficam no banco
  como histórico de auditoria (a Rule bloqueia exclusão física de propósito), sem grupo e invisíveis.
- Auditoria: `EXCLUIR_GRUPO_PLANTAO`.
- Nenhuma mudança em `firestore.rules`: não é preciso publicar regras.

## Validação
vitest 1517 ok · typecheck ok · lint 0 erros · test:boundaries 511/511 · build:apps ok.
