# Checkpoint — Fase PLANTÃO-3B.1 (conferência contábil da fonte + fidelidade da importação)

Data: 2026-08-16. Escopo: corrigir e formalizar a conferência dos dados
contábeis de planilhas de Plantão — três camadas de verdade (bruto,
contabilidade por plantonista somada, total declarado na fonte), nunca
reconciliadas entre si. Corrige um bug real de causa raiz (totais
informados chegando `—` no Dashboard). **Nenhuma publicação, nenhuma
mudança de Firestore/Rules/schema persistente/árvore organizacional.**

## Baseline (precheck)

```
pwd                          /home/vergani/projetos/Escala-ICI
git branch --show-current    main
git rev-parse HEAD            9f8877dc23c16151941e1ea1345f55759bdb5662
git fetch origin               ok
git rev-parse origin/main      0c119e17f67ebf012d0b9fde398ac6199162190e
git status --branch --short    ## main...origin/main [ahead 8]
```

`packages/contrato/.sites-runtime/` (cache de ferramenta, npm-cache com
logs de debug — confirmado via inspeção, já coberto pelo padrão
`/.sites-runtime/` do `.gitignore`, só que aninhado) foi removido do
working tree antes do precheck, conforme instruído — `git status --short`
ficou limpo. Baseline de testes confirmado antes de qualquer mudança:
unit 697/697, boundaries 142/142, Rules 153/153, typechecks OK, lint 0
erros.

## Leitura prévia

`docs/spec/PLANTOES.md`, `HIERARQUIA_ORGANIZACIONAL.md`,
`UI_CASCADE_E_HERANCA.md`; checkpoints PLANTÃO-1/2/3B/UI-ORG-1A;
`packages/contrato/src/{parserPlantao,tiposPlantao,celulas,detectorPlanilha}.ts`,
`packages/contrato/test/{parserPlantao.test.ts,dadosPlantao.ts}`,
`lib/importadorPlanilha.ts`, `lib/conciliacaoPlantoes.ts`, o bloco
`PreviewPlantao` de `apps/dashboard/src/DashboardApp.tsx`.

## Causa raiz exata dos "—"

`extrairContabilidadeInformada()` (`parserPlantao.ts`) identificava a
linha de total da seção "Contabilidade dos Plantões no mês" por
**igualdade exata**: `normalizarChaveEstrutural(nome) === 'TOTAL'`.

A fixture sanitizada (`Plantao-COSI-SANITIZADO.xls`) usa literalmente
"Total" nessa célula — por isso os 29 testes pré-existentes do parser
SEMPRE passaram e nunca expuseram o problema. Qualquer rótulo real
diferente — "Total Geral", "Total:", "TOTAL DO MÊS" — falha na igualdade
exata; a linha então é tratada como mais um PLANTONISTA (poluindo
`contabilidadeInformada` com uma entrada falsa "Total Geral"/etc.), e
`totaisInformados` nunca é preenchido (fica `null` para sempre).

**Reproduzido empiricamente** antes de qualquer correção: uma planilha
sintética com uma linha de total rotulada "Total Geral" resultava em
`totaisInformados: null` e uma entrada falsa `{"plantonistaNomeOriginal":
"Total Geral", ...}` em `contabilidadeInformada` — exatamente o padrão do
bug relatado (Dashboard real mostrando "—" mesmo com contabilidade
presente na planilha).

Descartadas por auditoria: importador (`lib/importadorPlanilha.ts`) e
Dashboard (`DashboardApp.tsx`) já liam corretamente `resultado.totaisInformados`
— o dado nunca chegava a existir para ser perdido a jusante. Corrigido no
nível responsável: o **parser**, não um workaround na UI.

**Correção**: `ehLinhaTotalPlantao(nome)` — `normalizarChaveEstrutural(nome).startsWith('TOTAL')`
em vez de `===`. Mesmo princípio de detecção estrutural (por prefixo, não
por texto absoluto frágil) já usado para `MARCADOR_CONTABILIDADE`
("Contabilidade..."). Testado com "Total Geral", "Total:", "TOTAL DO MÊS"
e "Total" (compatibilidade com a fixture existente).

## Contrato — antes e depois

**Antes** (`tiposPlantao.ts`): só duas camadas nomeadas —
`TotalBrutoPlantao` (bruto) e `TotaisInformadosPlantao` (total declarado).
Não existia nenhum tipo/função para a soma das linhas INDIVIDUAIS de
`ContabilidadePlantaoInformada[]` — ninguém calculava isso, então a
comparação "bruto vs. contabilidade individual" (32 vs. 31, 504h vs. 480h)
não existia em lugar nenhum do sistema.

