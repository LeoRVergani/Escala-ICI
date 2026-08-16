# Hierarquia Organizacional do Escala ICI — fonte de verdade normativa

Documento **normativo**, não de estado de feature. Existe para impedir que
uma implementação futura (humana ou de agente de código) invente,
simplifique ou confunda a estrutura organizacional do Escala ICI.
Descreve o **comportamento real do código hoje**, com evidência apontando
para o arquivo/linha que sustenta cada afirmação — nunca uma aspiração,
nunca uma proposta de reescrita.

**Leitura obrigatória antes de alterar qualquer funcionalidade relacionada
a**: usuários, equipes, unidades organizacionais, hierarquia, perfis,
escopo administrativo, escalas ou Plantões, e antes de alterar
`firestore.rules` relacionado a qualquer uma dessas coleções. Se o código
existente contradisser este documento, **não corrigir silenciosamente** —
parar e relatar a divergência (seção 15 traz as divergências já
conhecidas nesta data).

---

## IMPORTANTE — representação parcial

**A estrutura organizacional cadastrada no Escala ICI é parcial e
evolutiva.** Ela não pretende representar hoje toda a estrutura formal do
Instituto — a organização real é maior, e provavelmente contém diretorias,
gerências, coordenações, setores e equipes que nunca foram cadastrados
aqui. Nunca interpretar a ausência de uma unidade no Escala ICI como
inexistência dessa unidade no ICI real.

O modelo (seção 2) foi desenhado para aceitar novos nós — em qualquer
posição da árvore, em qualquer profundidade — via cadastro administrativo,
**sem exigir mudança de código**. Qualquer spec ou exemplo que mostre uma
árvore específica (este documento incluído, seção 4, e
`docs/spec/HIERARQUIA_ORGANIZACIONAL_REFERENCIA.md`) está descrevendo um
**recorte conhecido nesta data**, nunca "a árvore inteira do ICI".

---

## 1. Três relações, não uma árvore só

O domínio tem três relações estruturais distintas, frequentemente
confundidas entre si. Nenhuma substitui a outra:

```
Organização
    ↓ (parentId, profundidade arbitrária)
Unidade Organizacional
    ↓ (Equipe.unidadeId)
Equipe
    ↓ (Usuario.equipeId)
Usuário
```

E, em paralelo, sem se misturar com essa árvore (`docs/spec/PLANTOES.md`):

```
Grupo de Plantão
    ↓ (participantes, subcoleção)     — quem participa
    ↓ (equipesConsulta, array)         — quem pode consultar (não é a mesma coisa)
```

Um erro estrutural recorrente é achar que "pertencer" a algo implica
"administrar" ou "ser dono de" esse algo. Seção 8 formaliza isso como
regra permanente.

---

## 2. Unidade Organizacional — árvore de profundidade arbitrária

Fonte: `UnidadeOrganizacional` (`lib/modelos.ts:151-170`), coleção
`unidadesOrganizacionais` (`firestore.rules:382-398`).

```ts
export type TipoUnidadeOrganizacional =
  | 'PRESIDENCIA' | 'DIRETORIA' | 'GERENCIA' | 'COORDENACAO'
  | 'SUPERVISAO' | 'AREA' | 'SETOR' | 'DEPARTAMENTO';

export interface UnidadeOrganizacional {
  unidadeId: string;
  nome: string;
  sigla: string;
  tipo: TipoUnidadeOrganizacional;
  parentId: string | null;   // null só na raiz
  caminho: string[];         // raiz -> nó, inclusive o próprio id
  ativa: boolean;
  criadoPorLogin: string;
  criadoEm?: string;
  atualizadoEm?: string;
}
```

- **`parentId` é o único mecanismo de hierarquia** — cada unidade aponta
  para no máximo um pai, formando uma árvore de **profundidade não
  limitada pelo código**. `null` marca a raiz. Não existe um número fixo
  de "níveis" (diretoria → gerência → coordenação...) impostos em código
  em lugar nenhum — `tipo` é só um rótulo descritivo (seção 3), a
  profundidade real é o que `parentId` formar.
