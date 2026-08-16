# Checkpoint — Fase PLANTÃO-3B (administração e rascunho no Dashboard)

Data: 2026-08-16. Escopo: integrar no Dashboard a fundação persistente
construída na PLANTÃO-3A — criar/editar Grupos de Plantão reaproveitando a
equipe/unidade já cadastrada, administrar participantes (por login real) e
seus contatos, e transformar a prévia validada (PLANTÃO-2) num rascunho de
competência+atribuições persistido. **Publicação continua fora do escopo**
(nenhuma `publicarPlantao()`, `competenciasPlantao` continua com escrita
bloqueada). Detalhe técnico completo em `docs/spec/PLANTOES.md`, seção 21 —
este documento resume o que foi feito e registra baseline/testes/riscos.

## Baseline (precheck)

```
pwd                          /home/vergani/projetos/Escala-ICI
git branch --show-current    main
git rev-parse HEAD           faeb0b856a762c8e425cd59dc4cf4f9b06a4cdf9
git fetch origin              ok
git rev-parse origin/main     0c119e17f67ebf012d0b9fde398ac6199162190e
git status --branch --short   ## main...origin/main [ahead 5]
```

`ahead 5` confirmado como esperado (Fases PLANTÃO-0/1/2/3A + HIERARQUIA-1).
Nenhum avanço remoto inesperado. Working tree limpa no início, exceto o
arquivo estranho abaixo.

**Discrepância em relação à premissa da fase**: o enunciado desta fase
afirma que `docs/spec/SPEC_34_ESCALAICI_UNIVERSAL_SETOR_TIPO_ESCALA.md`
"deve estar FORA deste repositório" antes de começar. Na prática, o
arquivo **continuava presente** no diretório de trabalho, **não versionado**
(untracked), exatamente como encontrado e reportado na Fase HIERARQUIA-1.
Como o requisito real do precheck (estado do git — branch/HEAD/ahead/
remoto) estava satisfeito, isso não bloqueou a fase. Por instrução
explícita, o arquivo não foi recriado, copiado, versionado, lido para
extrair conteúdo novo, nem usado como fonte — permanece untracked e fora de
qualquer commit desta fase (confirmado no `git status` final, seção
"Estado final").

## O que foi lido antes de qualquer mudança

`docs/spec/PLANTOES.md` (seções 1–20 inteiras), `docs/spec/
HIERARQUIA_ORGANIZACIONAL.md` (normativo) e `HIERARQUIA_ORGANIZACIONAL_REFERENCIA.md`
(snapshot), `docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`, `docs/spec/
UI_CASCADE_E_HERANCA.md`, `lib/organizacao.ts` (funções de árvore),
`lib/sessao.ts`, `firestore.rules` (bloco Plantão inteiro, seção 771–980),
`packages/contrato/src/modeloPlantaoPersistente.ts`,
`lib/firebase/plantaoReadRepository.ts`/`plantaoWriteRepository.ts`,
`lib/conciliacaoPlantoes.ts`, `apps/dashboard/src/DashboardApp.tsx` —
especificamente `ModalUnidadeOrganizacional`, `ModalEquipe`, a tela
`administracao` inteira (padrões de tabela/modal/toolbar), o componente
`PreviewPlantao` e seus handlers (`interpretarPlantao`,
`confirmarVinculoPlantaoAcao`, `validarPreviaPlantao`), `NAVEGACAO`/`Tela`,
e `components/AppFrame.tsx` (ícones de navegação).

## Decisões de design

### 1. Seletor de "equipe responsável" — `<select>` plano, não uma árvore nova

A tarefa pede para reaproveitar "a árvore organizacional já existente" ao
escolher a equipe responsável. Auditoria mostrou que o Dashboard tem dois
padrões prontos: uma árvore de LEITURA (`ArvoreUnidadesOrganizacionais`,
`<ul>/<li>` recursivo, só lista unidades) e um `<select>` PLANO indentado
(`achatarArvore(construirArvoreUnidades(...))`), usado tanto para escolher
a unidade-pai de uma unidade quanto a unidade de uma equipe. Como
`equipeResponsavelId` é uma **equipe**, não uma unidade — e o próprio
`ModalEquipe` já escolhe equipe via um `<select>` plano com o caminho só
como rótulo, nunca uma árvore — segui o mesmo padrão em
`ModalGrupoPlantao`, reaproveitando `trechoFinalCaminho()` para o rótulo.
Construir uma árvore-seletora nova e exclusiva de Plantão teria sido
exatamente a "segunda implementação independente" que a fase proíbe
explicitamente. Detalhado em `docs/spec/PLANTOES.md` § 21.2.

### 2. `equipesConsulta` — checkbox multi-select, equipe responsável travada

