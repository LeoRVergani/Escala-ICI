# CHECKPOINT — EXCLUSAO-USUARIO-1 (admin exclui usuário de verdade)

## Problemas
1. Erro invisível: falhas iam para `erroAdmin`, mostrado na página ATRÁS do modal — clicar em
   excluir parecia não fazer nada.
2. Usuário excluído continuava aparecendo: só a lista da Administração era atualizada; a tela
   Usuários e as grades mantinham a pessoa até recarregar.
3. A tela principal Usuários não tinha botão de excluir (só Administração → Usuários).
4. A primeira etapa que falhasse interrompia tudo (o cadastro nunca era apagado); participação em
   Grupos de Plantão nunca era removida.

## Solução
- `excluirUsuario()` roda cada etapa de forma independente e devolve `{ concluidas, falhas,
  cadastroExcluido }`; cadastro por último. Nova etapa "Participação em Plantões" remove
  `gruposPlantao/{grupo}/participantes/{login}` em todos os grupos carregados.
- Modal: erro aparece dentro dele, listando o que foi e o que não foi excluído; botão
  "Marcar tudo (usuário de teste)"; campo de confirmação com placeholder.
- Após excluir: some da Administração, da tela Usuários, da grade aberta e dos participantes.
- Botão Excluir (lixeira) também na tela Usuários, só para ADMIN_SISTEMA, desabilitado na própria
  conta.
- Auditoria `EXCLUIR_USUARIO`.
- Sem mudança em `firestore.rules` (as regras já permitiam ao admin).

## Fora do alcance
Conta de login do Firebase Authentication (se existir) não é apagada pelo navegador; sem cadastro
em `usuarios`, a pessoa não acessa nada.

## Validação
vitest 1517 ok · typecheck ok · lint 0 erros · test:boundaries 511/511 · build:apps ok.