- **`caminho`** é o array completo de `unidadeId`s da raiz até o próprio
  nó (inclusive), calculado **uma única vez na criação**, a partir do
  `caminho` da unidade-pai (`lib/organizacao.ts:76-98`,
  `construirArvoreUnidades()`, monta a árvore em memória a partir de
  `parentId`). Nunca recalculado em `firestore.rules` — Rules **nunca
  percorrem `parentId`**, só leem arrays explícitos já resolvidos
  (`caminho`, `unidadesPermitidas`) — ver seção 7.
- **Órfã não desaparece**: uma unidade cujo `parentId` não existe no
  conjunto carregado (por exemplo, um `GESTOR_UNIDADE` que só enxerga uma
  fatia da árvore) vira raiz visual em vez de ser descartada
  (`lib/organizacao.ts:72-75`).
- **Ciclo é impedido no cliente**: `formariaCiclo()`
  (`lib/organizacao.ts:122-147`) percorre a cadeia de `parentId` a partir
  do novo pai proposto; se ela chegar de volta à própria unidade, a
  reparentagem forma um laço e é recusada antes de qualquer escrita. Isso
  é enforcement **client-side**; `firestore.rules` não valida ausência de
  ciclo (ver divergência/risco na seção 15).
- **Delete é sempre negado** (`firestore.rules:397`) — nada apaga uma
  unidade que possa estar referenciada por `equipes.unidadeId` ou por
  `unidadeId`/`unidadesPermitidas` de algum usuário. Desativar é
  `ativa: false`.

### `setores` — coleção legada, não confundir com `unidadesOrganizacionais`

`Setor` (`lib/modelos.ts:128-133`), coleção `setores`
(`firestore.rules:362-366`), é um **cadastro administrativo antigo**,
mantido por compatibilidade. **Não é referenciado por
`usuarios`/`equipes`/`turnosMes`** — a tela "Administração" do Dashboard
passou a usar `unidadesOrganizacionais` para novos cadastros, mas
`setores` continua funcionando exatamente como antes (rules e repositório
inalterados). As duas coleções coexistem; `setores` não é um nível da
árvore de `unidadesOrganizacionais`, é um sistema paralelo desativado por
convenção, não por remoção.

---

## 3. `tipo` é rótulo descritivo, nunca regra de autorização

`TipoUnidadeOrganizacional` (`PRESIDENCIA`/`DIRETORIA`/`GERENCIA`/
`COORDENACAO`/`SUPERVISAO`/`AREA`/`SETOR`/`DEPARTAMENTO`) existe só para
exibição/organização visual. **Nenhuma Rule, nenhum guard, nenhuma
autorização depende do valor de `tipo`.** Autorização depende
exclusivamente de `parentId` resolvido em `unidadesPermitidas` (client) /
`podeOperarNaUnidade()` (Rules) — nunca de "é uma coordenação, então pode
X". Duas unidades do mesmo `tipo` (ex.: duas `COORDENACAO`) podem ter
poderes administrativos completamente diferentes dependendo de quem as
gerencia.

---

## 4. Equipe — agrupamento operacional, não um nível da árvore de unidades

Fonte: `Equipe` (`lib/modelos.ts:105-120`), coleção `equipes`
(`firestore.rules:337-353`).

```ts
export interface Equipe {
  id: string;
  nome: string;
  sigla: string;
  ativa: boolean;
  unidadeId?: string;         // opcional — equipes antigas continuam válidas sem ele
  caminhoUnidade?: string[];  // breadcrumb, nunca usado em Rules
}
```

- **Equipe não é uma Unidade Organizacional.** É o nó operacional que
  efetivamente recebe escala (`turnosMes.equipeId`,
  `usuarios.equipeId`) — uma folha funcional vinculada a uma unidade, não
  mais um degrau da árvore de `parentId`.
- **`unidadeId` é opcional.** Equipes cadastradas antes da hierarquia
  flexível existir continuam válidas em toda parte — Rules, repositório e
  telas nunca exigem `unidadeId` (`lib/modelos.ts:111-117`).
  `equipesSemUnidade` é inclusive uma métrica exposta no resumo
  organizacional (`lib/organizacao.ts:207`, `calcularResumoOrganizacional`).
