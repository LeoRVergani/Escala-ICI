# Checkpoint — Fase 3K-D2D (correção urgente: undefined no Firestore, toast atrás do modal)

## Objetivo

Corrigir a publicação bloqueada por `setDoc() called with invalid data.
Unsupported field value: undefined found in field criadoEm in document
usuarios/usuario-a960...`, e a UX confusa de o erro real aparecer atrás do
modal de publicação.

## Causa raiz

### 1. `criadoEm: undefined`

`lerUsuario()` (`lib/firebase/shared.ts`) sempre define a chave `criadoEm`
no objeto `Usuario`, mesmo quando o documento no Firestore não tem esse
campo (`typeof dados.criadoEm === 'string' ? dados.criadoEm : undefined`).
Isso é diferente de "a chave não existir": o objeto JS resultante **tem** a
propriedade `criadoEm`, só que com valor `undefined`.

`usuario-a960...` é um cadastro de antes da Fase 3K-D2 (quando `criadoEm`
passou a existir) — o Firestore nunca teve esse campo para essa pessoa.
Qualquer ação que regravasse o objeto inteiro (editar cadastro, ativar/
desativar, salvar alias, vincular ao UID real) propagava esse
`criadoEm: undefined` de volta para `setDoc()`/`updateDoc()`, e o Firestore
recusa qualquer campo `undefined` — daí o erro observado.

Isso não tinha relação direta com o botão "Publicar": o erro veio de uma
ação de usuário/conciliação feita **antes**, cujo toast ficou escondido
(ver item 2) até o modal de publicação abrir por cima dele, dando a
impressão de que a publicação em si travou.

### 2. Toast atrás do modal

`.toast { z-index: 100; }` era **menor** que `.modal-backdrop { z-index:
200; }`. Qualquer erro reportado via `setMensagem()` enquanto um modal
estava aberto ficava fisicamente atrás dele — invisível, mesmo que o código
estivesse funcionando corretamente.

### 3. "Regras do laboratório" em staging

`mensagemErroFirebase()` respondia a **qualquer** `permission-denied` com o
mesmo texto fixo ("...reinicie o Firebase local"), mesmo rodando contra o
Firebase de staging, onde não existe emulador nenhum para reiniciar.

## O que foi implementado

### `lib/firebase/sanitizar.ts` (novo)

`removerUndefined()` — remove recursivamente chaves com valor `undefined`
de objetos e arrays. Preserva `null` (valor válido e diferente de
`undefined`), preserva arrays e objetos aninhados, e **preserva sem alterar**
qualquer valor que não seja um objeto literal simples — `Date`,
`Timestamp`, e principalmente os sentinels do SDK (`serverTimestamp()`,
`arrayUnion()`, `deleteField()`): a checagem é
`Object.getPrototypeOf(valor) === Object.prototype`, que só é verdadeira
para `{}`-literais, nunca para instâncias de classe do SDK.

### `lib/firebase/writeRepository.ts`

- `removerUndefined()` aplicado a **todo** payload de `setDoc`/`batch.set`
  do arquivo (`salvarRascunho`, `publicarEscalas`, `reverterPublicacao`,
  `salvarUsuario`, `salvarUsuarios`, `vincularUsuarioAoUid`,
  `adicionarMembroRascunho`) — não só nos pontos que tocam `usuarios`. O
  risco real está concentrado em `usuarios` (é a única coleção com um campo
  opcional que só passou a existir depois que documentos antigos já
  existiam), mas a correção é barata e seguramente não quebra nada onde já
  não havia `undefined` (a função é um no-op nesse caso), então apliquei de
  forma ampla como pedido.
- `salvarUsuario`/`salvarUsuarios` usam `merge: true` (ou `batch.set` sem
  merge no caso de `salvarUsuarios`, que sempre cria/sobrescreve
  completamente) — com `removerUndefined()`, um `criadoEm` ausente
  simplesmente não é enviado, então nunca sobrescreve nem apaga o que já
  existe;
- `vincularUsuarioAoUid`: `criadoEm: usuarioAntigo.criadoEm ?? agora` — se o
  cadastro antigo já tinha `criadoEm`, o novo documento herda o mesmo
  valor; se não tinha, ganha um timestamp novo (não fica com o campo
  ausente para sempre). `removerUndefined()` continua como rede de
  segurança para qualquer outro campo;
- `atualizarAliasesPlanilha(uid, aliasesPlanilha)` (novo): `updateDoc` só
  com `{ aliasesPlanilha, atualizadoEm }`, em vez de regravar o usuário
  inteiro — a conciliação de importação (`salvarAliasConciliacao` no
  Dashboard) passou a usar essa função, eliminando de vez o risco de
  propagar um `criadoEm` velho nessa ação específica.

### `lib/firebase/errors.ts`

`mensagemErroFirebase(falha, fallback, ambiente?)` ganhou um terceiro
parâmetro opcional (`'local' | 'staging' | 'producao' | 'indefinido'`,
padrão `'indefinido'`). Um `permission-denied`:

- em `local` → mantém o texto original ("...reinicie o Firebase local");
- em `staging` → "...regras do Firestore em staging. Verifique se sua
  conta tem permissão de gestor...";
