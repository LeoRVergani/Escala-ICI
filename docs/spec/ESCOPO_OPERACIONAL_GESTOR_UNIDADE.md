# Especificação — Escopo operacional de GESTOR_UNIDADE (Fase ESCOPO-GESTOR-UNIDADE-1)

Documento **normativo**, mesma convenção dos demais em `docs/spec/`: descreve
o comportamento real do código a partir desta fase, com evidência apontando
para arquivo/função. Consolida uma **mudança de regra aprovada** nesta fase —
não é mais uma proposta, é o comportamento vigente.

**Atualização ESCOPO-OPERACIONAL-MATRIZ-1:** a parte deste documento que
deduz administração operacional de Jornada/Plantão a partir de unidade,
perfil ou equipe foi **Substituída pela matriz operacional explícita** para
alvos que tenham documento em `escoposOperacionais`. O cálculo descrito aqui
permanece como **Regra transitória / fallback de compatibilidade** para
ambientes sem matriz no alvo.

Correção de validação: um `GrupoPlantao` inativo nunca deve ser usado para
rotular uma Equipe como destino operacional de Plantão. O vínculo histórico
fica auditável em Administração → Grupos de Plantão, mas não altera seletor,
Wizard, resolver nem tabela operacional de Equipes.

**Leitura obrigatória antes de alterar** qualquer coisa relacionada a
`GESTOR_UNIDADE`, `GrupoPlantao`, `Equipe.unidadeId`/`caminhoUnidade`, ou
`firestore.rules` das coleções `equipes`/`unidadesOrganizacionais`/
`gruposPlantao`. Ler primeiro
[`HIERARQUIA_ORGANIZACIONAL.md`](HIERARQUIA_ORGANIZACIONAL.md) (semântica de
Unidade/Equipe/Usuário/perfis) e [`PLANTOES.md`](PLANTOES.md) (modelo de
Grupo de Plantão) — este documento não repete a semântica estrutural, só
formaliza o escopo administrativo de `GESTOR_UNIDADE` sobre ela.

---

## 1. Mudança de regra aprovada nesta fase

Até esta fase, três documentos afirmavam (corretamente, para o código de
então) que **`GESTOR_UNIDADE` nunca administra Plantão**:

- `docs/spec/HIERARQUIA_ORGANIZACIONAL.md` § 7 — `souGestor()` (a base de
  `podeGerenciarGrupoPlantao()`) nunca incluiu `GESTOR_UNIDADE`.
- `docs/spec/PLANTOES.md` § 21.1 — `podeAcessarPlantoes` explicitamente
  escondia a tela de `GESTOR_UNIDADE`.
- `lib/sessao.ts`, `souGestorDePlantao()` — comentário explícito "NÃO
  inclui GESTOR_UNIDADE".

Essa regra se mostrou **incorreta em produto**: um coordenador real de uma
unidade (ex.: COSI) que administra toda a árvore operacional daquela
unidade — incluindo uma equipe dedicada a Plantão (ex.: "Plantão COSI") —
não conseguia sequer abrir a tela de Plantões para o próprio Grupo que sua
unidade é responsável, mesmo a `ADMINISTRACAO_E_HIERARQUIA.md` já prever
que `GESTOR_UNIDADE` "pode criar unidades e equipes abaixo das unidades
permitidas".

**A partir desta fase**: `GESTOR_UNIDADE` administra a árvore operacional
completa da sua unidade — Unidades filhas, Equipes, e Grupos de Plantão
cuja equipe responsável esteja dentro do escopo. Isso NÃO transforma
`GESTOR_UNIDADE` em `GESTOR_EQUIPE` global, nem dá a ele poder sobre
equipes/unidades fora do seu escopo — o mesmo princípio de "pertencimento
não é autorização" (`HIERARQUIA_ORGANIZACIONAL.md` § 7/§ 8) continua
valendo, agora com um segundo caminho de autorização explícito (nunca
substituindo o primeiro).

---

## 2. Três entidades, três administradores possíveis

```
Unidade Organizacional  →  Equipe  →  GrupoPlantao (referencia a Equipe)
```

