# Bootstrap do primeiro ADMIN_SISTEMA no staging

Operação manual, feita uma única vez por projeto de staging. Não existe (nem
deveria existir) um caminho para isso via Firestore Rules: `create` em
`usuarios/{login}` com `perfil: 'ADMIN_SISTEMA'` exige que quem está
autenticando já seja `souAdminSistema()` — o mesmo chicken-and-egg que o
bootstrap do primeiro gestor sempre teve (ver `seed/README.md`).

## Por que Console e não um script

O seed original (`seed/`) usa só o SDK cliente e publica temporariamente
regras de bootstrap mais permissivas (`seed/firebase.bootstrap.json`) para
fazer a carga inicial. Reabrir esse mesmo mecanismo num ambiente de staging
já em uso real — com contas de gestores e dados de escala de verdade — é mais
risco do que o problema que resolve: por alguns minutos as regras ficariam
mais abertas para todo mundo autenticado, não só para a conta fazendo o
bootstrap.

A alternativa mais simples e mais segura: editar o documento direto pelo
**Console do Firebase**. O Console usa a permissão de IAM do seu usuário
Google no projeto — não passa pelas Firestore Security Rules — então não
precisa de nenhuma regra especial, script novo, nem credencial de Admin SDK
(que este repositório não possui).

## Passo a passo

1. Abra o [Console do Firebase](https://console.firebase.google.com/), projeto
   de staging (`escala-ici-staging` ou equivalente) → **Firestore Database**.
2. Vá até a coleção `usuarios` e abra o documento do login que vai virar
   admin (ex.: `usuarios/marina.azevedo` — pode ser um gestor já existente ou
   um cadastro novo, desde que o `login` do documento já exista em
   **Authentication** com login por e-mail/senha funcionando).
3. Adicione (ou edite) os campos:

   | Campo | Valor |
   |---|---|
   | `perfil` | `"ADMIN_SISTEMA"` (string) |
   | `escopo` | `"GLOBAL"` (string) |
   | `nivelHierarquico` | `0` (number) |

   Não altere `login`, `equipeId` nem nenhum outro campo existente.
4. Salve o documento no Console.
5. Peça para essa pessoa recarregar a sessão do Dashboard (logout/login, ou
   F5 se a sessão já estiver ativa). O item **Administração** deve aparecer
   no menu lateral.

A partir daqui, esse usuário já é `ADMIN_SISTEMA` de verdade: usa a própria
tela **Administração** (card "Usuários") para conceder `perfil` a qualquer
outra conta — inclusive criar um segundo admin — sem repetir este passo
manual.

## Verificação

- No Dashboard, o menu lateral deve mostrar **Administração** logo abaixo de
  **Usuários**.
- Na tela Administração, os cards **Equipes**, **Setores** e **Usuários**
  devem listar dados de **todas** as equipes do staging, não só a do login
  usado para o bootstrap.
- Se o item não aparecer: confirme que `nivelHierarquico` ficou `<= 5`
  (senão o gate de login do Dashboard — `nivelPermiteDashboard`, independente
  de `perfil` — barra o acesso antes mesmo de chegar ao Dashboard) e que
  `perfil` foi salvo como a string exata `ADMIN_SISTEMA` (maiúsculas, sem
  espaços).

## Segurança

- Nunca faça esse bootstrap em produção sem alinhamento explícito — este
  documento é sobre o ambiente de **staging**.
- Trate o login promovido a admin como uma conta sensível: ele passa a poder
  ler/escrever em todas as equipes e excluir usuários/escalas globalmente
  (com as confirmações fortes já exigidas pela UI — digitar o login, digitar
  "EXCLUIR ESCALA" ou a competência).
- Não publique nem faça deploy de nenhuma regra "temporária" mais permissiva
  para repetir esse processo — se precisar de um segundo admin, use o próprio
  card "Usuários" da tela Administração (uma vez que o primeiro já existe).
