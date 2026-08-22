# Especificação — STAGING-RESET-HIERARQUIA-ICI (fases 1, 2 e 3)

**Status:** implementado (código, scripts dry-run, specs, testes) — reset real,
seed real, deploy de Rules/Índices e build/deploy de produção **não
executados**, aguardando aprovação humana explícita.

Este documento cobre três fases:

- **STAGING-RESET-HIERARQUIA-ICI-1** — reset controlado do staging com o
  organograma canônico do ICI e liberação operacional ampla (Jornada/
  Plantão/trocas/Matriz) para coordenador/supervisor, exclusiva de staging.
- **STAGING-RESET-HIERARQUIA-ICI-2** — corrige dois problemas encontrados
  após o reset: (a) `COSI`/`CODB`/`COCR` eram usados como `unidadeId`
  persistido, quando deveriam ser só a `sigla` (o `unidadeId` técnico é
  `GEDSI_COSI`/`GEDSI_CODB`/`GEDSI_COCR`); (b) o cadastro de usuário travava
  o coordenador na própria equipe, quando em staging ele precisa poder
  cadastrar em qualquer unidade/equipe ativa (ainda não se conhece toda a
  árvore real do ICI). Também adiciona descrição textual obrigatória para
  `nivelHierarquico` na UI (nunca só o número/enum cru).
- **STAGING-RESET-HIERARQUIA-ICI-3** — corrige a MODELAGEM DE PESSOAS: a
  fase 2 tinha promovido "Marina" (um fixture de teste, nunca uma pessoa
  real) a coordenadora fixa do COSI, e modelado "Wanessa" incorretamente
  como coordenadora do CODB (ela é supervisora do NOC). Remove qualquer
  pessoa do seed ESTRUTURAL (só a conta técnica `admin` permanece), separa
  um seed OPCIONAL de demonstração com nomes genéricos
  (`scripts/staging/usuarios-demo.mjs`), documenta a configuração real
  esperada (coordenador do COSI, login `clis`; supervisora do NOC; futuro
  coordenador do CODB) como dado de banco/configuração — nunca código — e
  corrige a causa raiz de o campo Equipe do modal de cadastro continuar
  travado em staging (§ 5.5).

## 1. Por que esta fase existe

O staging acumulou correções parciais, permissões antigas, IDs organizacionais
legados (`EQ_SOC`, `EQ_PLANTAO_COSI`, `EQ_NOC`) e uma Matriz de Responsáveis
(`escoposOperacionais`) incompleta que, juntos, travam coordenadores no dia a
dia — por exemplo, SOC sumindo do seletor de Jornada, ou "Você não é
responsável por esta Jornada na Matriz" ao aprovar uma troca, mesmo sendo o
coordenador de fato daquela equipe.

Esta fase prepara (e, quando aprovada, executa) um reset controlado do
staging com o organograma real do ICI usando IDs canônicos, e simplifica a
permissão operacional para coordenadores/supervisores **exclusivamente em
staging**, sem tocar produção — ver `docs/spec/MIGRACAO_IDS_ORGANIZACIONAIS_PRODUCAO.md`
para o corte de produção correspondente (formalmente separado deste).

Depois do primeiro reset, apareceu um segundo problema (STAGING-RESET-HIERARQUIA-ICI-2):
o modal de cadastro de usuário continuava prendendo o coordenador na própria
equipe/unidade, e os IDs de coordenação (`COSI`/`CODB`/`COCR`) tinham sido
persistidos como `unidadeId` — quando o padrão canônico exige o prefixo da
gerência (`GEDSI_COSI`/`GEDSI_CODB`/`GEDSI_COCR`). As seções 3, 5.5, 6 e 13
abaixo documentam a correção.

Depois disso, um terceiro problema (STAGING-RESET-HIERARQUIA-ICI-3): o campo
Equipe do modal AINDA aparecia travado em staging (causa raiz era de
configuração de ambiente, não de código — ver § 5.5), e a modelagem de
pessoas da fase 2 tinha dois erros — "Marina" nunca foi uma pessoa real
(era um fixture de teste promovido, por engano, a coordenadora fixa do
COSI), e "Wanessa" foi modelada como coordenadora do CODB quando na
verdade é supervisora do NOC. A seção 6 documenta a correção: pessoas saem
do seed estrutural, um seed opcional de demonstração usa nomes genéricos, e
a configuração real esperada (coordenador do COSI = `clis`; supervisora do
NOC; futuro coordenador do CODB) fica documentada, não codificada.

## 2. Organograma canônico

