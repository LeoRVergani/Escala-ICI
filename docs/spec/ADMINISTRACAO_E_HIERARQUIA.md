# Especificação — Administração e hierarquia organizacional

Documento de estado real, escrito a partir do código e das Firestore Rules
atuais (branch `feature/push-fcm-staging`). Cada afirmação de permissão aponta
para a evidência que a sustenta — este documento não supõe poderes que não
estejam implementados.

**Para a semântica normativa da organização** (o que é Unidade
Organizacional vs. Equipe, por que `parentId` tem profundidade arbitrária,
"pertencimento não é autorização", e como a visibilidade de Plantão se
relaciona com a hierarquia), **consultar
[`HIERARQUIA_ORGANIZACIONAL.md`](HIERARQUIA_ORGANIZACIONAL.md)** (Fase
HIERARQUIA-1) — este documento aqui continua sendo a referência para os
*fluxos administrativos* (telas do Dashboard, matriz de permissões por
ação, modo de simulação, auditoria), sem duplicar a semântica estrutural.

## Objetivo

Descrever quem pode fazer o quê no Escala ICI: perfis de usuário, unidades
organizacionais, equipes, escopo de atuação de cada perfil, modo de
simulação e auditoria administrativa.

## Coleções envolvidas

- `usuarios/{login}` — chave é o login corporativo, não o UID do Firebase Auth
  (`lib/modelos.ts`).
- `equipes/{equipeId}`.
- `setores/{setorId}` — cadastro antigo, mantido por compatibilidade; não é
  referenciado por `usuarios`/`equipes`/`turnosMes`.
- `unidadesOrganizacionais/{unidadeId}` — hierarquia flexível, coleção
  aditiva que não substitui `setores`.
- `auditoriaAdmin/{id}` — log de ações feitas em modo simulação.

Indiretamente ligadas à administração: `turnosMes`, `rascunhosTurnosMes`,
`trocasEscala`, `notificacoesTroca` (afetadas por `excluirUsuario`/
`excluirEscalaPublicada`, `lib/firebase/adminRepository.ts`).

## Perfis (`PerfilUsuario`, `lib/modelos.ts`)

```ts
type PerfilUsuario =
  | 'ADMIN_SISTEMA'
  | 'GESTOR_EQUIPE'
  | 'ANALISTA_SOC'
  | 'LEITURA'
  | 'GESTOR_UNIDADE'
  | 'SUPERVISOR_EQUIPE'
  | 'ANALISTA_SUPORTE';
```

- **`ADMIN_SISTEMA`** — leitura/escrita sobre todas as equipes e unidades do
  ambiente.