- **`caminhoUnidade`** é só metadado de breadcrumb (o `caminho` da unidade
  selecionada, sem anexar o próprio ID da equipe) — nunca usado em regra
  de autorização.
- **Duas equipes do mesmo cargo/função em unidades diferentes são
  equipes distintas**, não a mesma equipe reaproveitada. Convenção
  observada no seed (`scripts/seed-organizacao.mjs:35-39`, comentário):
  prefixar o ID com a coordenação (`EQ_COSD_TECNICO_N2` vs.
  `EQ_COAT_TECNICO_N2`) quando o mesmo cargo existe em coordenações
  diferentes — documentado, mas **não semeado** (nenhuma das duas existe
  ainda no seed real).
- **Delete sempre negado** (`firestore.rules:352`) — nada no app hoje
  apaga equipe; desativar é `ativa: false`. Dezenas de outras coleções
  referenciam o ID.

---

## 5. Usuário — identidade funcional é login, nunca UID

Fonte: `Usuario` (`lib/modelos.ts:39-103`).

- **`login` é a chave funcional e o ID do documento** `usuarios/{login}` —
  estável desde o cadastro, nunca muda (`lib/modelos.ts:33-37`). Derivado
  do e-mail autenticado (`loginDoAuth()`, `firestore.rules:17-19`:
  `request.auth.token.email.lower().split('@')[0]`), não depende de
  custom claims nem de Admin SDK.
- **`uid` é metadado interno opcional** — o UID do Firebase Authentication
  quando conhecido, só referência, **nunca necessário** para autenticar,
  ler ou publicar escala (`lib/modelos.ts:41`). Não usar UID como
  identidade funcional em NENHUM domínio novo (Plantão já segue isso — ver
  `docs/spec/PLANTOES.md`, "identidade — regra absoluta").
- **Autenticação ≠ identidade funcional do domínio.** O Firebase
  Authentication resolve "quem está logado"; `usuarios/{login}` resolve
  "quem essa pessoa é no domínio" — duas camadas independentes. Esta fase
  não altera nenhuma delas.
- **`equipeId` é obrigatório e único** — hoje o modelo **não suporta
  múltiplas equipes simultâneas por usuário nem histórico de vínculos**
  (ver divergência registrada na seção 15: isso é uma limitação real do
  modelo atual, não uma decisão arquitetural ideal a ser copiada por
  domínios novos sem análise).
- **`unidadeId`** (campo do usuário, distinto de `Equipe.unidadeId`) é
  metadado informativo/breadcrumb — a autorização de fato usa
  `unidadesPermitidas` (seção 6), que cai de volta para `[unidadeId]`
  quando ausente. Ausência de `unidadeId` é normal, não quebra nada
  (`lib/modelos.ts:68-75`).

**Usuário ≠ Equipe ≠ Unidade ≠ Escala ≠ Grupo de Plantão.** Nenhuma dessas
relações deve, em domínio algum, colapsar em um campo escalar do tipo
`usuario.tipoEscala` ou `usuario.unidadeFixaParaSempre` — a arquitetura já
rejeitou explicitamente esse padrão para Plantão
(`docs/spec/PLANTOES.md`, seção 1) pelo mesmo motivo que se aplicaria aqui.

---

## 6. Perfis e escopos administrativos

Fonte: `PerfilUsuario`/`EscopoUsuario` (`lib/modelos.ts:21-30`),
`perfilEfetivo()`/`unidadesPermitidasEfetivas()`/`equipesPermitidasEfetivas()`
(`lib/sessao.ts`).

```ts
export type PerfilUsuario =
  | 'ADMIN_SISTEMA' | 'GESTOR_EQUIPE' | 'ANALISTA_SOC' | 'LEITURA'
  | 'GESTOR_UNIDADE' | 'SUPERVISOR_EQUIPE' | 'ANALISTA_SUPORTE';

export type EscopoUsuario = 'GLOBAL' | 'EQUIPE' | 'UNIDADE';
```