```text
PRE (Presidência)
├── DSI (Diretoria de Sistemas e Inovação)
├── DIO (Diretoria de Infraestrutura e Operações)
│   ├── GEDSI (Gerência de Data Center e Segurança da Informação)
│   │   ├── GEDSI_COSI (sigla COSI — Coordenação de Segurança da Informação)
│   │   │   ├── GEDSI_COSI_SOC        [EQUIPE]
│   │   │   └── GEDSI_COSI_PLANTAO    [EQUIPE]
│   │   ├── GEDSI_CODB (sigla CODB — Coordenação de Data Center e Banco de Dados)
│   │   │   └── GEDSI_CODB_NOC        [EQUIPE]
│   │   └── GEDSI_COCR (sigla COCR — Coordenação de Conectividade e Redes)
│   ├── GESUP (Gerência de Infraestrutura e Suporte Técnico)
│   │   ├── GESUP_CSTE, GESUP_COAT, GESUP_COSD (Coordenações)
│   └── GEOPE (Gerência de Operações)
│       └── GEOPE_COAC, GEOPE_COPC (Coordenações)
├── DAF (Diretoria Administrativa e Financeira)
└── DJC (Diretoria Jurídica e Compliance)

PRE
└── ASRIM (Assessoria de Relações Institucionais e Mercado)
```

**STAGING-RESET-HIERARQUIA-ICI-2 — `unidadeId` sempre prefixado pela
gerência, nunca a sigla solta**: `COSI`/`CODB`/`COCR` (e as coordenações de
GESUP/GEOPE) são a `sigla` de exibição, nunca o `unidadeId` persistido —
esse é sempre `GEDSI_COSI`/`GEDSI_CODB`/`GEDSI_COCR`/`GESUP_CSTE`/
`GESUP_COAT`/`GESUP_COSD`/`GEOPE_COAC`/`GEOPE_COPC` (padrão
`<GERENCIA>_<COORDENACAO>`, mesma lógica de `GEDSI_COSI_SOC` para equipes —
ver `docs/spec/MIGRACAO_IDS_ORGANIZACIONAIS_PRODUCAO.md`). Isso corrige um
erro da primeira versão desta fase, em que `COSI`/`CODB`/`COCR` foram
persistidos como `unidadeId` — indistinguíveis da sigla, e sem o prefixo que
o restante do organograma (equipes, Matriz) já usa.

Nomes completos, siglas e o restante da árvore (DSI/DAF/DJC/GESUP/GEOPE por
inteiro) vêm de `docs/spec/ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md` §§ 3-4 —
fonte de verdade do organograma real do ICI. Este reset semeia só o
subconjunto necessário para destravar SOC/Plantão COSI/NOC; o restante da
árvore existe na spec de referência e pode ser semeado depois pela própria
Administração do Dashboard.

Tipos de unidade: `PRESIDENCIA`, `DIRETORIA`, `ASSESSORIA`, `GERENCIA`,
`COORDENACAO`, `SUPERVISAO` (as duas primeiras GRUPO_OPERACIONAL/EQUIPE do
"Modelo recomendado" da spec de referência mapeiam para as coleções
`equipes`/`gruposPlantao`, não para `unidadesOrganizacionais` — nunca
duplicadas). `ASSESSORIA` foi adicionada ao enum (`TipoUnidadeOrganizacional`,
`lib/modelos.ts`) nesta fase — antes não existia.

Cada `UnidadeOrganizacional` tem: `unidadeId`, `sigla`, `nome`, `tipo`,
`nivelHierarquico` (`DELIBERATIVO`/`ESTRATEGICO`/`TATICO`/`OPERACIONAL` —
classificação de echelon, ver `docs/spec/ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md`
§ 2; **não** é o campo numérico `Usuario.nivelHierarquico`, conceito
diferente), `parentId`, `caminho`, `ativa`, `ordem`, `observacao`,
`schemaVersion` — os quatro últimos e `ASSESSORIA` são adições desta fase ao
modelo (`lib/modelos.ts`), todas opcionais/retrocompatíveis.

Cada `Equipe` tem: `id`, `sigla`, `nome`, `unidadeId`, `caminhoUnidade`,
`ativa`, `ordem`, `codigoOrganizacional`, `schemaVersion` — os três últimos
também são adições opcionais desta fase. `codigoOrganizacional` é um
SNAPSHOT do código derivado descrito em `docs/spec/ESCALA_ICI_MASTER_SPEC.md`
§ 19 (formato `Gerência_Área_Equipe`), nunca uma nova fonte de verdade — para
os IDs canônicos abaixo ele coincide com o próprio `id`, porque o ID técnico
já nasce nesse formato.

## 3. IDs canônicos

| ID legado (staging antigo) | ID canônico (staging reiniciado / produção) |
|---|---|
| `EQ_SOC` | `GEDSI_COSI_SOC` |
| `EQ_PLANTAO_COSI` | `GEDSI_COSI_PLANTAO` |
| `EQ_NOC` | `GEDSI_CODB_NOC` |

O mapeamento (`MAPEAMENTO_LEGADO` em `scripts/staging/hierarquia-ici.mjs`)
existe **só para documentação e para o relatório de `validate-staging.mjs`** —
nenhum script cria um documento novo usando os IDs legados.