| Entidade | O que é | Quem administra |
| --- | --- | --- |
| `UnidadeOrganizacional` | Nó da hierarquia flexível (diretoria/gerência/coordenação/...). | `ADMIN_SISTEMA` (tudo) ou `GESTOR_UNIDADE` cuja unidade (ou uma unidade ANCESTRAL, via subárvore) está em `unidadesPermitidas`. |
| `Equipe` | Agrupamento operacional que recebe escala 6x1 (`turnosMes.equipeId`). Pode ou não ter `unidadeId`. | `ADMIN_SISTEMA`; `GESTOR_UNIDADE` cuja unidade (ou ancestral) contém `equipe.unidadeId`; `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` cuja `equipesPermitidas` contém a equipe (só opera, não cria). |
| `GrupoPlantao` | Entidade PRÓPRIA (não é Equipe) que referencia uma `equipeResponsavelId`. | `ADMIN_SISTEMA`; `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` sobre a equipe responsável; `GESTOR_UNIDADE` cuja unidade (ou ancestral) é a unidade responsável do Grupo. |

**Uma equipe existir dentro de uma unidade não torna essa unidade "dona"
de um Grupo de Plantão automaticamente** — o Grupo só fica administrável
por `GESTOR_UNIDADE` quando carrega o campo denormalizado
`unidadeResponsavelId` (seção 4) apontando para essa unidade. Isso é
deliberado: `GrupoPlantao` continua uma entidade própria, nunca uma
segunda árvore organizacional (`HIERARQUIA_ORGANIZACIONAL.md` § 10).

---

## 3. Por que "Plantão COSI" aparece ao lado de "SOC" no seletor superior, mas não é Jornada

Um cenário real (usado em demo/fixture/teste, nunca regra de produto):

```
COSI (Unidade Organizacional)
 ├─ SOC              (Equipe — Jornada 6x1)
 └─ Plantão COSI     (Equipe — existe na árvore administrativa)
       ↑
       referenciada por
GrupoPlantao "Plantão COSI"  (equipeResponsavelId = equipe "Plantão COSI",
                               unidadeResponsavelId = "COSI")
```

- "Plantão COSI" **é uma Equipe de verdade** na árvore administrativa —
  pode ser criada/editada/desativada como qualquer outra (seção 6).
- A **escala de Plantão em si nunca é vinculada à Equipe diretamente** —
  ela é vinculada ao `GrupoPlantao`, que referencia essa equipe como
  responsável (`docs/spec/PLANTOES.md` § 20.3). Escrever atribuições de
  Plantão em `turnosMes`/`rascunhosTurnosMes` usando o `equipeId` da
  equipe "Plantão COSI" seria confundir os dois domínios — nunca fazer
  isso (`HIERARQUIA_ORGANIZACIONAL.md` § 10).
- **Nunca hardcodar essa distinção por nome/sigla.** A regra é
  inteiramente data-driven: `lib/escoposOperacionais.ts`
  (`jornadasAdministraveis`) exclui de "Jornada" qualquer equipe que seja
  `equipeResponsavelId` de **algum** `GrupoPlantao` conhecido — SOC nunca é
  excluída (não é responsável por nenhum Grupo); "Plantão COSI" é excluída
  assim que o `GrupoPlantao` correspondente existir. Antes de o Grupo
  existir, a equipe "Plantão COSI" sozinha ainda apareceria como uma
  Jornada comum — é exatamente por isso que criar a equipe sem o Grupo é
  um estado transitório que a Administração/Wizard devem resolver oferecendo
  a criação do Grupo (seção 7), não deixando a equipe "solta" como Jornada.

---

## 4. `lib/escoposOperacionais.ts` — o resolver único

Módulo puro (`lib/escoposOperacionais.ts`), sem Firestore/React. Recebe:

```ts
resolverEscoposOperacionais(
  usuarioEfetivo: Usuario,
  unidadesOrganizacionais: readonly UnidadeOrganizacional[],
  equipes: readonly Equipe[],
  gruposPlantao: readonly GrupoPlantao[],
): EscoposOperacionais
```

