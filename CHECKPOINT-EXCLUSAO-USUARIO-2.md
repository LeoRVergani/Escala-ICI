# CHECKPOINT — EXCLUSAO-USUARIO-2 (coordenador exclui usuário; admin vê todos)

## Tela Usuários
- ADMIN_SISTEMA vê TODOS os usuários (antes só os da operação selecionada no topo, ex.: só NOC), com
  filtro "Todas as equipes". Edição e ativar/desativar funcionam sobre a lista completa.
- Demais perfis: comportamento anterior (pool do contexto -> filtro de setor -> busca).

## Exclusão por coordenador
- Lixeira visível para o admin e para quem administra alguma Jornada.
- Coordenador exclui só colaborador/supervisor das equipes cuja Jornada administra (Matriz, fallback
  legado ou GESTOR_UNIDADE da unidade — mesma função `podeAdministrarJornada` de turnosMes).
  Nunca a própria conta nem contas de gestão (ADMIN_SISTEMA, GESTOR_UNIDADE, GESTOR_EQUIPE —
  perfil efetivo, inclusive o deduzido pelo nível hierárquico). O botão fica desabilitado com o
  motivo na dica.
- No modal do coordenador: cadastro, escalas publicadas, rascunhos e participação nos Plantões que
  ele administra. Trocas e notificações continuam só do admin.

## firestore.rules (PRECISA PUBLICAR)
`match /usuarios/{login}` — `allow delete`: `souAdminSistema()` OU (não é a própria conta, tem
`equipeId`, perfil efetivo fora de ADMIN_SISTEMA/GESTOR_UNIDADE/GESTOR_EQUIPE e
`podeAdministrarJornada(equipeId)`). Publicar: `npm run firebase:staging:deploy -- --confirm=DEPLOY_STAGING`.

## Testes
- tests/firebase/firestore.rules.test.ts: teste novo (coordenador exclui colaborador da equipe; nega
  outra equipe, admin, gestor, a própria conta, colaborador excluindo colega) e o teste antigo
  ajustado. NÃO executados aqui (emulador indisponível na rede do ambiente): rodar
  `npm run test:firestore-rules` antes de publicar.
- 4 testes de fronteira da tela Usuários atualizados para o ramo do admin (intenção preservada).
- vitest 1517 ok · typecheck ok · lint 0 erros · test:boundaries 511/511 · build:apps ok ·
  validate:firebase-contract ok.