### 3.1 Grupo de Plantão — decisão de nomenclatura

O Grupo de Plantão continua sendo uma entidade **separada** da equipe
responsável (mesmo padrão do staging antigo: `PLANTAO_COSI` ≠
`EQ_PLANTAO_COSI` — ver `docs/spec/MIGRACAO_IDS_ORGANIZACIONAIS_PRODUCAO.md`
§ 1, "grupoId é identidade separada"). Canonizado com o mesmo prefixo:

- `equipeId` responsável: **`GEDSI_COSI_PLANTAO`**
- `grupoId`: **`PLANTAO_GEDSI_COSI`**
- `label`/nome: **"Plantão COSI"**

Escolhido em vez de manter só `PLANTAO_COSI` (que colidiria com o ID legado
do grupo antigo) e em vez de igualar `grupoId` a `equipeId` (que romperia o
modelo de dados atual, onde Grupo e Equipe são coleções distintas com Rules
próprias). `equipesConsulta` do grupo inclui a própria equipe responsável
(`GEDSI_COSI_PLANTAO`) e o SOC (`GEDSI_COSI_SOC`), mesma visibilidade cruzada
que o staging antigo já tinha.

## 4. Mecanismo de liberação operacional exclusiva de staging

**Problema estrutural**: existe um único `firestore.rules`, compartilhado por
staging e produção (não há `firebase.json` com múltiplos targets/projetos).
Qualquer regra nova precisa ser gated por DADO, nunca incondicional — do
contrário, vaza para produção no dia em que alguém rodar deploy desse mesmo
arquivo lá.

**Solução**: documento `config/ambiente` (`{ staging: true }`), escrito
**apenas** pelo Admin SDK do script de seed (`config/{doc}` já nega toda
escrita client hoje, `allow write: if false` — isso não muda). Em
`firestore.rules`:

```
function ambienteEhStaging() {
  return exists(/databases/$(database)/documents/config/ambiente)
    && get(/databases/$(database)/documents/config/ambiente).data.get('staging', false) == true;
}

function souCoordenadorOperacionalStaging() {
  return autenticado()
    && ambienteEhStaging()
    && meuPerfil() in ['ADMIN_SISTEMA', 'GESTOR_UNIDADE', 'GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'];
}
```

Ausência do documento (toda base de produção, e staging antes do seed rodar)
faz `ambienteEhStaging()` avaliar `false` — comportamento idêntico ao
anterior a esta fase, **fail-closed por padrão**. Produção nunca depende
disso por omissão: só passaria a se comportar como staging se alguém
criasse manualmente `config/ambiente` com `staging: true` na base de
produção via Admin SDK — ação deliberada, fora do alcance de qualquer client,
e que nenhum script deste repositório executa contra produção.

`souCoordenadorOperacionalStaging()` é usada como mais um `||` em:

- `podeAdministrarJornada(equipeId)` — restrito a `podeOperarNaEquipe(equipeId)`.
- `podeAdministrarEscalaPlantao(grupoId)` / `podeGerenciarGrupoPlantao(grupoDoc)`
  — restrito ao escopo do Grupo (`escopoDoGrupoPlantaoNoMeuAlcance()`, extraído
  de `podeGerenciarGrupoPlantao()` para ser reaproveitado sem duplicar a
  checagem de unidade/caminho ancestral).
- Escrita de `escoposOperacionais` (Matriz) — restrita ao alvo dentro do
  próprio escopo (ver § 5).
- `create` de `auditoriaAdmin` — sem restrição de escopo adicional além de
  `atorRealLogin == loginDoAuth()` (já existente).

Deliberadamente **fora** do bloco `!existeMatrizOperacional(...)` que guarda
o fallback legado — é exatamente o caso que o fallback legado não cobre: uma
Matriz que **existe** para o alvo mas não lista o coordenador de teste.

**Nunca usada para afrouxar**: criação/promoção de `ADMIN_SISTEMA`, escopo
`GLOBAL`, ou qualquer delete físico já negado com `if false` (auditoria,
histórico, publicações, competências, Grupo de Plantão, Matriz) — todas essas
regras permanecem intocadas por esta fase, em staging e em produção.

Mirror client-side (`lib/sessao.ts`): `ehPerfilElegivelParaAmploStaging()` e
`escopoDoGrupoPlantaoNoMeuAlcance()` alimentam `resolverEscoposOperacionais()`
(`lib/escoposOperacionais.ts`, opção `permitirAmploStaging`), ligada pela env
var `VITE_ESCALA_STAGING_PERMISSAO_AMPLA=true` (só em
`.env.staging.dashboard`) — só UX (o que o seletor superior/Wizard oferece);
a autorização real de escrita continua inteiramente nas Rules. Diferente de
`VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO` (existente, que só preenche alvos
SEM Matriz), esta nova flag preenche mesmo alvos cuja Matriz já existe e não
lista o usuário.