Devolve:

```ts
interface EscoposOperacionais {
  unidadesAdministraveis: UnidadeOrganizacional[];
  equipesAdministraveis: Equipe[];
  jornadasAdministraveis: Equipe[];       // equipesAdministraveis - responsáveis de algum GrupoPlantao
  gruposPlantaoAdministraveis: GrupoPlantao[];
  plantoesAdministraveis: GrupoPlantao[]; // alias — nome usado pelo seletor superior/Wizard
}
```

Regras implementadas (mesma numeração usada na fase de planejamento):

1. `ADMIN_SISTEMA` vê/administra tudo (todas as unidades ativas, todas as
   equipes ativas, todo Grupo de Plantão ativo).
2. `GESTOR_UNIDADE` vê/administra unidades ativas dentro de
   `unidadesPermitidasEfetivas()` — match exato OU subárvore (regra 4).
3. `GESTOR_UNIDADE` administra equipes ativas cuja `unidadeId` esteja
   dentro do seu escopo (match exato ou subárvore via `caminhoUnidade`).
4. Subárvore é resolvida via **caminho materializado**
   (`UnidadeOrganizacional.caminho`/`Equipe.caminhoUnidade`/
   `GrupoPlantao.caminhoUnidadeResponsavel`), calculado uma única vez na
   criação — **nunca travessia dinâmica de `parentId`** em tempo de
   leitura/regra (mesmo princípio de
   `HIERARQUIA_ORGANIZACIONAL.md` § 2/§ 6).
5. `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` continuam restritos a
   `equipesPermitidasEfetivas()` — sem nenhuma unidade administrável.
6. `ANALISTA_SOC`/`ANALISTA_SUPORTE`/`LEITURA` não administram nada (as
   três listas ficam vazias).
7. Um `GrupoPlantao` é administrável quando: `ADMIN_SISTEMA`; OU gestor da
   equipe responsável (`GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` com a equipe em
   `equipesPermitidasEfetivas()`); OU `GESTOR_UNIDADE` cuja unidade
   permitida contenha a unidade responsável do Grupo (match exato ou
   ancestral).
8. A leitura de `GrupoPlantao` para fins de GESTÃO nunca depende só de
   `equipesConsulta` — ver seção 5 (`firestore.rules` e
   `lib/firebase/plantaoReadRepository.ts`).
9. `equipesConsulta` continua sendo ACL de CONSULTA
   (`HIERARQUIA_ORGANIZACIONAL.md` § 9), nunca lista de administradores —
   `resolverEscoposOperacionais()` nunca lê `equipesConsulta` para decidir
   quem administra.

Consumido por: `apps/dashboard/src/DashboardApp.tsx` (Administração,
seletor superior, `ScheduleStartWizard`), sempre como a ÚNICA fonte —
nenhuma tela reimplementa a mesma regra de autorização isoladamente.

---

## 5. `GrupoPlantao.unidadeResponsavelId`/`caminhoUnidadeResponsavel` — campos novos

`packages/contrato/src/modeloPlantaoPersistente.ts` ganhou dois campos
**opcionais e retrocompatíveis**:

```ts
interface GrupoPlantao {
  // ...campos existentes, inalterados...
  unidadeResponsavelId?: string;
  caminhoUnidadeResponsavel?: string[];
}
```

- **Por que precisam existir**: sem eles, autorizar `GESTOR_UNIDADE` sobre
  um Grupo exigiria a Rule fazer um `get()` na `Equipe` responsável a cada
  avaliação — funcionalmente possível, mas o projeto já resolve esse
  mesmo problema em outro lugar por denormalização validada na escrita
  (`destinatarioEquipeId` em `lembretesAtribuidos`) em vez de leitura
  indireta a cada checagem; seguimos o mesmo padrão aqui.
- **Retrocompatibilidade real, não só de schema**: um `GrupoPlantao`
  criado antes desta fase não tem esses campos — ele continua 100%
  administrável por `GESTOR_EQUIPE`/`ADMIN_SISTEMA` (nada mudou nesse
  caminho), só NÃO fica administrável por nenhum `GESTOR_UNIDADE` até
  alguém (com poder de gestor sobre a equipe responsável, ou já
  `ADMIN_SISTEMA`) editar o Grupo e preencher o campo.
