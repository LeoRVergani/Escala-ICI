# Checkpoint — Fase ESCALAS-UX-2A.1-FIX (dirty real + contextos de Plantão seguros)

Data: 2026-08-17. Microfase de CORREÇÃO da ESCALAS-UX-2A.1 — não avança o
redesign (roster, drag-and-drop, padrão de horário, importação inline,
publicação e novo workspace continuam fora de escopo). Corrige três
desvios identificados no relatório final da ESCALAS-UX-2A.1
(`CHECKPOINT-FASE-ESCALAS-UX-2A1-CONTEXTO-ATIVO.md`).

## Baseline (precheck)

```
pwd                            /root/projetos/Escala-ICI-main
git rev-parse --show-toplevel  /root/projetos/Escala-ICI-main
git branch --show-current      main
git status --short             (limpo)
git rev-parse HEAD             bdfdc4c3eedd22e60c2be202706fd023d88b93eb
git rev-parse origin/main      bdfdc4c3eedd22e60c2be202706fd023d88b93eb
```

HEAD == origin/main no precheck — nenhum divergência. Baseline de testes
confirmado: `test:unit` 862/862, `test:boundaries` 219/219,
`test:firestore-rules` 155/155.

## 1. Problema 1 — dirty de Plantão incorreto

`existeAlteracaoNaoSalvaNoContextoAtivo()` reaproveitava
`plantaoEditadoDesdeImportacao` como guard de troca de contexto. Esse
estado sempre significou "a working copy do Editor divergiu do conteúdo
importado" — **não** "existe algo não salvo". Consequência real: uma
escala de Plantão criada vazia (`criarPlantaoEmBrancoAcao`) ou copiada do
período anterior (`usarPeriodoAnteriorAcao`) nasce com
`plantaoEditadoDesdeImportacao = false` (nunca houve importação para
divergir) mesmo sendo 100% não persistida — trocar de contexto nesse
estado perdia a escala inteira sem aviso.

### Correção

Novo estado explícito e próprio:

```ts
const [plantaoPossuiAlteracoesNaoSalvas, setPlantaoPossuiAlteracoesNaoSalvas] = useState(false);
```

`plantaoEditadoDesdeImportacao` **não foi removido** — continua com seu
significado original (indicador visual "divergiu da importação",
`editadoDesdeImportacao` do `PlantaoCalendario`) — só deixou de ser lido
pelo guard.

### Semântica implementada

| Ponto | Ação | `plantaoPossuiAlteracoesNaoSalvas` |
| --- | --- | --- |
| `interpretarPlantao()` (importar XLS) | nasce working copy | `true` |
| `criarPlantaoEmBrancoAcao()` (criar vazia) | nasce working copy | `true` |
| `usarPeriodoAnteriorAcao()` (usar período anterior) | nasce working copy | `true` |
| `abrirRascunhoNoEditorAcao()` (reabrir rascunho persistido) | working copy já salva | `false` |
| `marcarPlantaoEditadoNoEditor()` (editar/adicionar/excluir atribuição) | mutação local | `true` |
| `confirmarVinculoPlantaoAcao()`/`desfazerVinculoPlantaoAcao()` (vínculo afeta payload) | mutação local | `true` |
| `salvarRascunhoPlantaoAcao()` — sucesso | persistido | `false` |
| `salvarRascunhoPlantaoAcao()` — erro (`catch`) | nada mudou | permanece `true` |

`existeAlteracaoNaoSalvaNoContextoAtivo()` passou a ler
`plantaoPossuiAlteracoesNaoSalvas` para `contextoEscalaAtivo.tipo === 'PLANTAO'`
— nunca mais `plantaoEditadoDesdeImportacao`.

### Proteção contra regressão

Boundary test 5 (`tests/dashboard-contexto-escala-boundaries.test.mjs`)
passou a afirmar `doesNotMatch` de `plantaoEditadoDesdeImportacao` dentro
do corpo de `existeAlteracaoNaoSalvaNoContextoAtivo()`; teste 26 reforça a
mesma proteção em `solicitarTrocaContexto`/`solicitarTrocaCompetencia`.
Testes 21-24 cobrem cada linha da tabela acima, incluindo o caso do
`catch` de erro (teste 23).

