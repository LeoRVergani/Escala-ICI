# Checkpoint — Fase 3K-D2

## Objetivo

Parar de depender de edições manuais no Firestore para testar a escala com
contas reais (ex.: `caio.monteiro@example.com`). Isso exigia duas coisas: o
Dashboard conseguir gerenciar usuários de fato (hoje só existe um botão que
cria um colaborador fictício com UID aleatório) e a importação XLS conseguir
conciliar o nome da planilha com o usuário certo sem que o texto precise ser
idêntico ao login cadastrado.

## Causa raiz

1. **Sem edição de usuário.** O Dashboard só tinha `adicionarUsuario()`,
   que chamava `novoUsuario()` com valores totalmente fictícios
   (`novo.login{n}`, uid aleatório). Não havia como editar nome, e-mail,
   cargo, nível, turno ou status de alguém já cadastrado — e as Firestore
   Rules também não permitiam: `allow update` em `usuarios/{uid}` só
   liberava o próprio usuário alterar o próprio campo `nome`.
2. **UID nunca correspondia a uma conta real.** `novoUsuario()` sempre gerava
   `usuario-${uuid()}` como ID do documento. Como o documento é indexado pelo
   UID do Firebase Authentication, esse colaborador nunca conseguia
   autenticar — por isso a única forma de testar com um e-mail real era
   editar o `nome` de um documento existente direto no Firestore.
3. **Conciliação de planilha inexistente.** `parsePlanilhaEscala` compara o
   texto da coluna de colaborador com `loginParaUid` por **igualdade exata de
   string**. Sem uma etapa de conciliação, qualquer diferença de acento,
   caixa, espaço ou uso de nome completo em vez de login gerava
   "Login não encontrado", sem caminho de correção além de editar a
   planilha ou o cadastro manualmente.

## O que foi implementado

### Modelo de usuário (`lib/modelos.ts`, `lib/firebase/shared.ts`)

`Usuario` ganhou campos opcionais, todos compatíveis com documentos já
existentes:

- `aliasesPlanilha?: string[]` — nomes alternativos vindos da planilha, para
  comparação normalizada (diferente de `loginAliases`, que já existia e
  continua sendo comparado por igualdade exata, como o parser sempre fez);
- `pendenteVinculo?: boolean` — `true` quando o UID do documento é
  provisório (não corresponde a uma conta real do Authentication);
- `criadoEm?` / `atualizadoEm?: string` — ISO string, no mesmo padrão que
  `TurnosMes` já usa (não Firestore `Timestamp`, para manter o tipo simples
  e consistente com o resto do projeto).

`lerUsuario()` foi atualizada para ler os três campos novos com o mesmo
padrão defensivo do restante da função.

### Normalização e conciliação (`lib/nomes.ts`, `lib/conciliacaoUsuarios.ts`)

- `normalizarNome()`: remove acentos, aplica trim, minúsculas, colapsa
  espaços — reaproveita `normalizarTexto()` do pacote `contrato` em vez de
  duplicar a lógica de remoção de acentos.
- `conciliarNome()` / `conciliarPlanilha()`: classificam cada nome distinto
  da planilha em um dos 7 status (`VINCULADO_UID`, `VINCULADO_ALIAS`,
  `PRECISA_MAPEAR`, `USUARIO_INATIVO`, `USUARIO_NAO_ENCONTRADO`,
  `CONFLITO_ALIAS`, `IGNORADA`), seguindo estritamente a ordem de precedência
  pedida: login/e-mail exato → alias/nome normalizado exato → decisão
  manual. **Nunca** aproxima por semelhança — "Caio M." não vira
  "Caio Monteiro" sozinho, e uma correspondência inativa nunca é vinculada
  automaticamente.
- `publicacaoBloqueadaPorConciliacao()` / `contarPendenciasConciliacao()`:
  regra pura de bloqueio, usada tanto na UI quanto nas guardas de
  salvar/publicar.
- `resolverManualmente()`, `marcarPendente()`, `ignorarLinha()`:
  transições puras acionadas pelas ações do gestor na tabela.
- `loginParaUidComConciliacao()`: estende o `loginParaUid` existente com os
  vínculos resolvidos, para o Dashboard chamar `parsePlanilhaEscala` de novo
  sem precisar alterar o parser do pacote `contrato`.