- **Mutável, ao contrário de `equipeResponsavelId`** (que é imutável por
  design, ver `PLANTOES.md` § 20.3): se a equipe responsável migrar de
  unidade depois, `unidadeResponsavelId` do Grupo não se atualiza sozinho
  — precisa ser corrigido por quem já administra o Grupo. Risco aceito e
  documentado (seção 8).
- **Nunca inferido por nome/sigla** — sempre copiado explicitamente do
  `Equipe.unidadeId`/`caminhoUnidade` da equipe responsável no momento da
  criação/edição do Grupo (`DashboardApp.tsx`, `criarGrupoWizard()`).

---

## 6. O que `GESTOR_UNIDADE` pode fazer na Administração

- **Ver a subárvore** da(s) unidade(s) permitida(s) — `unidadesAdmin`/
  `equipesAdmin` continuam as mesmas listas carregadas para todo mundo;
  `resolverEscoposOperacionais()` decide o que é editável.
- **Criar unidade filha** abaixo de uma unidade permitida (já existia —
  `ADMINISTRACAO_E_HIERARQUIA.md`).
- **Criar equipe** dentro de uma unidade permitida (`ModalEquipe`,
  `firestore.rules` `equipes.create`).
- **Editar equipe** dentro do escopo (`ModalEquipe`, toggle "Ativa" —
  nunca exclusão física, ver seção 6.1).
- **Migrar equipe** entre unidades — desde que ORIGEM e DESTINO estejam
  ambas dentro do escopo permitido (seção 6.2). Migrar NUNCA move usuários
  automaticamente — `Usuario.equipeId` não é tocado por uma migração de
  equipe.
- `ADMIN_SISTEMA` continua operando a árvore inteira, sem essas
  restrições.

### 6.1 Desativação é sempre `ativa: false`

Não existe exclusão física de `Equipe`/`UnidadeOrganizacional`/
`GrupoPlantao` — nunca existiu (`firestore.rules`, `delete: if false` nas
três coleções) e esta fase não muda isso. "Excluir" na UI (`ModalEquipe`/
`ModalUnidadeOrganizacional`, checkbox "Ativa") sempre grava
`ativa: false` (ou `ativo: false` para Grupo de Plantão), preservando toda
referência histórica (`turnosMes.equipeId`, `usuarios.equipeId`,
`GrupoPlantao.equipeResponsavelId` continuam válidos).

### 6.2 Migração de equipe — o que muda de verdade

Migrar = editar `Equipe.unidadeId` (e recalcular `caminhoUnidade` a partir
do `caminho` da nova unidade) via `ModalEquipe` → `salvarEquipeDoModal()`.

**Correção de segurança nesta fase**: antes, `firestore.rules` só validava
a unidade ATUAL da equipe no `update` (`resource.data.unidadeId`) — o
`unidadeId` de DESTINO do payload nunca era checado, então nada impedia
mover uma equipe para uma unidade fora do escopo do gestor. A partir desta
fase, o `update` exige que ORIGEM **e** DESTINO estejam dentro do escopo
permitido (match exato ou subárvore) — ver `firestore.rules`,
`match /equipes/{equipeId}`.

---

## 7. Wizard (`ScheduleStartWizard`) — Nova escala / Importar escala

- **Jornada 6x1** (`Nova escala`/`Importar escala` → "Jornada 6x1"): lista
  `jornadasAdministraveis` — nunca uma equipe que já é responsável por um
  Grupo de Plantão.
- **Plantão** (`Nova escala`/`Importar escala` → "Plantão"): lista
  `plantoesAdministraveis`. Se houver exatamente um destino, pré-seleciona
  (`resolverGrupoParaPlantao`/`resolverUnicoOuAmbiguo`, `lib/inicioEscala.ts`);
  se houver mais de um, pede escolha; se não houver nenhum mas houver
  equipe administrável sem Grupo (ex.: equipe "Plantão COSI" recém-criada),
  oferece **criar o `GrupoPlantao`** correspondente
  (`criarGrupoWizard()`), vinculado à unidade e à equipe responsável
  corretas — nunca cria a escala direto sobre a Equipe.
