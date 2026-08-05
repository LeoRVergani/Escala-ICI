# Checkpoint — Fase 3K-D2C (vínculo Auth UID ↔ usuarios/{uid})

## Objetivo

Corrigir o erro "Seu usuário autenticado não está cadastrado no Firestore."
no PWA, causado por um cadastro criado com ID temporário (`usuario-...` /
`pendente-...`) cujo campo `uid` foi editado manualmente para o UID real —
sem criar o documento correto.

## Causa raiz

`usuarios/{uid}` usa o **ID do documento** como chave de busca — é assim que
`resolverUsuarioAutenticado()` (`lib/firebase/authRepository.ts`) sempre
funcionou: `getDoc(doc(db, 'usuarios', uid))`. Editar o campo `uid` **dentro**
de um documento não move nem renomeia o documento; o Firestore continua
indexando por ID. Pior: `lerUsuario(uid, dados)` (`lib/firebase/shared.ts`)
sempre usa `snapshot.id` como `Usuario.uid`, nunca `dados.uid` — então o
próprio app nunca teria "visto" a edição manual, mesmo se ela fizesse
diferença. A Fase 3K-D2 já tinha documentado essa limitação exatamente
("o UID do documento não pode ser trocado depois de criado") mas não
oferecia nenhuma ação de correção — esta fase implementa essa ação.

## O que foi implementado

### 1. Ação "Vincular ao UID do Authentication"

`lib/firebase/writeRepository.ts` → `vincularUsuarioAoUid(usuarioAntigo, uidNovo)`:

- valida que o UID informado não é vazio e é diferente do atual;
- confere que `usuarios/{uidNovo}` **ainda não existe** (evita sobrescrever
  outro cadastro por engano);
- em um único `writeBatch` (atômico):
  - cria `usuarios/{uidNovo}` com os mesmos dados — `aliasesPlanilha`,
    `equipeId`, `cargo`, `login`, `turnoPadrao`, `ativo`, `nome`, `email`,
    `gestorUid`, `nivelHierarquico`, `criadoEm` — só troca `uid` e zera
    `pendenteVinculo`;
  - atualiza o documento antigo: `ativo: false` e `substituidoPorUid:
    uidNovo`. **Nunca chama `deleteDoc`** — nada é apagado automaticamente,
    conforme pedido.

Nenhuma Firestore Rule nova: a criação usa a regra de `create` já existente
(gestor da própria equipe) e a atualização usa a regra de `update` do
gestor introduzida na Fase 3K-D2 (que já proíbe mudar `equipeId`/`uid` pelo
update — e este fluxo não tenta mudar nenhum dos dois no documento antigo).

### 2. Dashboard → Usuários

- linhas com `pendenteVinculo: true` (e ainda não `substituidoPorUid`)
  ganham um botão **"Vincular ao UID do Authentication"** (ícone de elo);
- abre um modal simples: cole o UID, confirme. O texto do modal explica
  exatamente o que vai acontecer (novo cadastro, dados copiados, antigo
  fica inativo, nada é apagado);
- linhas já vinculadas (`substituidoPorUid` preenchido) mostram um badge
  "Substituído" com o UID de destino no tooltip, e perdem o botão de
  vincular (a ação já foi feita).

### 3. Mensagens diferenciadas no login

`lib/firebase/authRepository.ts` ganhou `resolverUsuarioAutenticado(uid)`,
usada tanto na restauração de sessão quanto no login manual (antes havia
duas cópias quase idênticas do mesmo `getDoc` + `if (!exists)`):

| Situação | Mensagem |
|---|---|
| `usuarios/{uid}` não existe | `MENSAGEM_SEM_PERFIL_FIRESTORE` — "...Peça ao gestor da sua equipe para vincular seu acesso pelo Dashboard, em Usuários." |
| existe mas `ativo === false` | `MENSAGEM_PERFIL_INATIVO` — "...Peça ao gestor da sua equipe para reativar seu acesso." (verificação nova — antes o login não checava `ativo` de forma alguma) |
| existe, ativo, sem escala publicada no período | já existia (`EmployeeApp.autenticar`, mensagem inline, não bloqueia login) — mantida, não é mais confundida com as duas de cima |