Módulo 100% puro — sem `firebase/firestore`, sem mutação. Teste de fronteira
garante isso.

### Cadastro e edição de usuário (`lib/importUsers.ts`)

- `novoUsuario()` ganhou dois parâmetros opcionais no final (compatível com
  a chamada existente em `cadastrarFaltantes()`): `uidAutenticacao` — quando
  informado, o UID real do Firebase Authentication passa a ser o ID do
  documento, e `pendenteVinculo` fica `false`; sem ele, o UID continua
  provisório (`pendente-...`, antes `usuario-...`) e `pendenteVinculo` fica
  `true`. `agora` — para o timestamp ficar determinístico em teste.
- `validarEdicaoUsuario()`: nome/e-mail/login não vazios, e-mail com formato
  válido, login sem colisão com outro colaborador da equipe, nível
  hierárquico válido.
- `normalizarAliasesPlanilha()`: remove vazios e duplicados normalizados,
  preservando a primeira grafia digitada.

### Dashboard — tela "Usuários"

- tabela agora mostra também **aliases da planilha** e um badge
  **"Pendente de vínculo"** quando o UID é provisório;
- botão de **editar** (abre modal com todos os campos do formulário pedido:
  nome, e-mail, login, cargo, equipe — somente leitura, é sempre a do
  gestor —, nível hierárquico, turno padrão, ativo, aliases da planilha);