- **`GESTOR_UNIDADE`** — poderes de gestor restritos às unidades e equipes
  presentes em `unidadesPermitidas`/`equipesPermitidas`; pode criar unidades e
  equipes abaixo das unidades permitidas. Desde a Fase ESCOPO-GESTOR-UNIDADE-1
  (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`), também administra Grupo
  de Plantão cuja unidade responsável esteja dentro desse mesmo escopo —
  antes dessa fase, `GESTOR_UNIDADE` nunca administrava Plantão.
- **`GESTOR_EQUIPE`** e **`SUPERVISOR_EQUIPE`** — mesmo alcance entre si:
  poderes de gestor restritos à própria equipe.
- **`ANALISTA_SOC`** e **`ANALISTA_SUPORTE`** — colaborador comum.
- **`LEITURA`** — valor reservado para uso futuro; hoje equivale a
  `ANALISTA_SOC` em toda regra e guard existente (`firestore.rules`).

`EscopoUsuario`: `'GLOBAL' | 'EQUIPE' | 'UNIDADE'`.

`perfilEfetivo()` (`lib/sessao.ts`) é a fonte única de autorização no
cliente: se `usuario.perfil` está definido, ele manda; senão cai no fallback
por `nivelHierarquico` (`<= 5` vira `GESTOR_EQUIPE`, senão `ANALISTA_SOC`).
Espelhado termo a termo em `firestore.rules` (`perfilDe()`) — qualquer mudança
num lado exige a mudança gêmea no outro (comentário explícito nas Rules).

## Modelo de unidade organizacional e relação com equipes

```ts
interface UnidadeOrganizacional {
  unidadeId: string;
  nome: string;
  sigla: string;
  tipo: TipoUnidadeOrganizacional; // PRESIDENCIA|DIRETORIA|GERENCIA|COORDENACAO|SUPERVISAO|AREA|SETOR|DEPARTAMENTO
  parentId: string | null;         // null só na raiz
  caminho: string[];               // raiz → nó, inclusive o próprio id
  ativa: boolean;
  criadoPorLogin: string;
  criadoEm?: string;
  atualizadoEm?: string;
}
```

`Equipe` tem campos **opcionais** `unidadeId?`/`caminhoUnidade?[]` — equipes
antigas sem esses campos continuam válidas em toda parte (Rules, repositório,
telas nunca exigem `unidadeId`). `caminhoUnidade` é metadado de breadcrumb,
nunca usado em regra de autorização.

A hierarquia acima de `Equipe` é resolvida via `parentId` **apenas no
cliente** (`lib/organizacao.ts`, `construirArvoreUnidades`). As Firestore
Rules **nunca percorrem `parentId`** — só leem arrays explícitos (`caminho`,
`unidadesPermitidas`).

## Matriz de permissões

| Ação | `ADMIN_SISTEMA` | `GESTOR_UNIDADE` | `GESTOR_EQUIPE` / `SUPERVISOR_EQUIPE` | Colaborador comum |
|---|---|---|---|---|
| Criar/editar unidade organizacional | sempre | só dentro de `unidadesPermitidasEfetivas` | não | não |
| Criar/editar equipe | sempre | só se a `unidadeId` da equipe estiver em `podeOperarNaUnidade` | não cria; opera sobre equipe já existente | não |
| Ler/escrever escala (`turnosMes`/rascunhos) | qualquer equipe (`podeOperarNaEquipe`) | não diretamente (perfil não é gestor de equipe) | própria(s) equipe(s) permitida(s) | só leitura da escala publicada da própria equipe |
| Criar/editar usuário | qualquer campo, qualquer equipe, inclusive `perfil`/`escopo` | não (painel restrito a `ADMIN_SISTEMA` no Dashboard) | só na própria equipe, nunca `perfil`/`escopo`/campos organizacionais | não |
| Ativar/desativar usuário | sim | não visto no Dashboard (painel restrito a admin) | sim, dentro da própria equipe | não |
| Excluir usuário | sim | não | não (Rules: `delete` só `souAdminSistema()`) | não |
| Conceder/alterar `perfil` de outro usuário | sim, qualquer usuário | não | não (bloqueado explicitamente nas Rules) | não |
| Simular gestor (impersonation) | sim (nunca é alvo de simulação) | não | é alvo possível de simulação | não |

Guards puros usados nessas decisões:
- `lib/adminGuards.ts`: `podeExcluirUsuario` (bloqueia autoexclusão),
  `exclusaoZeraGestores` (avisa se excluir zeraria todos os
  `GESTOR_EQUIPE`/`ADMIN_SISTEMA`), `podeExcluirCompetencia` (impede excluir a
  competência corrente — enforcement **só client-side**, sem regra de
  servidor equivalente, reconhecido no próprio comentário do arquivo).
- `lib/sessao.ts`: `ehAdminSistema`, `podeGerenciarUnidade`,
  `podeGerenciarEquipe` — estas duas últimas têm testes dedicados mas **não
  são chamadas pelo Dashboard em produção**; o Dashboard reimplementa a
  mesma condição inline (`souAdmin || minhasUnidadesPermitidas.includes(...)`).
  Hoje equivalentes, mas é uma duplicação de lógica a observar.
- No Dashboard: `podeAcessarAdministracao = souAdmin || souGestorUnidade` é o
  gate de exibição da aba "Administração"; o painel "Usuários"/"Simular
  gestor" é restrito a `ADMIN_SISTEMA` (`GESTOR_UNIDADE` não usa esse painel).
- **Administração → Grupos de Plantão** (`tela === 'plantoes'`, sub-aba de
  Administração) — CRUD completo de `GrupoPlantao` (`ModalGrupoPlantao`):
  criar, editar (nome, descrição, equipe responsável, equipes que
  consultam, timezone, ativo/inativo, padrão semanal), sem exclusão física
  (`ativo: false`). Desde a Fase PROVISIONAMENTO-GRUPO-PLANTAO-1
  (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` § 9), este é um dos
  dois caminhos oficiais para provisionar um Grupo — o outro é o Wizard
  (`criarGrupoWizard()`) — nenhuma versão estável depende do Console do
  Firestore para isso.