- Sem permissão nenhuma sobre nada: mensagem explícita de falta de escopo
  (nunca uma mensagem genérica de erro).
- **O arquivo XLS/XLSX de Plantão só aparece depois de tipo, destino e
  competência estarem definidos** (`ScheduleStartWizard.tsx`, bloco de
  upload condicionado a `podeContinuar`/`modo === 'IMPORTAR'`) —
  comportamento pré-existente, preservado nesta fase.
- **Importação de Plantão sempre abre o revisor de Plantão, nunca o de
  Jornada 6x1** — `processarArquivoImportado()`/`interpretarPlantao()`
  decidem pelo TIPO detectado da planilha, nunca pelo tipo escolhido no
  Wizard isoladamente; os dois tipos nunca compartilham o mesmo
  componente de revisão (`ScheduleImportReview` é usado só para Jornada;
  Plantão usa seu próprio bloco de preview/conciliação, `PLANTOES.md` § 19).

---

## 8. Riscos e limitações aceitas nesta fase

- **`unidadeResponsavelId` do Grupo não acompanha automaticamente a
  migração da equipe responsável** — se a equipe migrar para outra
  unidade depois de o Grupo já existir, alguém com poder de gestor
  precisa reabrir o Grupo e corrigir o campo manualmente. Não é
  recalculado em background nem em nenhum gatilho automático.
- **`souGestor()`/`souGestorDePlantao()` continuam sem incluir
  `SUPERVISOR_EQUIPE`** — divergência PRÉ-EXISTENTE (documentada, não
  criada nesta fase): `docs/spec/HIERARQUIA_ORGANIZACIONAL.md` § 6 afirma
  que `SUPERVISOR_EQUIPE` tem "mesmo alcance de `GESTOR_EQUIPE`", mas
  `firestore.rules`/`lib/sessao.ts` (`souGestor()`) só checam
  `meuPerfil() == 'GESTOR_EQUIPE'` — não incluem `SUPERVISOR_EQUIPE`
  nessa checagem específica. Não corrigido nesta fase (fora do escopo:
  esta fase mexe em `GESTOR_UNIDADE`, não nessa divergência de
  `SUPERVISOR_EQUIPE`); registrado aqui para avaliação futura, seguindo a
  mesma disciplina de "não corrigir silenciosamente" de
  `HIERARQUIA_ORGANIZACIONAL.md` § 17.
- **Reparentar uma `UnidadeOrganizacional` (mudar `parentId` de uma
  unidade já existente) não valida se o NOVO `parentId` está dentro do
  escopo do gestor** — mesma classe de gap que existia para migração de
  equipe (seção 6.2) antes desta fase, mas para unidades. Não corrigido
  nesta fase (fora do pedido explícito, que cobria migração de EQUIPE);
  registrado como risco conhecido para uma fase futura.
- **`scripts/seed-firebase-lab.mjs`/`seed/seed.ts`** (seed do ambiente
  "Firebase Lab"/staging real) não foram atualizados nesta fase — só
  `lib/demoIdentidades.ts` (laboratório local, sem Firestore) reflete o
  novo modelo (unidade COSI real, coordenador `GESTOR_UNIDADE`). Alterar
  o seed de staging é uma mudança de infraestrutura mais arriscada,
  deixada para uma fase dedicada.
- **Complexidade das Rules**: `firestore.rules` já é um arquivo grande;
  o emulador emitiu avisos de "maximum de 1000 expressions" em alguns
  cenários de teste desta fase (sempre em casos que já esperavam
  negação — nenhum teste passou por engano). Vale simplificar as
  condições de `gruposPlantao` numa fase futura se o arquivo continuar
  crescendo. Na Fase PROVISIONAMENTO-GRUPO-PLANTAO-1 (seção 9 abaixo) esse
  aviso ficou um pouco mais frequente (o `update` passou a chamar
  `podeGerenciarGrupoPlantao()` duas vezes) — continua só um aviso, nenhum
  teste passou por engano, mas reforça que vale simplificar.

