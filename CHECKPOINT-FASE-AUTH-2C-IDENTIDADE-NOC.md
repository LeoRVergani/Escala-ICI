# CHECKPOINT — FASE AUTH-2C — Correção de cargo SOC para usuários de outras equipes

- **Branch**: `main`
- **HEAD anterior a esta fase**: `3f171cb`
- **Push**: NÃO realizado nesta fase (8 commits pendentes antes desta
  correção, mais este commit — ver seção Git ao final).

## Contexto

Durante a validação real da AUTH-2 com uma conta corporativa do time NOC,
o login Microsoft, a resolução do Firebase e a autorização do Dashboard
funcionaram corretamente — mas a tela **Perfil** da PWA exibiu
`ANALISTA_SOC` como cargo do colaborador NOC, o que é visivelmente
incorreto.

## Causa raiz (comprovada pelo código, não suposta)

### `cargo` e `perfil` são conceitos completamente diferentes

`lib/modelos.ts`:

```ts
cargo: string;           // texto livre, puramente descritivo/UX
perfil?: PerfilUsuario;  // autorização explícita — opcional
```

`cargo` **nunca** é lido por `firestore.rules` (confirmado por
`grep -n cargo firestore.rules` → nenhuma ocorrência) nem por
`perfilEfetivo()`/`nivelPermiteDashboard()` (`lib/sessao.ts`) — é usado
exclusivamente para exibição: `apps/app/src/EmployeeApp.tsx:2501`,
`<strong>{usuario.cargo}</strong>` na tela Perfil, e como coluna de
listagem no Dashboard (`apps/dashboard/src/DashboardApp.tsx:3915`).

### Onde o valor incorreto era escrito (dois pontos, ambos confirmados)

1. **`lib/importUsers.ts:34`, função `novoUsuario()`** — usada por
   `cadastrarFaltantes()` (`apps/dashboard/src/DashboardApp.tsx`) para
   auto-registrar, **e salvar diretamente no Firestore sem passar por
   nenhum formulário**, qualquer login presente na planilha de escala mas
   ainda ausente em `usuarios/{login}`. Tinha `cargo: 'ANALISTA_SOC'`
   fixo, **independente de `gestor.equipeId`** — apesar de já usar
   corretamente `equipeId: gestor.equipeId` para a equipe.
2. **`apps/dashboard/src/DashboardApp.tsx:2630`, função
   `abrirNovoUsuario()`** — pré-preenchia o campo de texto livre "Cargo"
   do formulário manual "Novo colaborador" com o mesmo literal
   `'ANALISTA_SOC'`. Se o gestor não alterasse o campo antes de salvar
   (não havia validação exigindo isso), o valor persistia como se fosse
   informação real.

Ambos os pontos eram a mesma classe de bug: um valor específico de uma
equipe (SOC) usado como default universal para um campo que deveria
refletir a área real do colaborador.

### `perfil` nunca foi afetado — autorização sempre esteve correta

`novoUsuario()` nunca define `perfil` (fica `undefined`). `perfilEfetivo()`
(`lib/sessao.ts`) cai no fallback documentado: `nivelHierarquico <= 5` →
`GESTOR_EQUIPE`, senão → `ANALISTA_SOC` — um rótulo **interno**, usado só
para decidir autorização (`nivelPermiteDashboard`), **nunca exibido ao
usuário**. Isso explica por que a autorização do colaborador NOC sempre
funcionou certo (mesmo nível de "colaborador comum" que SOC/Suporte) —
só a exibição de `cargo` estava errada.

## Modelo de dados — decisão

Preservado exatamente como já estava (nenhuma mudança de arquitetura):

- `cargo` = texto livre, descritivo, sem efeito de autorização.
- `perfil` = autorização explícita, opcional, só ADMIN_SISTEMA define.
- `equipeId` = organização/agrupamento, nunca usado como autorização por
  si só.

## Decisão sobre `ANALISTA_NOC` — **não criado**, com justificativa

Avaliado explicitamente conforme pedido. **Não foi adicionado** a
`PerfilUsuario`. Motivo:

