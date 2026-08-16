# Checkpoint — Fase PLANTÃO-3A (modelo persistente + Firestore Rules + repositórios)

Data: 2026-08-16. Escopo: fundação persistente do domínio Plantão —
schema, validação pura, Firestore Rules e repositórios de leitura/escrita
isolados. **Sem nenhuma integração de UI (Dashboard/App diff zero) e sem
publicação (RASCUNHO → PUBLICADA bloqueado nas Rules).** Detalhe técnico
completo em `docs/spec/PLANTOES.md`, seção 20 — este documento resume o
que foi feito e registra baseline/testes/riscos.

## Baseline (precheck)

```
pwd                              /home/vergani/projetos/Escala-ICI
git branch --show-current        main
git status --short               (vazio, exceto .sites-runtime gitignored)
git fetch origin                 ok
git status --branch --short      ## main...origin/main [ahead 3]
git rev-parse HEAD                30cd9f9ec58ffc77f18dd0c3ce6acecae6b78169
git rev-parse origin/main         0c119e17f67ebf012d0b9fde398ac6199162190e
```

`ahead 3` confirmado como esperado (Fases PLANTÃO-0/1/2). Nenhum avanço
remoto inesperado. Working tree limpa no início.

## Auditoria do modelo Firestore existente (antes de desenhar o schema)

Lidos integralmente/nas partes pertinentes: `firestore.rules`,
`lib/modelos.ts`, `lib/sessao.ts`, `lib/adminGuards.ts`,
`lib/firebase/shared.ts`, `lib/firebase/readRepository.ts`,
`lib/firebase/writeRepository.ts`, `lib/firebase/batches.ts`,
`lib/firebase/auditoriaRepository.ts`, `firestore.indexes.json`,
`tests/firebase/firestore.rules.test.ts`, `docs/spec/PLANTOES.md`,
`docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`.

Achados que definiram o schema (detalhados em `PLANTOES.md` seção 20.1):

- Identidade: `loginDoAuth()` (e-mail → login), nunca UID.
- Autorização: `souGestor() && podeOperarNaEquipe(equipeId)` é o par que
  toda escrita 6x1 usa — `podeOperarNaEquipe()` sozinha só checa
  pertencimento à equipe, **não** perfil de gestor.
- IDs determinísticos: mesma técnica de `idDocumento()`
  (`packages/contrato/src/documentos.ts`).
- RASCUNHO/PUBLICADA: já são **coleções separadas** hoje
  (`rascunhosTurnosMes`/`turnosMes`), nunca um único campo `status`
  filtrando a mesma coleção.
- Sem `undefined`: `removerUndefined()` (`lib/firebase/sanitizar.ts`).
- Timestamps: sempre string ISO 8601, nunca `Timestamp` nativo do
  Firestore, em toda a base — Plantão segue a mesma convenção.

## Schema físico escolhido

```
gruposPlantao/{grupoId}
gruposPlantao/{grupoId}/participantes/{login}
rascunhosCompetenciasPlantao/{grupoId_competencia}
rascunhosCompetenciasPlantao/{id}/atribuicoes/{atribuicaoId}
competenciasPlantao/{grupoId_competencia}                    (escrita bloqueada nesta fase)
competenciasPlantao/{id}/atribuicoes/{atribuicaoId}          (escrita bloqueada nesta fase)
```

### Justificativa

- **Domínio paralelo de verdade**: nenhum campo de Plantão em
  `usuarios`/`turnosMes`; participação é relação N:N via subcoleção, nunca
  um `usuario.tipoEscala`.
- **RASCUNHO/PUBLICADA como coleções separadas**: mesma decisão já
  validada pelo próprio projeto para a escala 6x1 — nunca inventar um
  padrão novo quando um adequado já existe (auditoria acima).
- **`equipesConsulta` sempre concreto** (nunca fallback calculado em
  tempo de leitura, ao contrário de `equipesPermitidas`/`unidadesPermitidas`
  em `usuarios`): Plantão não tem legado a preservar, então
  `equipesConsultaEfetivas()` já resolve o array final ANTES da escrita —
  simplifica a Rule e a query `array-contains` de "grupos que posso
  consultar", sem precisar lidar com o campo ausente.