| Perfil | Escopo real | Fonte |
| --- | --- | --- |
| `ADMIN_SISTEMA` | Leitura/escrita em todas as equipes e unidades do ambiente. | `souAdminSistema()`, `firestore.rules:47-49` |
| `GESTOR_UNIDADE` | Poderes de gestor restritos a `unidadesPermitidas`/`equipesPermitidas` — pode criar unidades/equipes **abaixo** das unidades permitidas. | `podeOperarNaUnidade()`, `firestore.rules:107-110` |
| `GESTOR_EQUIPE` | Poderes de gestor restritos à própria equipe (ou `equipesPermitidas` explícito). | `podeOperarNaEquipe()` |
| `SUPERVISOR_EQUIPE` | **Mesmo alcance de `GESTOR_EQUIPE`** — nome distinto só para refletir o cargo real na hierarquia, nenhuma diferença de poder. | `ADMINISTRACAO_E_HIERARQUIA.md` |
| `ANALISTA_SOC` / `ANALISTA_SUPORTE` | Colaborador comum — mesmo alcance entre si, nomes distintos só para refletir o cargo real. | — |
| `LEITURA` | Valor de enum **reservado para uso futuro** — hoje equivale exatamente a `ANALISTA_SOC` em toda regra e guard existente. Nenhum comportamento próprio ainda. | `firestore.rules:707-709` |

`perfilEfetivo(usuario)` (`lib/sessao.ts:100-105`) é a fonte única de
autorização no cliente: se `usuario.perfil` está definido, ele manda —
mesmo que contradiga `nivelHierarquico`; se ausente, cai no fallback:
`nivelHierarquico <= 5` vira `GESTOR_EQUIPE`, senão `ANALISTA_SOC`.
**Espelhado termo a termo** em `firestore.rules` (`perfilDe()`,
`firestore.rules:37-41`) — qualquer mudança num lado exige a mudança
gêmea no outro (comentário explícito nas Rules e em `lib/sessao.ts`).

### `unidadesPermitidas` / `equipesPermitidas` — sempre com fallback

```ts
unidadesPermitidasEfetivas(usuario)  // lib/sessao.ts:126-131
equipesPermitidasEfetivas(usuario)   // lib/sessao.ts:140-145
```

**Explícito (não-vazio) manda; na ausência, cai para um fallback de 1
elemento; sem nenhum dos dois, lista vazia — nunca lança erro.** Isso é o
que mantém **todo** `GESTOR_EQUIPE`/`ANALISTA_SOC` existente funcionando
sem qualquer migração de dado, sem precisar setar os campos
explicitamente. Espelhado 1:1 em `firestore.rules`
(`minhasUnidadesPermitidas()`/`minhasEquipesPermitidas()`,
`firestore.rules:67-96`), com o mesmo comentário de sincronização
obrigatória.

Este é um padrão **deliberadamente diferente** do usado para Plantão
(`equipesConsulta`, `docs/spec/PLANTOES.md` seção 20.3): `usuarios` tem
documentos legados de antes desses campos existirem, então precisa de
fallback calculado em tempo de leitura; Plantão é domínio novo, sem
legado, então resolve o array final **antes** da escrita
(`equipesConsultaEfetivas()`), sempre concreto. Não copiar
mecanicamente um padrão para o outro sem entender por que cada um existe.

### `podeOperarNaEquipe(equipeId)` / `podeOperarNaUnidade(unidadeId)`

```
podeOperarNaEquipe(equipeId) = autenticado() && (souAdminSistema() || equipeId in minhasEquipesPermitidas())
podeOperarNaUnidade(unidadeId) = autenticado() && (souAdminSistema() || (souGestorUnidade() && unidadeId in minhasUnidadesPermitidas()))
```

`firestore.rules:81-83,107-110`. **Nenhuma delas percorre `parentId`** —
só checam pertencimento literal a um array explícito. A árvore acima de
`Equipe` só é resolvida no cliente (`construirArvoreUnidades()`).

---

## 7. Regra permanente de segurança — descoberta real na Fase PLANTÃO-3A