**Depois**: três tipos novos em `tiposPlantao.ts`
(`SomaContabilidadeInformada`, `ChaveDivergenciaPlantao`,
`DivergenciaPlantao`, `ConferenciaContabilPlantao`) e duas funções puras
novas em `parserPlantao.ts` (`somarContabilidadeInformada()`,
`conferirContabilidadePlantao()`). `TotalBrutoPlantao`/
`TotaisInformadosPlantao`/`ResultadoParsePlantao` inalterados — a mudança
é só aditiva.

## Confirmação dos números da fixture real

```
Intervalos brutos:                 32
Duração bruta:                     504h
Contabilidade por plantonista, somada:  31 plantões / 480h
Total declarado na planilha:            31 plantões / 468h
```

Confirmado por 10 testes novos em `parserPlantao.test.ts` usando a
fixture real (`resultadoFixture()`), incluindo as 4 divergências
formalizadas na tabela de `docs/spec/PLANTOES.md` § 23.

## Divergências detectadas (fixture real)

| Divergência | Comparação | Resultado |
| --- | --- | --- |
| `INTERVALOS_VS_CONTABILIDADE_QUANTIDADE` | 32 vs. 31 | divergente |
| `INTERVALOS_VS_CONTABILIDADE_MINUTOS` | 504h vs. 480h | divergente |
| `CONTABILIDADE_VS_DECLARADO_QUANTIDADE` | 31 vs. 31 | **sem divergência** |
| `CONTABILIDADE_VS_DECLARADO_MINUTOS` | 480h vs. 468h | divergente |

Nenhuma métrica foi marcada como "correta" em nenhum arquivo (testado
por boundary e por asserção direta sobre o JSON de `conferirContabilidadePlantao()`).
Nenhuma reconciliação automática ocorreu — `504→480`, `480→468`, `504→468`
nunca são aplicados; nenhuma linha é descartada; nenhuma duração é
alterada (confirmado pelos mesmos testes que já protegiam isso desde a
PLANTÃO-1, mais um boundary novo verificando que o parser nunca atribui
um totalizador a outro).

## Tratamento de zero, ausência e o participante 0/0

- **Zero é um valor real**: o participante "Daniela Rocha" (0 plantões,
  0h) continua preservado em `contabilidadeInformada` e participa
  normalmente de `somarContabilidadeInformada()` (soma sem alterar o
  resultado — testado).
- **Ausência nunca vira zero**: quando não há linha de total,
  `conferencia.declarado` é `null` e a UI mostra "Não informado na
  fonte" (nunca `0`, nunca `—` ambíguo). Quando não há seção de
  contabilidade informada, `conferencia.somaContabilidadeInformada`
  ainda existe (soma de lista vazia = `{quantidade: 0, minutos: 0}`,
  matematicamente correto), mas a UI mostra "Não informada na fonte" em
  vez do zero — porque a AUSÊNCIA da seção inteira, não a soma em si, é o
  que importa comunicar; e nenhuma divergência bruto-vs-individual é
  gerada nesse caso (testado — evita comparar contra zero por ausência).

## Comportamento do Dashboard