- **Atribuição como documento próprio** (não um mapa dentro da
  competência): prepara PLANTÃO-6 (override) para mirar uma atribuição
  específica por ID sem reescrever a competência inteira.
- **Publicação bloqueada com `if false`**, não com uma regra "provisória"
  permissiva: mais seguro, e o formato de leitura de `competenciasPlantao`
  já fica pronto para quando PLANTÃO-3C existir.

## Grupo de Plantão

```ts
interface GrupoPlantao {
  grupoId: string; nome: string; descricao?: string;
  equipeResponsavelId: string; equipesConsulta: string[]; timezone: string;
  ativo: boolean; schemaVersion: number;
  criadoPorLogin: string; criadoEm: string; atualizadoEm: string;
}
```

`equipeResponsavelId` imutável após criado. `equipesConsulta` sempre
inclui `equipeResponsavelId` (garantido por `equipesConsultaEfetivas()`
antes de qualquer escrita, revalidado na Rule).

## Participante

```ts
interface ParticipantePlantao {
  grupoId: string; login: string; ativo: boolean; ordem?: number;
  contatos: ContatoPlantonista[]; schemaVersion: number;
  criadoPorLogin: string; criadoEm: string; atualizadoEm: string;
}
```

ID do documento = login (determinístico). Rule de `create` exige
`exists(usuarios/{login})` — nunca inventa identidade.

## Contatos e validação de máximo 3

```ts
interface ContatoPlantonista { rotulo: string; numero: string; ativo: boolean; }
```

Validado em dois níveis independentes:

- Client (`validarContatosPlantonista()`, `packages/contrato`): máximo 3,
  rótulo/número não vazios, tamanho máximo, mensagem legível.
- Rules (`contatosPlantonistaValidos()`, `firestore.rules`): mesma
  validação, defesa real — cada um dos até 3 elementos é checado
  individualmente (`contatos[0]`/`[1]`/`[2]`, guardado por `size()`), já
  que a linguagem de Rules não itera listas de tamanho variável. Testado
  no emulador: 0/1/2/3 contatos permitidos, 4 negado, rótulo/número vazio
  negado, campo extra negado.

`rotulo` é texto livre validado, não um enum fechado (grupos diferentes
podem precisar de rótulos diferentes). `normalizarContatosPlantonista()`
remove espaços extras antes de gravar.

## Competência

```ts
interface CompetenciaPlantao {
  id: string; grupoId: string; competencia: string;
  periodoInicio: string; periodoFim: string;
  status: 'RASCUNHO' | 'PUBLICADA'; revisao: number;
  origem: 'IMPORTADO' | 'MANUAL' | 'GERADO';
  totaisInformadosOrigem: { totalPlantoesInformado: number; totalMinutosInformado: number } | null;
  totalBruto: { quantidade: number; minutos: number };
  schemaVersion: number; criadoPorLogin: string; criadoEm: string; atualizadoEm: string;
}
```

`revisao` fixo em 0 nesta fase (só ganha sentido em PLANTÃO-3C).

## Atribuição

```ts
interface AtribuicaoPlantaoPersistida {
  atribuicaoId: string; grupoId: string; competenciaId: string;
  plantonistaLogin: string; inicio: string; fim: string; duracaoMinutos: number;
  papel: 'PRIMARIO' | 'SECUNDARIO'; origem: 'IMPORTADO' | 'MANUAL' | 'GERADO';
  revisao: number; schemaVersion: number; criadoEm: string; atualizadoEm: string;
}
```