> **`podeOperarNaEquipe()` sozinha NÃO significa que o usuário é
> gestor.**

`podeOperarNaEquipe(equipeId)` responde só "esse `equipeId` está entre os
que este usuário tem permissão de operar" — **não** verifica perfil. Um
`ANALISTA_SOC` cuja própria equipe seja `EQ_X` também satisfaz
`equipeId in minhasEquipesPermitidas()` para `EQ_X` (via fallback
`[equipeId]`), **sem ser gestor de coisa nenhuma**.

**Toda regra real de escrita administrativa neste projeto combina os
dois**, nunca usa `podeOperarNaEquipe()` isolada para autorizar escrita:

```
souGestor() && podeOperarNaEquipe(equipeId)     // turnosMes, rascunhosTurnosMes, etc.
podeGerenciarGrupoPlantao() = souGestor() && podeOperarNaEquipe(equipeResponsavelId)
```

A regra em prosa:

```
pertencimento/escopo  +  autorização administrativa (perfil de gestor)  =  poder de escrita

Nunca:  pertencimento  =  poder de gestão
```

**Origem desta regra**: a Fase PLANTÃO-3A escreveu inicialmente
`podeGerenciarGrupoPlantao(grupoDoc) = podeOperarNaEquipe(grupoDoc.equipeResponsavelId)`
— sem `souGestor()`. Isso deixava **qualquer analista comum** da equipe
responsável editar o Grupo de Plantão, criar participantes e rascunhos.
Pego pelo teste "participante do grupo não administra nada" rodando no
Firestore Emulator real (não uma leitura estática do arquivo), corrigido
antes do commit (`CHECKPOINT-FASE-PLANTAO-3A-MODELO-RULES.md`). Qualquer
guard novo que decida autorização administrativa a partir de
pertencimento a uma equipe/unidade **deve** ser revisado contra esta regra
antes de ir para produção, e testado com um usuário comum da mesma equipe
tentando administrar.

---

## 8. Pertencimento não é autorização (regra geral, além do caso do § 7)

Registro permanente, válido para qualquer domínio presente ou futuro:

- **Pertencer a uma equipe não concede administração da equipe.**
  Administração exige `souGestor()` (ou perfil equivalente) **e**
  `podeOperarNaEquipe()`/`podeOperarNaUnidade()` sobre o alvo — nunca um
  dos dois isolado.
- **Participar de um Grupo de Plantão não concede administração do
  Grupo** (`docs/spec/PLANTOES.md`, `podeGerenciarGrupoPlantao()` exige
  `souGestor()` sobre a equipe responsável — participar não entra nessa
  conta).
- **Ter permissão para consultar um Grupo de Plantão não concede
  administração do Grupo** — são dois guards Rules diferentes
  (`podeConsultarGrupoPlantao()` vs. `podeGerenciarGrupoPlantao()`),
  nunca fundidos.
- **Estar no mesmo ramo da árvore de unidades não concede acesso
  automático a todos os recursos daquele ramo** — cada coleção define seu
  próprio guard de leitura/escrita (`podeOperarNaEquipe`,
  `podeOperarNaUnidade`, `podeConsultarGrupoPlantao`, etc.); nenhum deles
  é "true por estar dentro do mesmo ramo" sem checar o array de permissão
  explícito.

---

## 9. Visibilidade operacional de Plantões — decisão normativa

**A hierarquia organizacional não decide sozinha quais Grupos de Plantão
um usuário consegue consultar.** Cada Grupo de Plantão carrega sua própria
configuração explícita de visibilidade (`GrupoPlantao.equipesConsulta`,
`docs/spec/PLANTOES.md` seção 20.3) — **data-driven**, nunca inferida
automaticamente a partir de `parentId`/posição na árvore.

```
Grupo de Plantão "X"
  equipeResponsavelId: <equipe dona>
  equipesConsulta: [<lista explícita de equipes autorizadas a consultar>]
```