- **Aba Contabilidade**: continua mostrando as linhas individuais; rodapé
  agora tem DUAS linhas separadas — "Soma das linhas" (nova, calculada) e
  "Total declarado na planilha" (já existente, agora com fallback "Não
  informado na fonte" em vez de simplesmente desaparecer quando ausente).
- **Resumo superior**: os 4 cards ambíguos ("Plantões informados no
  relatório"/"Horas informadas no relatório", que na really liam só o
  total DECLARADO) viraram 4 cards com nomenclatura não ambígua:
  "Intervalos encontrados", "Duração literal dos intervalos",
  "Contabilidade por plantonista" (nova — soma calculada), "Total
  declarado na planilha" (já existente, renomeado para clareza).
- **Avisos**: painel "Divergências encontradas na fonte" (substituiu
  "Divergência de conferência", que só cobria bruto-vs-declarado, nunca
  a camada individual) lista uma linha por comparação divergente, com o
  aviso final "Nenhum valor foi corrigido automaticamente". Quando todas
  as comparáveis coincidem, mostra "Conferência consistente" — nunca
  esconde os números.
- **43h/5h preservados**: intactos — nenhum teste ou código que os
  envolvia foi alterado; confirmado pelos mesmos testes #6/#7 já
  existentes desde a PLANTÃO-1, que continuam passando sem modificação.
- **"Validar prévia" continua não bloqueada** por divergência contábil —
  só por vínculo pendente (`previaPlantaoValidavel()`, função inalterada
  nesta fase). Documentado em `docs/spec/PLANTOES.md` § 23.2 que um
  eventual bloqueio antes de publicação é decisão da PLANTÃO-3C.

## Testes

- `packages/contrato/test/parserPlantao.test.ts`: **19 testes novos**
  (48 no total, era 29) — `somarContabilidadeInformada` (3),
  `conferirContabilidadePlantao` (10, incluindo as 4 divergências da
  fixture real, ausência de contabilidade, ausência de total declarado, e
  a auditoria "nenhum campo é rotulado como correto"), e a reprodução do
  bug de causa raiz com 5 variantes de rótulo de linha de total (5).
- `tests/plantao-conferencia-contabil-boundaries.test.mjs` (novo): **11
  testes** — Dashboard usa a conferência; nenhuma métrica "correta";
  nenhuma reconciliação automática; ausência nunca vira zero; nenhuma
  publicação; nenhum campo novo no schema persistente; Rules sem menção
  aos novos conceitos; árvore organizacional sem código de contabilidade;
  parser 6x1 intocado; funções puras (sem Firebase/React); "Validar
  prévia" não bloqueada por divergência.
- Nenhum teste anterior foi removido ou enfraquecido.

## Verificação completa

```
npm run typecheck            OK
npm run typecheck:apps       OK
npm run typecheck:worker     OK
npm run lint                 OK (0 erros; 5 warnings pré-existentes,
                              arquivos não tocados nesta fase)
npm run test:unit            716 passed (era 697)
npm run test:boundaries      153 passed (era 142)
npm run test:firestore-rules 153 passed (inalterado — Rules não tocadas)
npm run build:dashboard      OK
npm run build:app:pages      OK
npm run build:apps           OK (bundle JS de apps/app inalterado: 993.11 kB)
npm run validate:pwa         OK
npm run validate:artifact    OK
git diff --check             sem problema de espaço em branco
```

## Validação visual

**Nenhum navegador disponível neste ambiente — auditoria estática
apenas**, declarado explicitamente (nunca apresentada como validação
visual real). A confirmação dos números (32/504h, 31/480h, 31/468h) foi
feita via os testes automatizados sobre a fixture real, não por inspeção
visual do Dashboard renderizado.

## Auditoria de PII

`git diff` de todas as linhas adicionadas varrido por padrão de telefone
plausível e nomes reais: nenhum encontrado — só datas de fixture
(25/07/2026 etc.) e o nome fictício já estabelecido "Ana Costa" (Fase
PLANTÃO-1), reaproveitado, não novo. A planilha real nunca foi lida,
copiada nem versionada nesta fase — só a fixture sanitizada e planilhas
sintéticas construídas em memória para os testes de reprodução do bug.

## Estado final (git)

```
git diff --stat -- apps/app/                                              (vazio — diff zero)
git diff --stat -- firestore.rules firestore.indexes.json                 (vazio — diff zero)
git diff --stat -- lib/firebase/authRepository.ts                         (vazio — diff zero)
git diff --stat -- apps/push-worker/                                      (vazio — diff zero)
git diff --stat -- lib/firebase/plantaoReadRepository.ts lib/firebase/plantaoWriteRepository.ts   (vazio — diff zero)
git diff --stat -- packages/contrato/src/modeloPlantaoPersistente.ts      (vazio — diff zero)
git diff --stat -- components/organizacao/ lib/organizacao.ts             (vazio — diff zero)
```

Arquivos alterados: `apps/dashboard/src/DashboardApp.tsx`, `package.json`,
`packages/contrato/src/parserPlantao.ts`, `packages/contrato/src/tiposPlantao.ts`,
`packages/contrato/test/parserPlantao.test.ts`, `docs/spec/PLANTOES.md`.
Arquivo novo: `tests/plantao-conferencia-contabil-boundaries.test.mjs`,
mais este checkpoint. Nenhuma planilha real, nenhuma fixture nova (a
fixture sanitizada existente já tinha os valores corretos).

Commit único local (`fix(plantao): separa totais e divergencias da
fonte`), sem `--amend`, sem rebase, sem merge. **NÃO houve push. NÃO
houve deploy. Firebase não foi alterado. Nenhum Plantão foi publicado
(publicação continua inexistente). Produção não foi tocada.**