`inicio`/`fim` são instantes ISO 8601 UTC. `duracaoMinutos` é derivado e
**validado** contra `fim - início` — `validarAtribuicaoPlantaoPersistida()`
recusa qualquer atribuição cuja duração não bata com o intervalo real
(nunca uma inconsistência silenciosa tipo "início/fim = 12h, duração =
24h").

## Estratégia de timezone

`converterMomentoParaInstanteUtc(momento, timezone)` — `Intl.DateTimeFormat`
com `timeZone` explícito, determinístico e independente do timezone da
máquina. Duas passadas resolvem virada de horário de verão (quando
existir); não resolve o segundo exato de uma transição ambígua/inexistente
— aceitável, `America/Sao_Paulo` (grupos reais de hoje) não tem DST desde
2019. Testado: 19:00→22:00 UTC, 07:00→10:00 UTC, 00:00→03:00 UTC (mesmo
dia), 23:00→02:00 UTC do dia seguinte (muda a data), timezone inválida
rejeitada, determinismo confirmado.

## Estratégia de IDs

- `grupoId`: string escolhida por quem cria (mesmo padrão de
  `equipes.id`/`unidadesOrganizacionais.unidadeId`), validada por
  `idGrupoPlantaoValido()` (charset seguro, sem `/`).
- `competenciaId = idCompetenciaPlantao(grupoId, competencia)` —
  `${grupoId}_${competencia}`, mesma técnica de `idDocumento()`.
- `atribuicaoId = idAtribuicaoPlantao(indice)` — sequencial e
  determinístico (`0001`, `0002`, ...), não UUID aleatório; reimportar a
  mesma planilha na mesma ordem sobrescreve os mesmos IDs em vez de
  duplicar.
- Login compõe o ID do participante (subcoleção) — nunca nome/e-mail/UID.

## Queries futuras suportadas pelo schema (não implementadas nesta fase)

- **Quem está de plantão agora / próximo plantonista**: leem
  `competenciasPlantao/{id}/atribuicoes` (PUBLICADA) por `inicio`/`fim` —
  schema pronto, sem dado real ainda (escrita bloqueada).
- **Meus plantões**: `collectionGroup('participantes').where('login', '==', X)`
  — o campo `login` já existe em todo documento de participante; o índice
  de collection group necessário fica para PLANTÃO-4 (não criado agora,
  nenhum repositório desta fase o executa).
- **Plantões de uma competência**: `rascunhosCompetenciasPlantao/{id}/atribuicoes`
  (ou o equivalente PUBLICADA) — implementado
  (`listarAtribuicoesPlantaoRascunho`).
- **Grupos que posso consultar**: `gruposPlantao` com
  `where('equipesConsulta', 'array-contains', equipeId)` — implementado
  (`listarGruposPlantaoPermitidos`), só possível sem fallback porque o
  campo é sempre concreto (ver "Grupo de Plantão" acima).

## Regras por ator (resumo — tabela completa em `PLANTOES.md` seção 20.9)

| Ator | Lê | Administra |
| --- | --- | --- |
| Não autenticado | não | não |
| Analista autorizado a consultar | sim | não |
| Analista não autorizado | não | não |
| Participante do grupo (analista comum) | sim (se a equipe está em `equipesConsulta`) | **não** |
| Gestor autorizado (equipe responsável) | sim | sim |
| Gestor fora do escopo (só consulta) | sim | não |
| ADMIN_SISTEMA | sim | sim |

## Tratamento de contatos

Ver seção "Contatos e validação de máximo 3" acima — dado autenticado,
nunca público; leitura gated por `podeConsultarGrupoPlantao()`
(equivalente à leitura do participante, já que os contatos são um campo
dentro dele, não uma subcoleção própria).

## RASCUNHO/PUBLICADA

Coleções separadas (ver "Schema físico" acima). **Publicação continua
bloqueada/não implementada**: `competenciasPlantao`/`.../atribuicoes` têm
`allow create, update, delete: if false` incondicional — nenhum client,
nem `ADMIN_SISTEMA`, escreve ali nesta fase (testado explicitamente no
emulador). A leitura já está pronta (`podeConsultarGrupoPlantao()`) para
quando PLANTÃO-3C existir.

## Repositórios criados

- `lib/firebase/plantaoReadRepository.ts`: `obterGrupoPlantao`,
  `listarGruposPlantaoPermitidos`, `listarParticipantesPlantao`,
  `obterCompetenciaPlantaoRascunho`, `listarAtribuicoesPlantaoRascunho`.
- `lib/firebase/plantaoWriteRepository.ts`: `salvarGrupoPlantao`,
  `salvarParticipantePlantao`, `desativarParticipantePlantao` (nunca
  exclui — `ativo: false`), `salvarCompetenciaPlantaoRascunho` (recusa
  qualquer status ≠ `RASCUNHO`), `salvarAtribuicoesPlantaoRascunho` (em
  lotes de até 499). **Nenhuma função `publicarPlantao()` existe.**

**Confirmado: o Dashboard (PLANTÃO-2) não chama nenhuma dessas funções
nesta fase** — testado explicitamente
(`tests/plantao-model-boundaries.test.mjs`, item 2); `diff --stat` de
`apps/dashboard/src/DashboardApp.tsx` e `apps/app/src/EmployeeApp.tsx`
confirma zero alteração nesta fase.

## Testes

67 testes novos:

- `packages/contrato/test/modeloPlantaoPersistente.test.ts` — **43
  testes** (os 24 itens pedidos + testes extras de `equipesConsultaEfetivas`,
  IDs determinísticos e timezone).
- `lib/firebase/plantaoReadRepository.test.ts` — **6 testes** (mocks de
  `firebase/firestore`, mesmo padrão de `readRepository.test.ts`).
- `lib/firebase/plantaoWriteRepository.test.ts` — **14 testes**, incluindo
  a prova de que nenhum campo `undefined` chega ao mock de `setDoc`.
- `tests/firebase/firestore.rules.test.ts` — **22 testes novos no
  emulador real** (144 no total, era 122), cobrindo todas as linhas da
  tabela de autorização + payload inválido (4 contatos, rótulo/número
  vazio, campo extra, login vazio, login divergente do ID, status
  inválido, origem inválida) + competência publicada (leitura permitida,
  escrita sempre bloqueada).
- `tests/plantao-model-boundaries.test.mjs` — **8 testes** de fronteira
  (itens 1–10 da seção 38, dois pares combinados).

Um teste de fronteira PRÉ-EXISTENTE (`tests/plantao-preview-boundaries.test.mjs`,
da Fase PLANTÃO-2) afirmava que `firestore.rules` nunca mencionaria
Plantão — premissa que esta fase invalida de propósito (é literalmente o
objetivo dela). Atualizado para continuar verificando a parte que
permanece verdadeira (`writeRepository.ts`, o repositório 6x1
compartilhado, segue sem nenhuma menção a Plantão — a escrita vive isolada
em `plantaoWriteRepository.ts`), em vez de removido.

Resultados finais:

```
npm run typecheck           OK
npm run typecheck:apps      OK (dashboard + app-web)
npm run typecheck:worker    OK
npm run test:unit           636/636 passou (48 arquivos) — era 573, +63 novos
npm run test:boundaries     115/115 passou (era 107, +8 novos)
npm run test:firestore-rules 144/144 passou no emulador (era 122, +22 novos)
npm run lint                0 erros, 5 warnings pré-existentes
                             (mesmos 2 arquivos de teste não tocados nesta
                             fase: lib/firebase/authRepository.test.ts,
                             lib/firebase/lembretesRepository.test.ts)
npm run build:app:pages     OK
npm run build:apps          OK (dashboard + app-web)
npm run validate:pwa        OK
npm run validate:artifact   OK
git diff --check            limpo
```

`packages/contrato` tem seu próprio `tsconfig.json` local mais estrito;
confirmado que os únicos 3 erros ali (`jornada.ts:260`,
`detectorPlanilha.test.ts:32`, `parserPlantao.test.ts:36`) são
**pré-existentes** (reproduzidos isolando as alterações desta fase via
`git stash`) e fora do escopo — nenhum deles em arquivo tocado aqui.

## Emulator

Todos os testes de Rules rodaram no **Firestore Emulator**
(`npm run test:firestore-rules`, `firebase emulators:exec --only firestore`,
projeto `demo-escala-ici-fase3i`). Nenhum staging real, nenhuma credencial
nova, nenhum acesso a Firebase de produção.

## Índices Firestore

**Nenhum índice novo foi adicionado a `firestore.indexes.json`.** Toda
consulta preparada é de campo único (`array-contains` em
`equipesConsulta`, ou listagem de subcoleção sem `where` composto) —
Firestore cria automaticamente o índice de campo único necessário. A
futura consulta "meus grupos" (collection group) fica documentada como
pendente para PLANTÃO-4, quando de fato for implementada.

## Achado real durante a implementação (bug de autorização, corrigido)

`podeGerenciarGrupoPlantao(grupoDoc)` foi escrita inicialmente só como
`podeOperarNaEquipe(grupoDoc.equipeResponsavelId)` — sem `souGestor()`.
Isso deixava **qualquer analista comum da equipe responsável** editar o
Grupo, criar/editar participantes e criar rascunhos, porque
`podeOperarNaEquipe()` sozinha só verifica pertencimento à equipe, não
perfil (confirmado auditando as regras 6x1, que sempre combinam
`souGestor() && podeOperarNaEquipe(...)`). Pego pelo teste "participante
do grupo não administra nada" rodando no emulador real — corrigido
(`souGestor() && podeOperarNaEquipe(...)`) antes do commit, com o teste
correspondente passando depois da correção. Registrado aqui porque é
exatamente o tipo de erro que só um teste de Rules real (não uma leitura
estática do arquivo) pega de forma confiável.

## Confirmações de escopo

- Nenhuma UI foi integrada — `apps/dashboard/src/DashboardApp.tsx` e
  `apps/app/src/EmployeeApp.tsx` com diff zero nesta fase.
- Nenhuma publicação de Plantão existe ou é possível — `competenciasPlantao`
  bloqueada com `if false` incondicional, testado.
- `apps/push-worker/` com diff zero.
- Nenhum módulo de autenticação foi tocado (testado em boundaries).
- `packages/contrato/src/parser.ts` (parser 6x1) e `lib/firebase/writeRepository.ts`
  (escrita 6x1 compartilhada) com diff zero.
- Zero PII real: busca automatizada pelos 4 nomes reais confirma zero
  ocorrências novas (o único match é a menção já existente, de PLANTÃO-2,
  documentando a própria busca).
- Nenhum `.env` alterado, nenhum deploy, nenhum acesso a Firebase real.

## Riscos conhecidos

- `equipeResponsavelId` imutável nesta fase — reatribuir um Grupo a outra
  equipe exigirá uma decisão de produto futura (hoje, criar um novo Grupo
  é o caminho).
- Índice de collection group para "meus grupos" ainda não existe —
  necessário antes de implementar essa consulta em PLANTÃO-4.
- `revisao` fixo em 0 em competência/atribuição — só ganha semântica real
  em PLANTÃO-3C; nenhuma lógica de incremento foi implementada (não fazia
  sentido sem publicação).
- Auditoria administrativa (`auditoriaAdmin`) ainda não está conectada às
  escritas de Plantão — só faz sentido quando a UI (PLANTÃO-3B) realmente
  chamar os repositórios.

## Próxima fase prevista

PLANTÃO-3B — Dashboard passa a chamar `plantaoReadRepository`/
`plantaoWriteRepository` de verdade (formulário de Grupo, tela de
participantes/contatos, botão para transformar o preview validado da
PLANTÃO-2 num rascunho persistido). PLANTÃO-3C (depois) implementa a
publicação (RASCUNHO → PUBLICADA) propriamente dita.

## Git

Commit local criado (mensagem `feat(plantao): adiciona modelo persistente
e regras de acesso`). **Nenhum push. Nenhum deploy. Firebase staging não
foi alterado. Firebase produção não foi alterado. Dashboard ainda não
persiste Plantão. App não foi alterado. Produção não foi tocada.**