---

## 9. Provisionamento de Grupo de Plantão (Fase PROVISIONAMENTO-GRUPO-PLANTAO-1)

Causa raiz observada em staging: mesmo com a unidade COSI, a equipe SOC e
a equipe "Plantão COSI" corretamente cadastradas (e o coordenador já
`GESTOR_UNIDADE` de COSI, seção 1 acima), o Wizard continuava mostrando
"Nenhum Grupo de Plantão administrável nesta área" — porque faltava o
documento operacional `gruposPlantao/PLANTAO_COSI`, e a única forma
conhecida de criá-lo era pelo Console do Firestore. Esta seção formaliza a
regra permanente para nunca mais depender disso.

### 9.1 Equipe não basta — GrupoPlantao é obrigatório

**Uma Equipe "Plantão COSI" aparecer na árvore de Administração prova que
existe uma equipe organizacional dentro de COSI — nunca prova que existe
um Grupo de Plantão operacional.** `Equipe` e `GrupoPlantao` são entidades
diferentes (`HIERARQUIA_ORGANIZACIONAL.md` § 10); a escala de Plantão é
sempre importada/montada sobre um `GrupoPlantao` (`equipeResponsavelId`
apontando para a equipe), nunca diretamente sobre a `Equipe`. Isso vale
mesmo que o nome da equipe contenha literalmente "Plantão" — o sistema
nunca decide isso por nome/sigla (regra permanente, seção 16 de
`HIERARQUIA_ORGANIZACIONAL.md`).

### 9.2 O produto oferece a criação — nunca só o Console do Firestore

Dois pontos oficiais de criação/vinculação de `GrupoPlantao`, ambos
usando `lib/gruposPlantaoProvisionamento.ts` (`construirGrupoPlantaoOficial()`/
`derivarUnidadeResponsavelDoGrupoPlantao()`) como fonte única da derivação
de `unidadeResponsavelId`/`caminhoUnidadeResponsavel` — nunca digitados
pelo usuário, sempre copiados da `Equipe` responsável escolhida:

1. **`ScheduleStartWizard` → "Nova escala"/"Importar escala" → Plantão**
   (`criarGrupoWizard()`, `apps/dashboard/src/DashboardApp.tsx`): quando
   existe equipe administrável na área mas nenhum Grupo, o Wizard oferece
   criar o Grupo inline (nome + equipe responsável, o resto com valores
   padrão) e seleciona o Grupo criado automaticamente.
2. **Administração → Grupos de Plantão** (`ModalGrupoPlantao`, mesmo
   arquivo): CRUD completo — nome, descrição, equipe responsável (via
   `OrganizationTeamPicker`), equipes que consultam, timezone, ativo/
   inativo, padrão semanal. Lista todos os Grupos administráveis por
   unidade/equipe responsável (`tela === 'plantoes'`), nunca some das
   Rules — reaproveita `podeGerenciarEsteGrupoPlantao()`.

**Bug corrigido nesta fase**: até aqui, só o caminho 1
(`criarGrupoWizard()`) preenchia `unidadeResponsavelId`/
`caminhoUnidadeResponsavel` — `ModalGrupoPlantao` (caminho 2) não
preenchia nada, então um `GESTOR_UNIDADE` que tentasse criar/editar um
Grupo pela tela de Administração (em vez do fluxo inline do Wizard) tinha
a escrita negada pelas Rules sem entender por quê. Os dois caminhos agora
usam a mesma função de derivação.

**Nenhuma versão estável (staging ou produção) pode depender de alguém
abrir o Console do Firestore para criar `gruposPlantao/{grupoId}`
manualmente.** Se um dia isso for necessário de novo, é sinal de que um
dos dois caminhos acima regrediu — não uma exceção aceitável.

### 9.3 O Wizard diagnostica a ausência de Grupo, nunca mostra erro genérico