A lista é resolvida por `equipesConsultaEfetivas(equipeResponsavelId,
lista)` **antes de qualquer escrita** — sempre concreta, sempre inclui a
equipe responsável, nunca calculada por travessia de `parentId` em tempo
de leitura. O gestor/coordenador autorizado do Grupo poderá, em fase
futura de UI, selecionar no Dashboard quais equipes entram nessa lista —
mas a fonte de verdade continua sendo o campo do Grupo, nunca a árvore
organizacional em si.

### Consultar não move nada

```
A permissão de consultar um Grupo de Plantão não altera o pertencimento
organizacional da equipe consultante e não concede responsabilidade
administrativa sobre o Grupo.
```

Uma equipe de outro ramo da organização pode receber acesso operacional a
um Plantão sem que isso:

- mova a equipe;
- mude seu `parentId`/unidade;
- mude seu gestor;
- transforme o Grupo de Plantão em propriedade dela.

### Visibilidade nunca é derivada por cargo

Não usar `cargo == "Analista NOC"`/`cargo == "Analista SOC"` (ou
equivalente) para decidir acesso a um Grupo de Plantão. `cargo`
(`Usuario.cargo`, `lib/modelos.ts:45`) é **texto livre puramente
descritivo** — nunca usado por `firestore.rules` nem por
`perfilEfetivo()`/autorização em lugar nenhum do código hoje
(`lib/importUsers.ts:23-29`, comentário explícito). Visibilidade de
Plantão vem exclusivamente de `equipesConsulta`.

### ACL de consulta não administra

```
equipesConsulta  !=  administradores
```

Administração de um Grupo de Plantão continua exigindo perfil
administrativo (`souGestor()`) **+** escopo sobre a equipe/unidade
responsável (`podeOperarNaEquipe(equipeResponsavelId)`) — o mesmo modelo
de autorização já usado em todo o resto do sistema (§ 6/7). Não foi
criado (e não deve ser criado) um array `administradores` redundante
dentro de `GrupoPlantao`: o escopo administrativo já é resolvido pelo
modelo organizacional existente.

---

## 10. Escala e Plantão continuam domínios paralelos, não uma segunda árvore

Uma Escala (6x1) pertence ao contexto de uma **Equipe**
(`turnosMes.equipeId`) — não de uma Unidade Organizacional diretamente
(a Unidade é alcançada via `Equipe.unidadeId`, quando presente).

Um **Grupo de Plantão não é um tipo especial de Equipe** — é uma entidade
própria (`gruposPlantao/{grupoId}`, `docs/spec/PLANTOES.md` seção 20) que
**referencia** uma equipe/unidade responsável, mas não a substitui nem
cria uma segunda árvore organizacional paralela:

```
equipe operacional (Equipe, escala 6x1)   !=   Grupo de Plantão (gruposPlantao)
```

Um Grupo de Plantão referencia organização/equipe (`equipeResponsavelId`,
`equipesConsulta`) — ele não é dono de nenhum nó da árvore de
`unidadesOrganizacionais`, e nenhuma unidade organizacional deve ser
criada só para representar um Grupo de Plantão.

---

## 11. Relação completa: GrupoPlantao e a hierarquia

```
GrupoPlantao
    |
    +-- equipeResponsavelId  (aponta para uma Equipe já existente)
    |
    +-- participantes/{login}  (subcoleção — quem participa, por login)
    |
    +-- equipesConsulta[]      (quem pode consultar — data-driven, seção 9)
    |
    +-- competências / atribuições  (docs/spec/PLANTOES.md, seções 20.6/20.6-atribuição)
```

`participantes` ≠ `equipesConsulta` ≠ "administradores" (não existe esse
terceiro conceito — administração vem do modelo organizacional, § 9).

---

## 12. Componente futuro de seleção organizacional (decisão adiada, não implementar agora)

Quando a UI de configuração de Plantões existir (fase futura — ver
`docs/spec/PLANTOES.md`), ela deverá **reutilizar a árvore organizacional
já existente** (`construirArvoreUnidades()`/`unidadesOrdenadasEmArvore()`,
`lib/organizacao.ts`) para selecionar equipe responsável e equipes
autorizadas a consultar — nunca uma segunda estrutura de seleção paralela.