## 2. Problema 2 — dirty de Jornada incompleto

Auditoria completa de todos os `setResultado()` do arquivo (16 pontos):

| Ponto (função) | Categoria | Ação em `jornadaPossuiAlteracoesNaoSalvas` |
| --- | --- | --- |
| Efeito de carga demo (`usuarioEfetivo`/modo demo) | LOAD_REMOTO | `false` |
| `carregarDemo()` | LOAD_REMOTO | `false` |
| `carregarDadosDaEquipe()` | LOAD_REMOTO | `false` |
| `aplicarConciliacao()` (usada por `interpretar()`, `corrigirErro()`, `selecionarVinculoConciliacao()`, `marcarConciliacaoPendente()`, `ignorarConciliacao()`) | IMPORT_NAO_SALVO | **`true`** (era `false` — bug) |
| `receberArquivo()` — tipo `DESCONHECIDA` (`resultado = null`) | RESET | `false` |
| `receberArquivo()` — tipo `PLANTAO` (`resultado = null`) | RESET | `false` |
| `cadastrarFaltantes()` (reparse pós-cadastro, mesmo arquivo importado) | IMPORT_NAO_SALVO | **`true`** (era `false` — bug) |
| `salvar()` — sucesso | SAVE_RESULT | `false` |
| `publicar()` — sucesso | SAVE_RESULT | `false` |
| Restaurar revisão (rollback) | LOAD_REMOTO | `false` |
| `editarCelula()` (único ponto de mutação direta de conteúdo) | MUTACAO_LOCAL | `true` |
| `adicionarMembroGrade` / `confirmarRemocaoMembroGrade` | já persistido imediatamente no Firestore antes do `setResultado` — não é perdido ao trocar de contexto | não toca o dirty state (mantém o valor vigente) |
| `descartarRascunho()` | RESET | `false` |
| `aplicarTrocaContexto()` (Jornada) | LOAD_REMOTO | `false` |
| `encerrarSessao()` | RESET | `false` |

`jornadaEditadaDesdeCarregamento` foi **renomeado** para
`jornadaPossuiAlteracoesNaoSalvas` (mesmo papel de guard que já tinha
desde a ESCALAS-UX-2A.1, só que agora com cobertura completa) — nenhuma
API pública nova, um único identificador em todo o arquivo.

### Bug real corrigido

`aplicarConciliacao()` e `cadastrarFaltantes()` zeravam o dirty state
mesmo continuando dentro de um fluxo de importação NÃO salva (reprocessar
a mesma planilha depois de resolver conciliação de nomes, ou depois de
cadastrar usuários faltantes). Consequência: importar uma planilha,
resolver uma pendência de conciliação, e trocar de contexto não disparava
o `UnsavedChangesDialog` — a importação inteira era perdida em silêncio.

### Proteção contra regressão

Teste 7 (reescrito) afirma exatamente 3 ocorrências de
`setJornadaPossuiAlteracoesNaoSalvas(true)` no arquivo
(`editarCelula`, `aplicarConciliacao`, `cadastrarFaltantes`) e verifica
que cada uma está dentro da função certa.

## 3. Problema 3 — grupos consulta-only no switcher editável

`opcoesContextoPlantao` mapeava `gruposPlantaoAdmin` inteiro (grupos
administrados **e** grupos só-consultados via `equipesConsulta`) como
contexto igualmente selecionável. Nesta etapa isso é inadequado: o Editor
atual só sabe abrir/gravar um **rascunho administrativo**
(`abrirRascunhoNoEditorAcao`/`salvarRascunhoPlantaoAcao`), e Plantão
publicado ainda não tem nenhum read model operacional (`PLANTÃO-3C` não
existe) — selecionar um grupo só-consultado abriria um Editor sem nada
para mostrar ou salvar.

### Correção

```ts
const opcoesContextoPlantao: OpcaoContextoEscala[] = gruposPlantaoAdmin
  .filter(podeGerenciarEsteGrupoPlantao)
  .map((grupo) => ({ /* ... */ }));
```

`podeGerenciarEsteGrupoPlantao()` já existia (autorização real via
`podeGerenciarGrupoPlantao(usuarioReal, grupo.equipeResponsavelId)`,
mesma função usada por "criar rascunho"/"salvar rascunho"/"criar vazia"/
"usar período anterior") — nenhuma sigla hardcoded, nenhuma função nova.