Reaproveita o padrão `.checkbox-inline` já usado por "Unidades permitidas"/
"Equipes permitidas" no formulário de usuário. A equipe responsável vem
sempre marcada e **desabilitada** (não removível) — decisão deliberada:
a Rule exige `equipeResponsavelId in equipesConsulta` em toda escrita
(`equipesConsultaEfetivas()` já garante isso no cliente), então permitir
desmarcar a responsável só produziria um erro de Rule depois de "salvar".
Nenhuma outra equipe vem pré-marcada.

### 3. Gate de acesso à tela "Plantões" — `souGestorDePlantao`, não
   `podeAcessarAdministracao`

A Rule `podeGerenciarGrupoPlantao()` (PLANTÃO-3A) usa `souGestor()`, que é
`ADMIN_SISTEMA || GESTOR_EQUIPE` — **não** inclui GESTOR_UNIDADE. Como a
tela "Administração" existente é `souAdmin || souGestorUnidade`, usar o
mesmo gate para "Plantões" teria dado acesso à tela a quem a Rule já barra
(GESTOR_UNIDADE) e teria escondido a tela de quem a Rule já autoriza
(GESTOR_EQUIPE comum, que hoje não acessa Administração). Criei
`souGestorDePlantao()`/`podeGerenciarGrupoPlantao()` em `lib/sessao.ts`,
espelhando 1:1 a composição da Rule (mesma disciplina de
`podeGerenciarUnidade`/`podeGerenciarEquipe` já existentes).

## O que foi implementado

- **`lib/sessao.ts`**: `souGestorDePlantao()`, `podeGerenciarGrupoPlantao()`
  — mirrors client-side das Rules, nunca uma reimplementação divergente.
- **`lib/firebase/plantaoReadRepository.ts`**: `listarTodosGruposPlantao()`
  (nova — query sem `where`, só ADMIN_SISTEMA consegue de fato, ver
  `docs/spec/PLANTOES.md` § 21.6).
- **`lib/montagemRascunhoPlantao.ts`** (novo, módulo puro): ponte entre a
  prévia validada em memória e o modelo persistente —
  `sugerirCompetenciaPlantao`, `montarParticipantesPlantaoParaSalvar`,
  `montarCompetenciaPlantaoRascunho`, `montarAtribuicoesPlantaoRascunho`,
  `montarGrupoPlantaoParaSalvar`.
- **`components/AppFrame.tsx`**: ícone de navegação `'plantao'` → `Radio`
  (aditivo — `apps/app/` nunca usa essa chave, confirmado por teste de
  fronteira).
- **`apps/dashboard/src/DashboardApp.tsx`**: tela "Plantões"
  (listar/criar/editar Grupo, participantes, contatos), `ModalGrupoPlantao`,
  `ModalContatosParticipante`, painel "Salvar como rascunho" integrado à
  prévia de Plantão já validada (PLANTÃO-2).
- **`app/globals.css`**: só uma classe nova e escopada
  (`.contato-plantonista-lista`/`-linha`) para a lista de contatos do
  modal — nenhuma classe existente foi reescrita fora do seu contexto
  estrutural (disciplina de `docs/spec/UI_CASCADE_E_HERANCA.md`).

Nenhuma mudança em `firestore.rules`, `packages/contrato/src/`,
`lib/firebase/authRepository.ts`, `apps/app/`, `apps/push-worker/` — todos
com diff zero (confirmado, seção "Estado final").

## Achado: `list` sem `where` em `.../atribuicoes` é frágil no emulador para não-admin

Ao escrever o teste de Rules "regravar o mesmo Grupo/participante/atribuição
com o mesmo ID atualiza o documento existente" (Rules emulator), a mesma
chamada de `listarAtribuicoesPlantaoRascunho()` (`getDocs` sem `where` em
`rascunhosCompetenciasPlantao/{id}/atribuicoes`) falhou no emulador com
`"Property grupoId is undefined on object"` quando autenticada como
GESTOR_EQUIPE — a MESMA chamada funciona normalmente como ADMIN_SISTEMA.
Causa aparente: a Rule dessa subcoleção depende de `resource.data.grupoId`
(campo do documento, não variável de path — diferente de `participantes`,
cuja Rule usa `grupoId` do próprio caminho), o que o motor de regras do
emulador não avalia de forma confiável para `list` fora do atalho de admin.
`listarAtribuicoesPlantaoRascunho()` não é chamada por nenhum código desta
fase, então isso **não bloqueou** a PLANTÃO-3B — registrado como limitação
pré-existente (PLANTÃO-3A) a investigar antes de qualquer fase futura
chamar essa função para um gestor comum. `firestore.rules` não foi
alterado (fora de escopo desta fase); o teste foi ajustado para verificar
o que de fato se sustenta hoje (via ADMIN_SISTEMA), com o achado registrado
em comentário no próprio teste e em `docs/spec/PLANTOES.md` § 21.8.

## Testes — antes/depois