- em qualquer outro caso (inclusive sem informar) → texto genérico, sem
  mencionar "laboratório".

Também ganhou um caso novo para `Unsupported field value: undefined`, como
rede de segurança adicional caso algum ponto de escrita futuro esqueça de
sanitizar: em vez de vazar o erro técnico do SDK, mostra uma mensagem
amigável pedindo para revisar o cadastro envolvido.

`lib/firebase/shared.ts` ganhou `ambienteFirebaseAtual` (reexporta
`politica.ambiente`, já calculado). Dashboard e App passaram a importar
esse valor e informá-lo em toda chamada de `mensagemErroFirebase` (12
pontos no Dashboard, 3 no App).

### Erro dentro do modal de publicação

`DashboardApp.tsx` ganhou o estado `erroPublicacao`, exibido dentro do
próprio modal (`.alert.error`), limpo ao abrir/fechar/cancelar. Todas as
validações de `publicar()` (login pendente, escrita bloqueada, conciliação
pendente, motivo curto) e o `catch` de falha real passaram a usar esse
estado — o modal nunca mais fica "parecendo travado" com o feedback preso
atrás dele. `publicar()` já não fechava o modal em caso de erro (isso já
estava certo); só faltava o erro ser visível.

### CSS — z-index do toast

`.toast` subiu de `z-index: 100` para `z-index: 260` — acima de
`.modal-backdrop` (200) e de `.pwa-messages` (140). Comentário no CSS
documenta a ordem de camadas para não se perder de novo.

## Testes

- `lib/firebase/sanitizar.test.ts` (novo, 9 testes): remove `undefined` em
  vários níveis; preserva `null`, arrays, objetos aninhados; preserva
  instâncias que não são objetos simples (incluindo um sentinel de teste
  parecido com `serverTimestamp()`) e `Date`; reproduz o caso real do bug
  (usuário antigo sem `criadoEm`/`atualizadoEm`);
- `lib/firebase/errors.test.ts` (novo, 8 testes): mensagem por ambiente
  (`local`/`staging`/`indefinido`/`producao`), detecção de
  `PERMISSION_DENIED` na mensagem além do código, e o novo caso de
  `Unsupported field value: undefined`;
- `npm run test:unit` — ✅ 149 testes;
- `npm run test:boundaries` — ✅ 38 (1 novo: sanitizador puro, escrita de
  usuários sempre sanitizada, alias-only via `updateDoc`, mensagens de
  erro com ambiente, erro dentro do modal, z-index do toast);
- `npm run test:firestore-rules` — ✅ 16 (regressão; nenhuma regra mudou,
  as novas gravações continuam usando exatamente os mesmos campos que as
  regras já validavam).

## Validação automatizada

Executado em 5 de agosto de 2026:

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run typecheck:apps` | ✅ |
| `npm run test:unit` | ✅ 149 |
| `npm run test:boundaries` | ✅ 38 |
| `npm run test:firestore-rules` | ✅ 16 (regressão) |
| `npm run build:dashboard` | ✅ |
| `npm run build:app:pages` | ✅ |
| `npm run validate:deployments` | ✅ |
| `npm run validate:pwa` | ✅ |
| `npm run firebase:staging:preflight` | ✅ `escala-ici-staging` |

## Firestore Rules

**Não alteradas.** Os campos gravados continuam os mesmos que as regras já
validam — a correção é inteiramente do lado do que o cliente envia, nunca
do que é permitido.

## Teste manual recomendado

1. Dashboard staging → localizar (ou criar via seed) um usuário sem
   `criadoEm` no Firestore (qualquer cadastro anterior à Fase 3K-D2);
2. editar esse usuário, ativar/desativar, ou salvar um alias para ele pela
   conciliação → confirmar que **não aparece** mais o erro de `criadoEm
   undefined`;
3. importar escala, conciliação OK, publicar → confirmar sucesso e nova
   revisão;
4. forçar um erro de permissão proposital (ex.: revogar temporariamente a
   escrita administrativa) e publicar → confirmar que a mensagem aparece
   **dentro do modal**, menciona "staging" (não "laboratório"), e o modal
   continua aberto e utilizável;
5. confirmar visualmente que qualquer toast aparece **acima** de modais
   abertos.

## Pendências

- não foi feita nenhuma migração retroativa dos cadastros antigos sem
  `criadoEm` — eles continuam sem esse campo até a próxima vez que forem
  salvos (o que já é seguro agora); se quiser preenchê-lo proativamente
  para todo mundo, isso é uma ação separada, deliberada, fora do escopo
  desta correção urgente;
- `Unsupported field value: undefined` como mensagem de fallback é uma rede
  de segurança, não uma garantia adicional — a garantia real é
  `removerUndefined()` nos pontos de escrita.

## Riscos

- `salvarUsuarios()` (import em lote) sobrescreve o documento inteiro
  (sem `merge`) — isso já era o comportamento antes; `removerUndefined()`
  só evita que um `undefined` acidental quebre a escrita, não muda a
  semântica de substituição total;
- nenhuma alteração em produção; nenhum `.env` tocado; nenhum secret
  commitado; nenhum `deleteDoc` usado; arquivos novos em LF.