- botão de **ativar/desativar** direto na linha, sem abrir o modal;
- **cadastro** passa pelo mesmo modal; só ao criar aparece o campo
  "UID de autenticação (opcional)", com a explicação de que, sem ele, o
  cadastro nasce "pendente de vínculo" e que o UID do documento não pode ser
  trocado depois — é o limite explícito mencionado na tarefa
  ("se o projeto exigir UID como ID obrigatório, manter esse contrato e
  documentar a limitação"). Não há criação de conta no Firebase
  Authentication nesta fase — é sempre o gestor quem cola o UID já existente.

### Dashboard — conciliação após importação XLS

Fluxo incremental sobre o que já existia, sem reescrever o parser:

```
Importar XLS → parse com loginParaUid atual
             → conciliarPlanilha() sobre o texto de cada linha
             → parse de novo com loginParaUid estendido pela conciliação
             → tabela de conciliação + prévia da escala
```

A tabela mostra exatamente as 4 colunas pedidas (nome da planilha, usuário
vinculado — um `<select>` que também permite escolher manualmente —, status,
ações) e as ações: **salvar alias** (grava em `aliasesPlanilha` do usuário
escolhido, para os próximos imports pararem de pedir conciliação para esse
nome), **marcar como pendente**, **ignorar linha**. `salvarRascunho()` e
`publicarEscalas()` ficam bloqueados enquanto houver qualquer linha que não
seja `VINCULADO_UID`, `VINCULADO_ALIAS` ou `IGNORADA` — a mensagem deixa
claro o motivo do bloqueio.

### Dashboard — descartar rascunho não publicado

Botão "Descartar rascunho" na tela **Escalas**, visível só quando a escala
carregada tem documentos não publicados, com modal de confirmação (ação
local — a última escala publicada da equipe não é afetada). Chama
`excluirRascunho()` para cada documento em `RASCUNHO`, que já existia em
`writeRepository.ts` mas não estava conectado a nenhum botão.

**Fora do escopo, por decisão explícita:** status `arquivada`/`cancelada`
para `TurnosMes`. O tipo `status: 'RASCUNHO' | 'PUBLICADA'` é compartilhado
pelo pacote `contrato`, pelo parser, pelas Firestore Rules e por testes de
integração — estender isso teria alcance muito maior que o pedido desta
fase e a própria tarefa permite documentar a limitação em vez de forçar a
mudança.

### Base da troca de escala (`lib/trocaEscala.ts`)

Adicionado `validarElegibilidadeTroca()`, que recebe os dois usuários e as
duas escalas envolvidas e verifica: ambos ativos, mesma equipe, mesma
competência, e as duas escalas com `status: 'PUBLICADA'` (cobre também
"não pode envolver escala arquivada/cancelada" — como esses status não
existem, ser estritamente `PUBLICADA` já exclui qualquer outro estado
presente ou futuro). Descanso mínimo entre turnos **não foi implementado**:
não existe nenhuma função reutilizável de descanso mínimo no pacote
`contrato` hoje, e a própria tarefa condicionava essa validação à
reutilização de algo que já existisse.

Continua tudo puro e não implementado — nenhuma escrita, nenhuma tela, sem
alteração de Firestore Rules para `solicitacoesTroca`.

## Firestore Rules — alteradas

`usuarios/{uid}` ganhou uma segunda condição de `update`, mantendo a
primeira (colaborador só altera o próprio `nome`):

```
allow update: if autenticado()
  && (
    (request.auth.uid == uid && ...affectedKeys().hasOnly(['nome']))
    || (
      souGestor()
      && resource.data.equipeId == minhaEquipe()
      && request.resource.data.equipeId == resource.data.equipeId
      && request.resource.data.uid == resource.data.uid
    )
  );
```

O gestor só edita colaboradores da própria equipe, e não pode usar o update
para mudar `equipeId` (mover alguém de equipe) nem `uid` (o campo espelha o
ID do documento). `solicitacoesTroca` continua **fora** das regras — um teste
de fronteira garante isso.

4 casos novos em `tests/firebase/firestore.rules.test.ts` (16 no total,
todos aprovados com o emulador):

- gestor edita cargo/ativo/aliases de colaborador da própria equipe;
- gestor não consegue mudar `equipeId` nem `uid` pelo update;
- gestor não edita usuário de outra equipe;
- colaborador comum não edita outro colaborador.

## Validação automatizada

Executado em 5 de agosto de 2026:

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run typecheck:apps` | ✅ Dashboard + App |
| `npm run test:unit` | ✅ 107 testes (35 novos: nomes, conciliação, importUsers, trocaEscala) |
| `npm run test:boundaries` | ✅ 32 testes (2 novos) |
| `npm run test:firestore-rules` | ✅ 16 testes (4 novos, emulador local) |
| `npm run firebase:staging:preflight` | ✅ `escala-ici-staging`, sem expor credenciais |
| `npm run build:app:pages` / `build:dashboard` | ✅ |
| `npm run validate:pwa` / `validate:deployments` | ✅ |

`npm run build:app:staging` continua bloqueado nesta cópia de trabalho por
`.env.staging.app` não existir (arquivo gitignored, só o `.example` é
versionado) — mesma situação registrada na Fase 3K-D1, não recriada aqui por
segurança.

## Status por área

- **Gestão de usuários:** implementada — listar, cadastrar (com ou sem UID
  real), editar, ativar/desativar. Falta: exclusão física (fora do escopo,
  por decisão) e criação de conta no Authentication pelo próprio Dashboard.
- **Aliases da planilha:** implementados — cadastro manual pelo formulário e
  "salvar alias" direto na conciliação após um import.
- **Conciliação de importação:** implementada como etapa incremental entre
  preview e salvar/publicar, sem alterar `packages/contrato`.
- **Gestão básica de escalas:** só o item seguro (descartar rascunho não
  publicado) foi implementado. Arquivamento de escala publicada foi
  deliberadamente adiado.
- **Troca de escala:** ainda é só contrato e validações puras (Fase 3K-D1 +
  D2). Nenhuma tela, nenhuma escrita, nenhuma regra nova.

## Teste manual de aceite

1. Dashboard local → **Usuários** → cadastrar usuário com nome "Caio
   Monteiro", e-mail `caio.monteiro@example.com` e o UID real copiado do
   Firebase Authentication;
2. adicionar o alias "Caio M." (ou o texto que a planilha realmente usa)
   pelo mesmo formulário;
3. **Importar escala** → carregar a planilha real → confirmar que a linha de
   Caio aparece já **vinculada por alias**, sem editar a planilha nem o
   cadastro manualmente;
4. salvar rascunho e publicar;
5. abrir o PWA com a conta de Caio e confirmar que a escala aparece.

## Riscos

- A regra de `update` em `usuarios` amplia a superfície de escrita do
  gestor — mitigado por restringir à própria equipe e impedir a troca de
  `equipeId`/`uid`; os 4 testes novos do emulador cobrem exatamente essas
  bordas.
- Reparsing duplo na conciliação (parse → concilia → reparse) roda a cada
  interação da tabela; para o tamanho de planilha do projeto isso é
  imperceptível, mas é um padrão a rever se a equipe crescer muito.
- Nenhuma alteração em produção; nenhum `.env` tocado; nenhum secret
  commitado; todos os arquivos novos em LF.