## Campos de escopo

- `unidadeId?: string` — metadado informativo/breadcrumb do usuário.
- `unidadesPermitidas?: string[]` — escopo de gestão de unidades do
  `GESTOR_UNIDADE`. Resolvido por `unidadesPermitidasEfetivas()`
  (`lib/sessao.ts`): lista explícita manda; senão fallback `[unidadeId]` se
  existir; senão lista vazia.
- `equipesPermitidas?: string[]` — escopo de gestão/leitura administrativa de
  equipes. Resolvido por `equipesPermitidasEfetivas()`: lista explícita
  manda; senão fallback `[equipeId]` (sempre presente).
- As Firestore Rules replicam a mesma lógica de fallback
  (`minhasUnidadesPermitidas()`, `minhasEquipesPermitidas()`), com comentário
  explícito de que precisa continuar sincronizada com `lib/sessao.ts`.
- Checagem central de acesso: `podeOperarNaEquipe(equipeId)` e
  `podeOperarNaUnidade(unidadeId)` — ambas dão passe livre a `ADMIN_SISTEMA`
  e, fora disso, checam pertencimento literal ao array (nunca travessia de
  `parentId`).

## Modo de simulação (impersonation)

Implementado só no Dashboard, só disponível para `ADMIN_SISTEMA`:

- `usuarioEfetivo = simulando ?? usuarioReal` — usado para toda leitura/
  escrita de dados operacionais durante a simulação.
- `usuarioReal` nunca muda por simulação — usado nos gates de acesso e na
  auditoria.
- Lista de simuláveis (`gestoresParaSimulacao()`, `lib/organizacao.ts`):
  perfis `GESTOR_UNIDADE`/`GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE`, nunca
  `ADMIN_SISTEMA`; exclui cadastros técnicos/fictícios; deduplica por nome.
- `iniciarSimulacao`/`sairDaSimulacao` trocam apenas o estado local
  `simulando` e recarregam os dados da equipe do gestor simulado — **não**
  troca o login autenticado no Firebase Auth.
- UI: painel "Simular gestor" na tela Administração, banner fixo "Simulando
  {nome} — {perfil}" com botão para sair.
- Toda escrita sensível feita durante a simulação chama
  `registrarAuditoriaSeSimulando(acao)` — cobre cadastro/ativação de
  usuários, salvar rascunho, publicar escala, aprovar/recusar troca, rollback,
  adicionar membro na Grade. Falha ao gravar auditoria é isolada em
  try/catch e **não desfaz** a ação original.

## Auditoria administrativa

Coleção `auditoriaAdmin`, documento imutável por ação:

```ts
{
  atorRealLogin, atorRealNome, atorRealPerfil,
  atorSimuladoLogin, atorSimuladoNome, atorSimuladoPerfil,
  equipeId, acao, em,
}
```

Regras: `read`/`create` só `souAdminSistema()`; `create` exige
`atorRealLogin == loginDoAuth()` (nunca o ator simulado); `update`/`delete`
sempre `false`.

**Limitação relevante**: só registra ação quando há simulação ativa. Ações
administrativas feitas diretamente por um `ADMIN_SISTEMA` ou `GESTOR_UNIDADE`
sem simular ninguém **não geram registro de auditoria** hoje.