Ambas as constantes são exportadas, para o Dashboard (ou testes futuros)
poderem reagir ao texto exato sem duplicar a string.

### 4. Preparação para autenticação Microsoft (documentação)

[AUTENTICACAO-MICROSOFT.md](AUTENTICACAO-MICROSOFT.md) — design de como a
resolução de usuário se estenderia para um segundo provedor (Microsoft/
Entra ID): campo `microsoftOid` opcional, cascata de resolução
`auth.uid` → `microsoftOid` → `email`, e os pontos que exigiriam decisão de
segurança própria (índices compostos, regra de leitura pré-vínculo). Nada
disso foi implementado — é só o ponto de partida documentado, como pedido.

## Firestore Rules

**Não alteradas.** O fluxo de vínculo usa exclusivamente as regras de
`create`/`update` de `usuarios/{uid}` já existentes desde a Fase 3K-D2.

## Testes

- `npm run typecheck` / `typecheck:apps` — ✅;
- `npm run test:boundaries` — ✅ 36 (1 novo, cobre: função exclusiva do
  Dashboard, mensagens exportadas sem duplicação, campo novo no modelo,
  `deleteDoc` ausente no fluxo de vínculo);
- **Sem teste de integração Firestore para `vincularUsuarioAoUid`.**
  `tests/firebase/firebase.integration.test.ts` testa comportamento de
  *regras* com múltiplas instâncias paralelas de `FirebaseApp` (uma por
  usuário simulado); `lib/firebase/writeRepository.ts` inteiro depende do
  singleton de app (`obterFirebase()`), então nenhuma função desse arquivo
  — nem as que já existiam — é chamada diretamente por aquele teste; ele
  reimplementa os batches manualmente para testar a regra, não a função.
  Seguir esse mesmo padrão para `vincularUsuarioAoUid` só testaria uma
  reimplementação do batch, não o código real. Validar isso exige teste
  manual (abaixo) ou uma refatoração maior de `writeRepository.ts` para
  aceitar um `Firestore` injetado — fora do escopo deste fix.

## Teste manual de aceite

1. Dashboard → Usuários → localizar um colaborador com badge "Pendente de
   vínculo";
2. clicar no ícone de elo → colar o UID real do Firebase Authentication
   (copiado do console) → Vincular;
3. confirmar: aparece um NOVO cadastro com aquele UID; o antigo virou
   "Inativo" + "Substituído";
4. abrir o PWA com a conta dessa pessoa → confirmar que **não aparece mais**
   "não está cadastrado no Firestore" e a escala carrega normalmente;
5. desativar um usuário qualquer (Ativar/Desativar) e tentar logar com a
   conta dele → confirmar a mensagem "perfil está cadastrado, mas está
   inativo" (antes o login nem checava isso).

## Pendências

- sem teste de integração Firestore para `vincularUsuarioAoUid` (ver acima);
- autenticação Microsoft é só documentação — zero código;
- remoção física do cadastro antigo "substituído" continua fora do escopo
  (mesma decisão da Fase 3K-D2): o gestor pode limpar manualmente pelo
  Firebase Console se quiser, o app nunca apaga automaticamente.

## Riscos

- a checagem de `ativo` agora bloqueia login de qualquer usuário inativo
  que hoje conseguia entrar — mudança de comportamento intencional (pedida
  explicitamente), mas vale confirmar em staging que nenhuma conta de teste
  ativa hoje está marcada `ativo: false` por engano;
- nenhuma alteração em produção; nenhum `.env` tocado; nenhum secret
  commitado; arquivos novos em LF.
