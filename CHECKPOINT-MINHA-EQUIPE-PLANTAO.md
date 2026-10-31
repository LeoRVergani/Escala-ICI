# CHECKPOINT — MINHA-EQUIPE-PLANTAO (abas por equipe 6x1 e por Plantão)

- "Minha equipe" mostra uma aba para cada equipe de 6x1 (jornadasAdministraveis) e uma para cada
  Grupo de Plantão que o usuário organiza (plantoesAdministraveis), lado a lado, marcadas "6x1"/"Plantão".
- Aba de Plantão: membros = participantes ativos do grupo (não o equipeId do cadastro). Mostra a equipe
  de cada pessoa, contatos e "Tirar do Plantão" (desativa a participação; pessoa continua cadastrada).
- Buscar pessoa na aba de Plantão: "Adicionar ao Plantão" — vira participante e CONTINUA na equipe
  dela (sem transferência). Na aba 6x1 continua a transferência com aviso.
- Cadastrar pessoa nova na aba de Plantão: cadastro na equipe responsável pelo grupo e, ao salvar,
  entra como participante.
- Sem mudança em firestore.rules (fluxos já cobertos pelas regras existentes e testes).
- Teste de fronteira 347: contagem do pool amplo de candidatos 5 -> 6 (nova tela, mesma regra).
- vitest 1517 ok · typecheck ok · lint 0 erros · test:boundaries 512/512 · build:apps ok.