## Bootstrap do primeiro admin em staging

Não há caminho via Rules para criar o primeiro `ADMIN_SISTEMA` — problema do
ovo e da galinha, já que `create`/`update` de `usuarios` com `perfil` exige já
ser admin (risco conscientemente aceito, documentado nas próprias Rules).

Processo real (`docs/operacao/BOOTSTRAP_ADMIN_STAGING.md`): editar
manualmente o documento `usuarios/{login}` pelo **Console do Firebase** (usa
IAM, não passa pelas Security Rules), definindo `perfil: "ADMIN_SISTEMA"`,
`escopo: "GLOBAL"`, `nivelHierarquico: 0`. Depois do primeiro admin,
promoções seguintes usam a própria tela "Administração → Usuários", sem
repetir o processo manual.

`nivelPermiteDashboard()` (`lib/sessao.ts`) é checado **independentemente**
de `perfil`/`escopo` — trava adicional baseada só em `nivelHierarquico`;
mesmo com `perfil: ADMIN_SISTEMA`, um `nivelHierarquico` alto demais continua
bloqueando o acesso ao Dashboard.

## Proteções das Firestore Rules

- `usuarios/{login}`: `read` — o próprio usuário ou quem `podeOperarNaEquipe`
  do dono do doc. `update` — autoatualização só de `nome`; admin qualquer
  campo (exceto `login`); gestor não-admin só dentro da própria equipe, nunca
  `perfil`/`escopo`/campos organizacionais. `create` — admin livre; gestor só
  na própria equipe e sem setar nenhum campo organizacional/perfil/escopo.
  `delete` — só admin.
- `equipes/{equipeId}`: `read` livre para autenticados; `create`/`update` —
  admin sempre, ou `GESTOR_UNIDADE` se a `unidadeId` do documento estiver em
  `podeOperarNaUnidade` (match exato) ou se `caminhoUnidade` contiver uma
  unidade permitida como ancestral (`podeOperarNaUnidadeOuDescendente()`,
  Fase ESCOPO-GESTOR-UNIDADE-1); `delete` sempre `false` (sem exclusão de
  equipe no MVP, só `ativa: false`). `update` exige ORIGEM **e** DESTINO
  (`unidadeId` do payload) dentro do escopo — antes dessa fase só a
  origem era checada, o que permitia migrar uma equipe para fora do
  escopo do gestor sem barreira (corrigido nesta fase, ver
  `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` § 6.2).
- `setores/{setorId}`: `read` autenticado; `create`/`update` só admin;
  `delete` `false`.
- `unidadesOrganizacionais/{unidadeId}`: `read` autenticado; `create` exige
  `unidadeId`/`criadoPorLogin` batendo e (admin, ou `parentId` não-nulo
  dentro de `podeOperarNaUnidade`); `update` — `unidadeId` imutável e
  `podeOperarNaUnidade(unidadeId)`; `delete` sempre `false` (nunca apaga
  unidade referenciada por equipes/usuários).
- `auditoriaAdmin/{id}`: só admin lê/cria, `atorRealLogin` obrigatoriamente o
  autenticado real.

## Limitações e riscos conhecidos

- `podeGerenciarUnidade()`/`podeGerenciarEquipe()` existem e têm teste
  dedicado, mas não são chamadas pelo Dashboard em produção — risco de
  divergência futura entre a função "oficial" e a condição inline, embora
  hoje sejam equivalentes.
- Auditoria administrativa cobre só ações feitas durante simulação ativa.
- `podeExcluirCompetencia` é enforcement apenas client-side.
- `LEITURA` é um valor de enum reservado, sem regra ou comportamento
  diferenciado de `ANALISTA_SOC` hoje.
- Bootstrap do primeiro `ADMIN_SISTEMA` é deliberadamente manual e fora de
  Rules — risco aceito e documentado, não um bug.
- `list` de `equipes` é aberto a qualquer autenticado (mesmo padrão de
  exposição aceito em outras coleções operacionais do projeto).