Quando existe equipe administrável na área mas nenhum `GrupoPlantao`
administrável, o Wizard mostra:

> Existe equipe de Plantão nesta área, mas ainda não há Grupo de Plantão
> vinculado. Crie o grupo para importar ou montar a escala.

— seguido imediatamente do formulário inline de criação (seção 9.2, item
1). Só quando NÃO existe equipe alguma administrável na área é que aparece
a mensagem anterior ("Nenhuma equipe responsável disponível") com a opção
de criar a equipe primeiro. As duas mensagens são mutuamente exclusivas —
nunca a genérica sozinha quando o diagnóstico específico se aplica.

### 9.4 Seletor superior — só a partir de GrupoPlantao administrável

O seletor superior (`ScheduleContextSwitcher`) só mostra um item em
PLANTÕES quando existe um `GrupoPlantao` administrável
(`plantoesAdministraveis`/`podeGerenciarEsteGrupoPlantao()`) — **nunca a
partir de uma Equipe por nome/sigla**. Uma equipe "Plantão COSI" sem
Grupo vinculado não aparece em PLANTÕES (nem em JORNADAS — ver seção 3);
ela só aparece na árvore de Administração como equipe existente, com a
mensagem de diagnóstico da seção 9.3 disponível no Wizard.

### 9.5 Seed/bootstrap idempotente

`scripts/seed-organizacao.mjs` (staging; o mesmo script serve para uma
futura versão estável/prod, só trocando o projeto Firebase apontado pelas
variáveis de ambiente) garante, de forma idempotente:

- unidade COSI, equipe SOC e equipe "Plantão COSI" (já existia antes desta
  fase);
- `gruposPlantao/PLANTAO_COSI` — cria se não existir; se já existir, só
  GARANTE `unidadeResponsavelId`/`caminhoUnidadeResponsavel`/
  `equipesConsulta` (união, nunca remove uma equipe já autorizada) —
  nunca sobrescreve `nome`/`descricao`/`timezone`/`ativo`/
  `padraoHorarioSemanal` que o coordenador possa ter editado depois;
  detecta e avisa (sem tentar corrigir) se `equipeResponsavelId` já
  existente divergir do esperado (campo imutável nas Rules);
- opcionalmente, o perfil de coordenador COSI de um usuário REAL já
  cadastrado (`ESCALA_SEED_ORG_LOGIN_COORDENADOR_COSI`) — nunca cria
  usuário novo, nunca rebaixa um `ADMIN_SISTEMA` existente, exige uma
  segunda confirmação explícita (`--confirm-coordenador=...`) por mexer em
  permissão de uma pessoa real.

Roda em `--dry-run` por padrão (só imprime o plano); exige
`--execute --confirm=SEED_ORGANIZACAO_STAGING` para gravar.

**Checklist de bootstrap para staging/versão estável** (nesta ordem):

1. `unidadesOrganizacionais`/`equipes` da hierarquia real existem (rodar
   `seed-organizacao.mjs --dry-run` e conferir o plano).
2. O(s) usuário(s) coordenador(es) de unidade já têm `perfil:
   GESTOR_UNIDADE`, `escopo: UNIDADE`, `unidadeId`/`unidadesPermitidas`
   corretos (via `seed-organizacao.mjs --confirm-coordenador=...` ou pela
   tela Administração → Usuários, só `ADMIN_SISTEMA`).
3. `gruposPlantao/{grupoId}` de cada equipe de Plantão existe, com
   `unidadeResponsavelId`/`caminhoUnidadeResponsavel` corretos (rodar o
   mesmo script com `--execute --confirm=SEED_ORGANIZACAO_STAGING`, ou
   deixar o coordenador criar pelo Wizard/Administração — seção 9.2).
4. Confirmar no seletor superior: JORNADAS mostra as equipes esperadas,
   PLANTÕES mostra os Grupos esperados — nunca uma equipe "Plantão" solta
   em JORNADAS.
5. Nenhum passo acima deveria exigir o Console do Firestore — se exigir,
   é uma regressão a corrigir antes de liberar a versão.