## 5. Matriz de Responsáveis — escrita em staging

Em produção, a escrita de `escoposOperacionais` continua exclusiva de
`ADMIN_SISTEMA` (`docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md` § 9.6). Em staging,
`souCoordenadorOperacionalStaging()` também autoriza `create`/`update`,
restrito ao alvo dentro do próprio escopo do coordenador/supervisor
(`podeOperarNaEquipe()` para `JORNADA`, `escopoDoGrupoPlantaoNoMeuAlcance()`
para `PLANTAO`) — nunca abre escrita cross-equipe/unidade. Isso existe para o
teste do organograma novo não travar caso a Matriz semeada fique incompleta
ou desatualizada durante os testes.

## 5.5 Cadastro livre de unidade/equipe (STAGING-RESET-HIERARQUIA-ICI-2)

Depois do reset, o modal de cadastro de usuário (Administração → Usuários)
continuava travando o coordenador na própria equipe (`equipeIdCadastroUsuario`
sempre igual a `usuarioEfetivo.equipeId`) — inclusive para `GESTOR_UNIDADE`,
que administra uma coordenação inteira, não uma equipe. Em staging, ainda não
se conhece toda a árvore real do ICI, então travar numa lista incompleta é
pior do que liberar a escolha.

**Regra final**: quando `config/ambiente.staging == true` **e**
`VITE_ESCALA_STAGING_PERMISSAO_AMPLA=true`, qualquer
`ADMIN_SISTEMA`/`GESTOR_UNIDADE`/`GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` pode
cadastrar um usuário escolhendo livremente `unidadeId`, `unidadesPermitidas`,
`equipeId`, `equipesPermitidas`, perfil (`COLABORADOR` implícito,
`GESTOR_UNIDADE`, `GESTOR_EQUIPE` ou `SUPERVISOR_EQUIPE`) e o escopo
correspondente — **sem** checar se quem cadastra administra a unidade/equipe
escolhida (isso é precisamente o que travava o coordenador).

Rules (`firestore.rules`) — novo terceiro ramo em `match /usuarios/{login} { allow create }`,
paralelo aos dois já existentes (`souAdminSistema()` e a delegação clássica
via `contextoCadastroOperacionalAutorizaUsuario()`):

```
|| (
  souCoordenadorOperacionalStaging()
  && request.resource.data.get('cadastroOperacional', null) == null
  && perfilCadastroLivreStagingValido(request.resource.data)
)
```

`perfilCadastroLivreStagingValido(dados)` valida só a COMBINAÇÃO
perfil/escopo/unidade/equipe (nunca se o alvo é administrado por quem
cadastra):

- `perfil` ausente → `escopo` também ausente (colaborador comum).
- `perfil == 'GESTOR_UNIDADE'` → `escopo == 'UNIDADE'`, `unidadeId` (string
  não vazia) e `unidadesPermitidas` (lista não vazia).
- `perfil in ['GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE']` → `escopo == 'EQUIPE'`,
  `equipeId` (string não vazia) e `equipesPermitidas` (lista não vazia).
- Qualquer outra combinação (inclusive `perfil == 'ADMIN_SISTEMA'` ou
  `escopo == 'GLOBAL'`) é recusada — enumeração fechada, igual a
  `perfilCadastroPorResponsavelValido()`.

`cadastroOperacional` fica de fora de propósito: esse metadado é da
delegação via Matriz (fase 1), sem sentido para o cadastro livre — a
auditoria vem de `registrarAuditoriaOperacional()`, não desse campo.