Se a árvore crescer além de um punhado de nós, **não usar um `<select>`
plano gigante** (mesma lição já registrada para a busca de usuário do
preview de Plantão, `docs/spec/PLANTOES.md` § 17). UX prevista, a
detalhar quando a fase de implementação chegar:

```
busca por nome/sigla
    +
árvore expansível
    +
breadcrumb/caminho organizacional (ex.: "ICI > ... > unidade > equipe")
```

Reduz ambiguidade entre equipes/unidades de nomes parecidos (já existe
precedente parcial: `rotuloOpcaoUnidade()`,
`caminhoCurto()`/`caminhoLegivel()`, `lib/organizacao.ts`, usados hoje nos
selects de Administração). Não implementar componente novo nesta fase.

---

## 13. Modo de simulação (impersonation) e a árvore

Documentado em detalhe em `docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`
("Modo de simulação"). Resumo relevante para hierarquia: `usuarioEfetivo
= simulando ?? usuarioReal` é usado para toda leitura/escrita de dados
operacionais durante a simulação; os gates de acesso e a árvore
organizacional visível continuam resolvidos a partir de `usuarioReal`
para decisões de quem PODE simular, nunca a partir do usuário simulado.
Este documento não altera esse comportamento.

---

## 14. Fontes de verdade — ordem de autoridade documental

1. **Este documento** (`HIERARQUIA_ORGANIZACIONAL.md`) — semântica
   organizacional e autorização estrutural (o que é uma Unidade, uma
   Equipe, um perfil, um escopo — e como eles se relacionam).
2. `docs/spec/PLANTOES.md` — domínio específico de Plantões (Grupo,
   participante, contato, competência, atribuição, visibilidade).
3. `docs/spec/ADMINISTRACAO_E_HIERARQUIA.md` — fluxos administrativos
   existentes no Dashboard (telas, matriz de permissões por ação,
   auditoria, modo de simulação).
4. **Código + `firestore.rules`** — comportamento implementado de fato;
   sempre a autoridade final quando um documento divergir (e a
   divergência deve ser registrada, nunca silenciada — seção 15).
5. `docs/spec/HIERARQUIA_ORGANIZACIONAL_REFERENCIA.md` — snapshot parcial
   e evolutivo do que está de fato cadastrado/planejado, sem valor
   normativo.

---

## 15. Divergências encontradas nesta auditoria

Registradas para avaliação futura — **nenhuma foi corrigida nesta fase**
(fase docs-only, ver `CHECKPOINT-FASE-HIERARQUIA-1-FONTE-DE-VERDADE.md`).

- **Ausência de ciclo em `unidadesOrganizacionais` é enforcement só
  client-side** (`formariaCiclo()`, `lib/organizacao.ts`). As Rules
  (`firestore.rules:382-398`) não verificam ciclo — um `write` direto
  (fora da UI, ex.: script/console) poderia introduzir um `parentId`
  cíclico sem ser barrado pelo servidor. Mesma classe de risco já
  documentada para `podeExcluirCompetencia`
  (`ADMINISTRACAO_E_HIERARQUIA.md`, "client-side only").
- **`podeGerenciarUnidade()`/`podeGerenciarEquipe()` (`lib/sessao.ts`)
  existem e têm teste dedicado, mas não são chamadas pelo Dashboard em
  produção** — o Dashboard reimplementa a mesma condição inline
  (`souAdmin || minhasUnidadesPermitidas.includes(...)`). Hoje
  equivalentes, mas uma duplicação de lógica a observar
  (`ADMINISTRACAO_E_HIERARQUIA.md`, já documentado lá; repetido aqui
  porque é exatamente o tipo de duplicação que a regra do § 7 pede para
  vigiar).
- **`Usuario.equipeId` é único e sem histórico** — o modelo atual não
  suporta múltiplas equipes simultâneas por colaborador nem histórico de
  qual equipe ele já pertenceu. Isso é uma **limitação real do modelo
  atual**, não uma decisão arquitetural a ser copiada sem análise por um
  domínio novo (Plantão, por comparação, já modela participação como
  relação N:N via subcoleção `participantes`, resolvendo exatamente essa
  limitação para o próprio domínio — mas isso não retroage sobre
  `Usuario.equipeId`).