### Sem mudança de ACL

Nenhuma alteração em `equipesConsulta`, `firestore.rules`,
`GrupoPlantao` ou qualquer caminho de autorização. Grupos consulta-only
continuam existindo e continuam consultáveis pelo domínio já existente
(ex.: `PlantaoAdmin` continua listando/mostrando os grupos que o usuário
só consulta) — só deixam de aparecer como contexto **editável** no
switcher do header.

### Futuro (não implementado agora)

Após `PLANTÃO-3C`, o seletor pode evoluir para distinguir
Editáveis/Consulta explicitamente, ou permitir abrir uma escala publicada
em modo leitura.

### Proteção contra regressão

Teste 25 confirma o `.filter(podeGerenciarEsteGrupoPlantao)` e a ausência
de qualquer sigla hardcoded (`SOC`/`NOC`/`COSI`/`CODB`) no trecho.

## 4. Testes novos/alterados

`tests/dashboard-contexto-escala-boundaries.test.mjs`:

- Teste 5 — reescrito: guard usa os dois dirty states explícitos, nunca
  `plantaoEditadoDesdeImportacao`.
- Teste 7 — reescrito: 3 pontos de `setJornadaPossuiAlteracoesNaoSalvas(true)`
  (antes exigia exatamente 1).
- Testes 21-24 (novos) — Problema 1: estado explícito existe,
  import/criar-vazia/usar-anterior marcam `true`, reabrir/salvar-sucesso
  zeram, erro de salvar mantém `true`, mutações (edição/vínculo) marcam
  `true`.
- Teste 25 (novo) — Problema 3: filtro `podeGerenciarEsteGrupoPlantao`,
  zero hardcode de sigla.
- Teste 26 (novo) — proteção ampla: `solicitarTrocaContexto`/
  `solicitarTrocaCompetencia` nunca referenciam
  `plantaoEditadoDesdeImportacao`.

Total: `test:boundaries` 225/225 (baseline 219 + 6 novos; teste 7
reescrito sem aumentar a contagem). `test:unit` 862/862 (inalterado — a
correção é inteiramente em `DashboardApp.tsx`, sem novo módulo `lib/`
puro). `test:firestore-rules` 155/155 (inalterado).

## 5. Confirmação de diff zero nos caminhos protegidos

`git diff --stat` sobre `firestore.rules`, `firestore.indexes.json`,
`lib/editorPlantao.ts`, `lib/montagemRascunhoPlantao.ts`,
`components/plantao/`, `packages/contrato/src/modeloPlantaoPersistente.ts`,
`lib/firebase/authRepository.ts`, `apps/app/`, `apps/push-worker/`,
`components/organizacao/`, `components/ScheduleGrid.tsx`,
`lib/contextoEscala.ts` — **vazio**. Únicos arquivos alterados:
`apps/dashboard/src/DashboardApp.tsx` e
`tests/dashboard-contexto-escala-boundaries.test.mjs`, mais os três
arquivos de documentação (`CHECKPOINT-FASE-ESCALAS-UX-2A1-CONTEXTO-ATIVO.md`,
`docs/spec/EDITOR_ESCALAS.md`, `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`)
e este checkpoint.

## 6. Validação completa

`typecheck` (raiz), `typecheck:apps` (dashboard + app-web),
`typecheck:worker`, `lint` (0 erros — só os 6 warnings pré-existentes já
conhecidos, inalterados), `test:unit` 862/862, `test:boundaries` 225/225,
`test:firestore-rules` 155/155, `build:dashboard`, `build:app:pages`,
`build:apps`, `validate:pwa`, `validate:artifact`, `git diff --check` —
todos OK.

## 7. Git

Commit local único, mensagem
`fix(ux): protege troca de escala com alteracoes nao salvas`. Nenhum
push, deploy, merge, rebase, amend, reset ou stash.

## 8. Confirmação

NÃO HOUVE DEPLOY. FIREBASE NÃO FOI ALTERADO. PRODUÇÃO NÃO FOI TOCADA.

Esta fase **para aqui** — não inicia `PLANTAO-PADRAO-1`, `ESCALAS-UX-2B`
nem `PLANTÃO-3C`.