- O bug relatado nunca envolveu `perfil` — envolveu exclusivamente
  `cargo`, um campo de texto livre sem qualquer enum.
- `perfil` já documenta que `ANALISTA_SOC`/`ANALISTA_SUPORTE` representam
  o **mesmo alcance de autorização** ("colaborador comum"), com nomes
  distintos só quando um ADMIN_SISTEMA explicitamente escolhe refletir a
  área real de alguém — não é obrigatório, e a ausência de `perfil` já
  funciona corretamente hoje via fallback.
- Criar `ANALISTA_NOC` apenas para "combinar" com o nome da equipe seria
  estética pura: não muda nenhuma regra de autorização, não corrige o bug
  relatado (que é 100% sobre `cargo`), e infla o enum sem necessidade
  funcional comprovada.
- Se, no futuro, o Dashboard precisar filtrar/reportar por área via
  `perfil` (não via `cargo` ou `equipeId`), essa é uma decisão de produto
  separada, não uma correção de bug.

## Correção implementada

### 1. `lib/importUsers.ts` — `novoUsuario()`

```diff
- cargo: 'ANALISTA_SOC',
+ cargo: '',
```

`cargo` nasce vazio para qualquer equipe — nunca infere um valor a partir
da escala importada nem do gestor que disparou o cadastro em lote.

### 2. `lib/importUsers.ts` — `validarEdicaoUsuario()`

Nova validação, no mesmo padrão de nome/e-mail/login já existentes:

```diff
+ if (editado.cargo.trim() === '') {
+   erros.push('Informe o cargo do colaborador.');
+ }
```

Fecha o ciclo: um cadastro em lote nasce com `cargo` vazio (nunca com um
valor errado de outra equipe), e a próxima vez que um gestor abrir esse
cadastro pelo formulário "Editar colaborador" para completá-lo, não
consegue salvar sem preencher um cargo real.

### 3. `apps/dashboard/src/DashboardApp.tsx` — `abrirNovoUsuario()`

```diff
- cargo: 'ANALISTA_SOC',
+ cargo: '',
```

O formulário manual "Novo colaborador" também deixa de sugerir um cargo
específico de SOC — o campo "Cargo" nasce vazio, e a mesma validação do
item 2 impede salvar sem preenchê-lo.

### O que NÃO foi alterado

- `lib/demoIdentidades.ts` (`USUARIOS_DEMO`) e `seed/seed.ts` — ambos
  fixam `cargo: 'ANALISTA_SOC'`, mas são dados fictícios de demonstração
  e do laboratório local, onde **toda** a equipe simulada é
  deliberadamente SOC (`equipeId: 'EQ_SOC'`/`EQUIPE_DEMO.id`). Não é o
  bug relatado — é a persona fictícia esperada do modo Demo/laboratório.
  Confirmado e deixado intocado.
- `PerfilUsuario`, `perfilEfetivo()`, `firestore.rules` — nenhuma mudança;
  não eram a causa e não precisavam mudar (ver seção acima).
- `usuarios/{login}` como identidade funcional, `LoginPanel`,
  `authRepository` — nenhum tocado; login Microsoft/e-mail continuam
  100% independentes de `cargo`/`perfil`.

## Compatibilidade

- Nenhuma migração de dado foi executada. Documentos existentes com
  `cargo` preenchido (inclusive `'ANALISTA_SOC'` genuíno, para
  colaboradores reais de SOC) continuam exatamente como estão — a
  mudança só afeta o valor **default** usado na criação de novos
  cadastros a partir de agora.
- `lib/firebase/shared.ts` (`lerUsuario()`) já lia `cargo` com fallback
  `String(dados.cargo ?? '')` — documentos sem o campo (ou com valor
  vazio) sempre foram lidos sem erro. Nenhuma mudança necessária ali.
- `perfil` ausente continua caindo no mesmo fallback de sempre — nenhum
  usuário existente muda de autorização.

## Testes

`lib/importUsers.test.ts` — 4 testes novos, todos os 10 anteriores
preservados sem alteração de expectativa:

- `novoUsuario()` nasce com `cargo: ''` para um gestor de equipe SOC.
- `novoUsuario()` nasce com `cargo: ''` para um gestor de equipe NOC —
  nunca herda `'ANALISTA_SOC'`.
- `novoUsuario()` nasce com `cargo: ''` para um gestor de equipe de
  Suporte — nunca herda `'ANALISTA_SOC'`.
- `novoUsuario()` nunca define `perfil` — autorização continua vindo do
  fallback por `nivelHierarquico` (comportamento inalterado).
- `validarEdicaoUsuario()` — teste existente de campos vazios estendido
  para cobrir `cargo` vazio também.

Autorização (`nivelPermiteDashboard`), independência de
login Microsoft/cargo/perfil, e `usuarios/{login}` como identidade
funcional já estavam cobertos por `lib/sessao.test.ts` e
`lib/firebase/authRepository.test.ts` — nenhum desses precisou mudar,
pois esta correção não toca nenhum desses caminhos.

## Resultado dos testes (real)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run typecheck:apps` | ✅ |
| `npm run typecheck:worker` | ✅ |
| `npm run test:unit` | ✅ 512/512 (41/41 arquivos — 4 testes novos) |
| `npm run test:boundaries` | ✅ 102/102 |
| `npm run test:push-worker` | ✅ 48/48 |
| `npm run test:firestore-rules` | ✅ 122/122 |
| `npm run test:firebase-integration` | ⚠️ 123/126 — exatamente as mesmas 3 falhas pré-existentes, nenhuma quarta |
| `npm run lint` | ✅ 0 erros, 5 warnings (mesmos de sempre) |
| `npm run build:app:pages` | ✅ + "Cloudflare Pages validado" |
| `npm run validate:pwa` | ✅ |
| `npm run validate:artifact` | ✅ |
| `git diff --check` | ✅ limpo |

## Comportamento antes/depois

| Cenário | Antes | Depois |
|---|---|---|
| Import de escala com login NOC ausente de `usuarios/` | `cargo: 'ANALISTA_SOC'` salvo automaticamente | `cargo: ''` salvo — gestor completa depois |
| Formulário manual "Novo colaborador" sem editar o campo Cargo | Salvava `'ANALISTA_SOC'` silenciosamente | Bloqueado por validação: "Informe o cargo do colaborador." |
| Autorização de um colaborador NOC/Suporte comum | Já correta (nível de colaborador comum) | Inalterada — continua correta |
| Perfil exibido na PWA para um colaborador NOC | "ANALISTA_SOC" (errado) | Em branco até o gestor preencher o cargo real (nunca mais herda SOC) |

## Ajuste manual necessário em staging (`escala-ici-staging`)

O documento Firestore do usuário NOC testado durante a AUTH-2
provavelmente já foi persistido com `cargo: 'ANALISTA_SOC'` **antes**
desta correção (a correção não faz migração retroativa nem corrige dados
automaticamente — apenas evita que o problema se repita para novos
cadastros). Para corrigir o cadastro já existente:

1. Abrir o Dashboard staging → **Usuários** → localizar o colaborador NOC
   afetado → **Editar colaborador**.
2. Alterar o campo **Cargo** para o cargo real da pessoa (texto livre,
   ex.: "Analista NOC", "Analista de Monitoramento", conforme o cargo
   real dela na organização).
3. Salvar — a validação agora exige que o campo não fique vazio.

Nenhum outro campo (`perfil`, `nivelHierarquico`, `equipeId`) precisa ser
alterado — a autorização daquele usuário já estava correta.

**Nenhuma alteração foi feita diretamente em `escala-ici-staging` por
este agente** — o ajuste acima é uma ação manual a ser feita pelo gestor,
deliberadamente, para não mascarar a causa raiz antes de confirmá-la (e
porque a correção do documento em produção/staging real está fora do
escopo automatizável — é dado, não código).

## Segurança

- Nenhum secret, token ou credencial tocado nesta fase.
- Nenhuma Firestore Rule alterada.
- Nenhuma alteração em produção.

## Git

Ver relatório final na resposta desta fase para HEAD/commits exatos —
esta seção é preenchida no momento do commit, não antes.