Client-side espelho: `perfilDelegavelPorResponsavelOperacional(perfil, permitirAmploStaging)`
(`lib/adminGuards.ts`) passa a aceitar `GESTOR_UNIDADE` como terceiro perfil
delegável quando `permitirAmploStaging` (= `usarCadastroLivreStaging` no
Dashboard) é `true`. O modal de cadastro (`DashboardApp.tsx`) troca o campo
"Equipe" (antes um `<input disabled>`) por dois `<select>` livres — Unidade e
Equipe, populados por `unidadesAdmin`/`equipesAdmin` (já sem filtro de
escopo, lidos com `allow read: if autenticado()`) — e o `<select>` "Acesso no
sistema" passa a oferecer também "Gestor de unidade". Vazio mostra
**"Nenhuma unidade ativa encontrada."**/**"Nenhuma equipe ativa
encontrada."**, nunca um selectbox mudo.

Persistência (`salvarFormularioUsuario()`): o perfil escolhido decide os
campos gravados —

- `GESTOR_UNIDADE` → `escopo: 'UNIDADE'`, `unidadeId` = unidade escolhida,
  `unidadesPermitidas: [unidadeId]`.
- `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` → `escopo: 'EQUIPE'`, `equipesPermitidas: [equipeId]`.
- Sem perfil (colaborador) → só `equipeId` = equipe escolhida.

Nunca inverte: `unidadeId` sempre recebe uma unidade real, `equipeId` sempre
uma equipe real — ver § 13 e `validarNaoInverteUnidadeEquipe()`
(`scripts/staging/validate-staging.mjs`) para a checagem correspondente do
lado dos scripts.

Quando `VITE_ESCALA_STAGING_PERMISSAO_AMPLA` não está ligada (ou o cadastro
é o de vínculo de planilha, que sempre tem um alvo já definido), o campo
"Equipe" volta a ser o `<input disabled>` de antes — mas agora com uma
mensagem explícita: **"Permissão ampla de staging não está ativa; cadastro
restrito à equipe atual."** — para o coordenador nunca confundir "a flag
está desligada" com "o sistema está quebrado".

**STAGING-RESET-HIERARQUIA-ICI-3 — causa raiz do campo Equipe continuar
travado depois da fase 2**: o código já estava correto (`usarCadastroLivreStaging`
já existia e já era usado pela JSX), mas o arquivo `.env.staging.dashboard`
REAL usado no build local/Docker é gitignored (`.env*` no `.gitignore`,
exceto os `.example`) e tinha sido criado ANTES da fase 1 introduzir
`VITE_ESCALA_STAGING_PERMISSAO_AMPLA` — o `.env.staging.dashboard.example`
já tinha a variável, mas o arquivo real de cada máquina/deploy precisa ser
atualizado manualmente, já que não é versionado. `import.meta.env.VITE_ESCALA_STAGING_PERMISSAO_AMPLA`
resolvia para `undefined` (nunca `'true'`), então `PERMITIR_AMPLO_STAGING`
era sempre `false`, independentemente do perfil do usuário logado ou do
estado de `config/ambiente.staging`. Isso é um problema de CONFIGURAÇÃO
local/de ambiente, não de código — qualquer `.env.staging.dashboard` (ou
variável equivalente passada ao `docker compose build`) criado antes desta
fase precisa da linha `VITE_ESCALA_STAGING_PERMISSAO_AMPLA=true` adicionada
manualmente.

## 6. Usuários — seed estrutural vs. pessoas reais (STAGING-RESET-HIERARQUIA-ICI-3)

**Decisão desta fase**: pessoas (reais ou fictícias) NUNCA fazem parte do
seed estrutural. As fases 1 e 2 tratavam "Marina" e "Wanessa" como dado de
seed fixo — Marina nunca foi uma pessoa real (era um fixture de teste
promovido, por engano, a "verdade do produto"), e Wanessa foi modelada
incorretamente como `GESTOR_UNIDADE` do CODB quando na verdade ela é
**supervisora do NOC**, não coordenadora da coordenação inteira. Essa
mistura de dado estrutural com identidade de pessoa é exatamente o problema
que este parágrafo corrige.

### 6.1 Seed estrutural (`USUARIOS_SEED`, sempre executado)

| Login | Perfil | Escopo | Observação |
|---|---|---|---|
| `admin` | `ADMIN_SISTEMA` | `GLOBAL` | Única conta técnica aceita no seed estrutural — resolve o bootstrap do primeiro admin (`docs/operacao/BOOTSTRAP_ADMIN_STAGING.md`); não é uma pessoa. |

Nenhuma outra conta é criada pelo seed estrutural. A Matriz inicial (§ 7)
usa `admin` como `responsaveisLogin` placeholder, só para satisfazer a
validação de schema (`escopoOperacionalValido()` exige a lista não vazia) —
nunca uma afirmação de quem é o coordenador real.

### 6.2 Pessoas reais — configuração esperada (documentação, não código)

Cadastradas depois, via Dashboard (cadastro livre, § 5.5) ou diretamente no
banco por um `ADMIN_SISTEMA` — **nunca neste repositório como dado
versionado**:

**Coordenador real do COSI** (login conhecido: `clis`):

| Campo | Valor |
|---|---|
| `perfil` | `GESTOR_UNIDADE` |
| `escopo` | `UNIDADE` |
| `unidadeId` | `GEDSI_COSI` |
| `unidadesPermitidas` | `['GEDSI_COSI']` |
| `equipeId` | opcional/compatibilidade visual — preferencialmente `GEDSI_COSI_SOC` |
| `ativo` | `true` |

Administra conceitualmente `GEDSI_COSI_SOC`, `GEDSI_COSI_PLANTAO` e
`PLANTAO_GEDSI_COSI` — via `unidadeId`/`unidadesPermitidas`, nunca via
`equipeId`.

**Supervisora do NOC** (Wanessa — login real não fixado neste documento):

| Campo | Valor |
|---|---|
| `perfil` | `SUPERVISOR_EQUIPE` |
| `escopo` | `EQUIPE` |
| `equipeId` | `GEDSI_CODB_NOC` |
| `equipesPermitidas` | `['GEDSI_CODB_NOC']` |
| `unidadeId` | `GEDSI_CODB`, se o cadastro guardar a unidade junto (compatibilidade/contexto, não escopo) |
| `ativo` | `true` |

Ela é supervisora do NOC — **nunca** `GESTOR_UNIDADE`/coordenadora do CODB.

**Coordenador do CODB** (ainda não cadastrado, chefe da supervisora do NOC):

| Campo | Valor |
|---|---|
| `perfil` | `GESTOR_UNIDADE` |
| `escopo` | `UNIDADE` |
| `unidadeId` | `GEDSI_CODB` |
| `unidadesPermitidas` | `['GEDSI_CODB']` |

Sem nome/login fixado — será cadastrado quando a pessoa for definida. Até lá,
`souCoordenadorOperacionalStaging()` já garante que qualquer
`ADMIN_SISTEMA`/`GESTOR_UNIDADE`/`GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE`
existente pode operar `GEDSI_CODB`/`GEDSI_CODB_NOC` em staging sem esperar
esse cadastro (§ 4/§ 5.5) — a ausência do coordenador formal não bloqueia o
uso do sistema.

### 6.3 Usuários de demonstração (opcionais, `usuarios-demo.mjs`)

Para testar os fluxos sem esperar o cadastro real, `scripts/staging/usuarios-demo.mjs`
exporta `USUARIOS_DEMO` — nomes **genéricos** (`coordenador.cosi.teste`,
`coordenador.plantao.teste`, `supervisor.noc.teste`), nunca nomes de pessoa.
`seed-hierarquia-ici.mjs` só grava esses usuários com a flag explícita
`--with-demo-users` — nunca por padrão, e `validate-staging.mjs` nunca exige
que existam.

## 7. Matriz inicial

| Tipo | Alvo | `responsaveisLogin` (seed estrutural) |
|---|---|---|
| `JORNADA` | `GEDSI_COSI_SOC` | `['admin']` (placeholder) |
| `PLANTAO` | `PLANTAO_GEDSI_COSI` | `['admin']` (placeholder) |
| `JORNADA` | `GEDSI_CODB_NOC` | `['admin']` (placeholder) |

Existe para navegação/visualização normal do Dashboard — não é a única via de
autorização: ver § 4 (a liberação ampla cobre o caso da Matriz ficar
incompleta ou apontar só para `admin`). Assim que `clis` (ou quem for o
coordenador de cada alvo) for cadastrado, ele deve ser adicionado a
`responsaveisLogin` via **Administração → Responsáveis por escala** — o seed
nunca faz essa atualização sozinho depois do reset inicial.

## 8. Scripts (`scripts/staging/`)

Todos usam Admin SDK (`firebaseAdminStaging.mjs`), que **aborta** se a
credencial (`GOOGLE_APPLICATION_CREDENTIALS`) não pertencer literalmente ao
projeto `escala-ici-staging` (lê só o campo `project_id` do arquivo de
credencial, antes de inicializar — nunca lê nem expõe a chave privada).

1. **`hierarquia-ici.mjs`** — módulo de dados puro (sem I/O), fonte única do
   organograma/equipes/grupo/matriz/usuários/mapeamento legado. Importado
   por seed e validate, para as duas pontas nunca divergirem.
2. **`firebaseAdminStaging.mjs`** — inicialização do Admin SDK + guarda de
   projeto.
3. **`export-backup.mjs`** — exporta as 15 coleções operacionais
   (`usuarios`, `equipes`, `unidadesOrganizacionais`, `gruposPlantao`,
   `escoposOperacionais`, `turnosMes`, `rascunhosTurnosMes`,
   `publicacoesEscala`, `historicoPublicacoes`, `competenciasPlantao`,
   `rascunhosCompetenciasPlantao`, `atribuicoesPlantao`, `trocasEscala`,
   `notificacoesTroca`, `auditoriaAdmin`) para
   `backups/staging/<timestamp>/<colecao>.json`. Somente leitura.
4. **`reset-staging.mjs`** — dry-run por padrão (conta documentos por
   coleção); só apaga de verdade com `--execute --confirm=RESET_STAGING_ESCALA_ICI`.
   Usa `db.recursiveDelete()` por coleção (inclui subcoleções). Nunca toca
   `config/ambiente` diretamente.
5. **`seed-hierarquia-ici.mjs`** — dry-run por padrão (lista o plano); só
   grava com `--execute --confirm=SEED_HIERARQUIA_ICI_STAGING`. Idempotente
   (`set` com merge). Grava, nesta ordem: unidades, equipes, Grupo de
   Plantão, Matriz inicial, usuários de teste, e `config/ambiente = { staging: true }`.
6. **`validate-staging.mjs`** — só leitura; confirma que tudo acima foi
   criado corretamente e que **nenhum documento novo** usa `EQ_SOC`,
   `EQ_PLANTAO_COSI`, `EQ_NOC` ou o `grupoId` legado `PLANTAO_COSI` (varre o
   grafo mínimo de referências de `docs/spec/MIGRACAO_IDS_ORGANIZACIONAIS_PRODUCAO.md`
   § 3). **STAGING-RESET-HIERARQUIA-ICI-2** acrescenta duas checagens:
   `validarSemUnidadeIdSimples()` (falha se `unidadesOrganizacionais` tiver
   um documento com ID `COSI`/`CODB`/`COCR`) e
   `validarNaoInverteUnidadeEquipe()` (falha se um `unidadeId` real aparecer
   salvo como `equipeId`, ou vice-versa, em `equipes`/`unidadesOrganizacionais`/`usuarios`).
   Sai com código 1 se qualquer checagem falhar.

Scripts npm: `staging:backup`, `staging:reset`, `staging:seed`,
`staging:validate`.

## 9. Auditoria

`registrarAuditoriaOperacional()` (`DashboardApp.tsx`, antes
`registrarAuditoriaSeSimulando`) grava sempre que há um ator autenticado —
não só quando um `ADMIN_SISTEMA` está simulando outra pessoa. `atorSimulado`
aceita `null` (`registrarAuditoriaAdmin()`,
`lib/firebase/auditoriaRepository.ts`); a regra de `create` em
`auditoriaAdmin` aceita `souAdminSistema() || souCoordenadorOperacionalStaging()`.
`read`/`update`/`delete` continuam exclusivos de `ADMIN_SISTEMA`/sempre
negados, em staging e em produção.

Cobre: `ATRIBUIR_LEMBRETE`, `ATRIBUIR_SERIE_LEMBRETES`, `CANCELAR_LEMBRETE`,
`CADASTRAR_USUARIOS`, `SALVAR_RASCUNHO`, `PUBLICAR_ESCALA`, `RECUSAR_TROCA`,
`APROVAR_TROCA`, `ROLLBACK_PUBLICACAO`, `SALVAR_USUARIO`,
`ATIVAR_DESATIVAR_USUARIO`, `ADICIONAR_MEMBRO_GRADE` — o `equipeId` gravado é
sempre o alvo REAL da ação, não necessariamente a equipe do ator (que pode
administrar via Matriz uma equipe diferente da própria).

**JORNADA-IMPORTACAO-VINCULOS-UX-1** acrescentou `ASSOCIAR_USUARIO_IMPORTACAO`,
`ADICIONAR_ALIAS_IMPORTACAO` e `IGNORAR_PENDENCIA_IMPORTACAO` (ações que antes
não geravam nenhuma auditoria), além de campos opcionais em
`registrarAuditoriaAdmin()` — `unidadeId`, `competencia`, `nomeImportado`,
`usuarioVinculadoLogin`, `origem` — todos `null` quando omitidos, sem afetar
nenhuma chamada existente nem exigir mudança em `firestore.rules` (a regra de
`create` de `auditoriaAdmin` não tem allowlist de campos). Ver
`docs/spec/EDITOR_ESCALAS.md` § 14.5.

## 10. O que continua bloqueado, mesmo em staging

- Coordenador/supervisor criar ou promover alguém para `ADMIN_SISTEMA`.
- Coordenador/supervisor usar escopo `GLOBAL`.
- Delete físico de `auditoriaAdmin`, `historicoPublicacoes`,
  `publicacoesEscala`, `competenciasPlantao`, `gruposPlantao`,
  `escoposOperacionais` — sempre `if false`.
- Cadastro delegado de coordenador/supervisor **fora de staging** continua
  restrito a `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` com escopo `EQUIPE`
  (`perfilCadastroPorResponsavelValido()`, já era assim antes desta fase —
  enumeração fechada, não precisou mudar). **Em staging**, o cadastro livre
  (§ 5.5) também aceita `GESTOR_UNIDADE`/escopo `UNIDADE` — mas `ADMIN_SISTEMA`
  e escopo `GLOBAL` continuam impossíveis nos dois casos.
- Unidade e equipe nunca podem ser invertidas na persistência: um
  `unidadeId` real nunca vira `equipeId`, e vice-versa (§ 13,
  `validarNaoInverteUnidadeEquipe()`).

## 11. Testes

- **Rules** (`tests/firebase/firestore.rules.test.ts`, describes
  `STAGING-RESET-HIERARQUIA-ICI-1` e `STAGING-RESET-HIERARQUIA-ICI-2`): com e
  sem `config/ambiente`, provando fail-closed sem o doc;
  GESTOR_EQUIPE/SUPERVISOR_EQUIPE administram Jornada/Plantão mesmo com
  Matriz que não os lista; aprovação/recusa de troca; cadastro de
  colaborador e de coordenador/supervisor restrito; cadastro livre de
  unidade/equipe (colaborador, GESTOR_UNIDADE, GESTOR_EQUIPE,
  SUPERVISOR_EQUIPE, em qualquer unidade/equipe); bloqueio de
  ADMIN_SISTEMA/escopo GLOBAL mesmo em staging (cadastro e update); escrita
  da própria Matriz restrita ao escopo; auditoria gerada só com staging
  habilitado; delete físico sempre negado.
- **Unit** (`lib/sessao.test.ts`, `lib/escoposOperacionais.test.ts`,
  `lib/firebase/auditoriaRepository.test.ts`, `lib/adminGuards.test.ts`,
  `lib/organizacao.test.ts`): os helpers client-side, `atorSimulado: null`,
  `perfilDelegavelPorResponsavelOperacional(perfil, permitirAmploStaging)`,
  `rotuloTecnicoUnidade`/`rotuloTecnicoEquipe`,
  `descreverNivelHierarquico`/`descreverClassificacaoHierarquica`.
- **Dados** (`tests/staging-hierarquia-ici.test.mjs`): organograma com IDs
  canônicos de unidade (`GEDSI_COSI`/`GEDSI_CODB`/`GEDSI_COCR`, nunca
  `COSI`/`CODB`/`COCR` soltos), ausência de IDs legados, `USUARIOS_SEED`
  contendo só a conta técnica `admin` (nenhuma pessoa real ou fictícia),
  `USUARIOS_DEMO` com nomes genéricos, nenhuma inversão unidade/equipe.
- **Boundaries** (`tests/staging-reset-boundaries.test.mjs`,
  `tests/dashboard-contexto-escala-boundaries.test.mjs`,
  `tests/app-boundaries.test.mjs`): dry-run por padrão, confirmação exata,
  guarda de projeto, env var separada (documentada e propagada até
  Dockerfile/compose), seletores livres de Unidade/Equipe com rótulo
  técnico como principal, descrição de nível hierárquico sempre presente,
  seed estrutural e `usuarios-demo.mjs` sem nomes de pessoa real.

## 13. Nível hierárquico — descrição textual obrigatória

`nivelHierarquico` nunca aparece cru na UI (só o número, ou só o enum) — ver
`docs/spec/ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md` § 2/§ 5 para o modelo
completo. Dois conceitos relacionados, mas **não idênticos**, cada um com seu
próprio helper em `lib/organizacao.ts`:

| Campo | Tipo | Onde vive | Helper | Exemplo de saída |
|---|---|---|---|---|
| `Usuario.nivelHierarquico` | número, 0–6 | documento do usuário | `descreverNivelHierarquico(nivel)` | "Nível 4 — Coordenação: administra uma coordenação, como GEDSI_COSI ou GEDSI_CODB." |
| `UnidadeOrganizacional.nivelHierarquico` | enum `DELIBERATIVO`\|`ESTRATEGICO`\|`TATICO`\|`OPERACIONAL` | documento da unidade | `descreverClassificacaoHierarquica(valor)` | "Tático — gerências, coordenações e supervisões, gestão tática." |

Mapeamento de `descreverNivelHierarquico()`: `0` Administração do sistema
(ADMIN_SISTEMA) · `1` Presidência/topo institucional · `2` Diretoria/decisão
estratégica · `3` Gerência/gestão tática · `4` Coordenação/gestão de
coordenação · `5` Supervisão/gestão operacional de equipe · `6`
Operacional/execução diária. Um `GESTOR_UNIDADE` de nível 4 administra uma
unidade cuja classificação é `TATICO` — os dois campos costumam alinhar
conceitualmente, mas vivem em documentos diferentes e não precisam coincidir
numericamente (um valor não deriva do outro).

Usado em: modal de cadastro/edição de usuário (`DashboardApp.tsx`, campo
"Nível hierárquico", sempre com a descrição em `<small>`) e no painel de
detalhe de unidade em Administração → Hierarquia (linha "Nível hierárquico",
só quando o campo está presente — retrocompatível com unidades sem o campo).

## 12. Sequência de aprovação humana (não executada nesta entrega)

1. `npm run staging:backup` (real, contra `escala-ici-staging`).
2. `npm run staging:reset -- --execute --confirm=RESET_STAGING_ESCALA_ICI`.
3. `npm run staging:seed -- --execute --confirm=SEED_HIERARQUIA_ICI_STAGING`.
4. Deploy de Rules/Índices (`npm run firebase:staging:deploy`).
5. `npm run build:apps` (com `VITE_ESCALA_STAGING_PERMISSAO_AMPLA=true`).
6. `npm run staging:validate`.
7. Validação manual na UI (login como cada usuário de teste).

Nenhum desses passos foi executado nesta entrega — só os scripts em dry-run
e a suíte de testes.