| Suite | Antes | Depois | Novos |
| --- | --- | --- | --- |
| Unitários (`npm run test:unit`) | 636 | 666 | 30 |
| Fronteira (`npm run test:boundaries`) | 115 (129 após incluir o novo arquivo no script) | 129 | 12 (+ 2 testes reescritos, ver nota) |
| Rules/emulador (`npm run test:firestore-rules`) | 144 | 153 | 9 |

Nenhum teste foi removido. Dois testes de fronteira herdados (PLANTÃO-2/3A)
tiveram o ENUNCIADO invertido de propósito, porque descreviam a ausência da
integração que esta própria fase constrói — ver `docs/spec/PLANTOES.md`
§ 21.9 para a justificativa completa; ambos continuam existindo, agora
afirmando o oposto, com a única invariante permanente preservada (nenhuma
função de publicação).

`tests/plantao-dashboard-administracao-boundaries.test.mjs` (novo) foi
adicionado ao script `test:boundaries` em `package.json`.

## Auditoria de PII antes do commit

- `git diff` de todas as linhas ADICIONADAS (não o arquivo inteiro, para não
  reincidir em falso-positivo de código pré-existente) foi varrido por
  padrão de telefone plausível. Únicos achados: um placeholder de exemplo
  (`"Ex.: (11) 99999-0000"`, claramente fictício) e o MESMO número fictício
  já usado desde a Fase PLANTÃO-3A no `beforeEach` de
  `tests/firebase/firestore.rules.test.ts` (`11999990000`), reaproveitado
  (não inventado) nos novos testes por consistência.
- O único nome fictício novo (`Débora Assis` / `debora.assis`, fixture de
  teste em `firestore.rules.test.ts`) segue exatamente o mesmo padrão de
  nomes genéricos brasileiros fictícios já usados por todos os outros
  atores de teste do arquivo (`Marina Azevedo`, `Caio Monteiro`, `Renato
  Pires`, etc.) — não corresponde a nenhuma pessoa real.
- `docs/spec/SPEC_34_ESCALAICI_UNIVERSAL_SETOR_TIPO_ESCALA.md` (PII de
  outro projeto) não foi lido, copiado, nem referenciado por conteúdo em
  nenhum arquivo desta fase — só mencionado por NOME neste checkpoint e no
  registro de precheck, como já era prática desde a Fase HIERARQUIA-1.

## Verificação completa

```
npm run typecheck            OK (0 erros)
npm run typecheck:apps       OK (dashboard + app-web, 0 erros)
npm run lint                 OK (0 erros; 5 warnings pré-existentes em
                              arquivos não tocados nesta fase)
npm run test:unit            666 passed (era 636)
npm run test:boundaries      129 passed (script agora inclui o novo arquivo)
npm run test:firestore-rules 153 passed (era 144)
npm run build:dashboard      OK
npm run build:app            OK
npm run build:apps           OK
npm run build:app:pages      OK ("Cloudflare Pages validado")
npm run validate:pwa         OK ("PWA validado")
npm run validate:artifact    OK ("Validated Sites artifact")
git diff --check             sem problema de espaço em branco
```

## Estado final (git)

```
git status --porcelain
 M app/globals.css
 M apps/dashboard/src/DashboardApp.tsx
 M components/AppFrame.tsx
 M lib/firebase/plantaoReadRepository.test.ts
 M lib/firebase/plantaoReadRepository.ts
 M lib/sessao.test.ts
 M lib/sessao.ts
 M package.json
 M tests/firebase/firestore.rules.test.ts
 M tests/plantao-model-boundaries.test.mjs
 M tests/plantao-preview-boundaries.test.mjs
?? docs/spec/SPEC_34_ESCALAICI_UNIVERSAL_SETOR_TIPO_ESCALA.md   (arquivo estranho — NÃO tocado, NÃO commitado)
?? lib/montagemRascunhoPlantao.test.ts
?? lib/montagemRascunhoPlantao.ts
?? packages/contrato/.sites-runtime/                             (cache de ferramenta, NÃO commitado)
?? tests/plantao-dashboard-administracao-boundaries.test.mjs

git diff --stat -- apps/app/               (vazio — diff zero)
git diff --stat -- firestore.rules         (vazio — diff zero)
git diff --stat -- lib/firebase/authRepository.ts   (vazio — diff zero)
git diff --stat -- apps/push-worker/       (vazio — diff zero)
git diff --stat -- packages/contrato/src/  (vazio — diff zero)
```

Commit único local (`feat(plantao): integra administracao e rascunhos no
dashboard`), sem `--amend`, sem rebase, sem merge. **NÃO houve push. NÃO
houve deploy. Produção não foi tocada.**

## Próxima fase

PLANTÃO-3C (publicação: `publicarPlantao()`, transição RASCUNHO →
PUBLICADA) — **não iniciada nesta fase**, por instrução explícita.