- **`scripts/seed-organizacao.mjs` documenta um plano de hierarquia real
  (Diretor Presidente → Diretoria de Infraestrutura e Segurança → GEDSI →
  COSI/CODB → equipes) que nunca aparece referenciado em nenhum
  checkpoint do repositório** — não há confirmação, nesta auditoria, de
  que esse seed já foi de fato executado (`--execute`) em staging. O
  script roda em `--dry-run` por padrão e exige aprovação explícita
  (comentário no próprio arquivo: "NÃO EXECUTAR SEM APROVAÇÃO"). Ver
  `docs/spec/HIERARQUIA_ORGANIZACIONAL_REFERENCIA.md` para o detalhe —
  tratado ali como **plano documentado no código**, não como "confirmado
  em produção".
- **IDs de equipe nos testes de Rules (`EQ_COSI_SOC`, `EQ_CODB_NOC`,
  `EQ_GEDSI_ADM`) não coincidem com os IDs do seed real (`EQ_SOC`,
  `EQ_NOC`, sem equipe sob `EQ_GEDSI_ADM`)** — inconsistência de
  nomenclatura entre fixtures de teste (fictícias, propositalmente
  simples) e o plano de seed real. Não é um bug funcional (testes não
  dependem do seed real rodar), mas vale alinhar nomenclatura se algum
  dia os dois precisarem coexistir na mesma leitura.

---

## 16. Proibições permanentes

- Não hardcodar `COSI`, `CODB`, `SOC`, `NOC`, `GEDSI` (ou qualquer outra
  sigla) em condicional de autorização — siglas são dado, não regra de
  negócio compilada. Uso em fixtures/seed/exemplos/documentação/testes
  demonstrativos é permitido e já é a prática atual.
- Não inferir autorização por sigla (`if unidade.sigla === 'COSI'`).
- Não inferir autorização por cargo (`if usuario.cargo === '...'`).
- Não mover uma equipe/mudar seu `parentId`/unidade só porque ela recebeu
  permissão de consultar um recurso de outro ramo (Plantão ou qualquer
  outro).
- Não transformar uma ACL de consulta (`equipesConsulta` ou equivalente)
  em ACL administrativa.
- Não tratar um participante (de equipe, de Grupo de Plantão, de
  qualquer coisa) como gestor só por participar.
- Não tratar Equipe como Unidade Organizacional sem antes analisar o
  modelo (seção 4) — são conceitos e coleções diferentes.
- Não criar uma árvore paralela de unidades/equipes para representar
  Plantões — Plantão referencia a árvore existente, nunca duplica.
- Não assumir profundidade fixa de árvore em código (nenhum "são sempre N
  níveis") — `parentId` define profundidade arbitrária.
- Não assumir que a árvore cadastrada no Escala ICI é toda a estrutura
  real do ICI — ela é um recorte parcial e evolutivo (ver aviso no topo
  deste documento).
- Não usar UID do Firebase Authentication como identidade funcional em
  nenhum domínio.
- Não usar nome visual (nome da unidade, sigla, nome do usuário) como
  chave/comparação de segurança — usar sempre o ID estável
  (`unidadeId`/`equipeId`/`login`).

---

## 17. Regra para prompts futuros (agentes de código)

Antes de alterar qualquer funcionalidade relacionada a usuários, equipes,
unidades, hierarquia, permissões, escopo, escalas, Plantões ou
`firestore.rules` associado a qualquer uma dessas coleções, **é
obrigatório ler este documento** (`docs/spec/HIERARQUIA_ORGANIZACIONAL.md`)
integralmente.

Se o código existente contradisser este documento: **não corrigir
silenciosamente**. Parar e relatar a divergência explicitamente (mesmo
formato da seção 15: arquivo, comportamento, impacto possível,
recomendação) — a decisão de corrigir cabe a quem revisa o relato, não ao
agente que o encontrou no meio de outra tarefa.
