# Checkpoint — Fase PLANTÃO-1 (detector + parser isolado de Plantão)

Data: 2026-08-15. Escopo: fundação determinística de leitura/importação de
planilhas de Plantão — detecção de tipo de planilha, parser isolado,
contrato puro, fixture sanitizada e testes. **Nenhuma persistência,
nenhuma tela, nenhuma conciliação de login, nenhuma alteração de
Firestore/Rules/Auth/Push/App/Dashboard.**

## Baseline (precheck)

```
pwd                              /home/vergani/projetos/Escala-ICI
git rev-parse --show-toplevel    idem
git branch --show-current        main
git status --short               (vazio)
git fetch origin                 ok
git status --branch --short      ## main...origin/main [ahead 1]
git rev-parse HEAD                7600894 (commit da Fase PLANTÃO-0)
git rev-parse origin/main         0c119e17f67ebf012d0b9fde398ac6199162190e
```

`ahead 1` confirmado como esperado (não é divergência) — `origin/main`
permaneceu em `0c119e1`, sem avanço remoto inesperado. Working tree limpa
no início. Nenhuma ação destrutiva (reset/rebase/merge/stash/checkout/
amend) foi necessária.

## Arquitetura do detector

`packages/contrato/src/detectorPlanilha.ts`:

- `detectarTipoPlanilha(arquivo: ArrayBuffer): ResultadoDeteccaoPlanilha`
  — roteador puro entre os dois domínios, um único parâmetro (nunca nome
  de arquivo — provado por teste de arity da função).
- `localizarTabelaPlantao(workbook)` — função compartilhada entre o
  detector e o parser, para os dois nunca divergirem sobre "qual aba é a
  de Plantão".

Assinatura estrutural usada:

- **ESCALA_6X1**: existe uma aba cujo nome normaliza (sem acento/caixa)
  para `ESCALISTAS`, contendo em algum lugar a célula `DIA/MÊS`. Sinal
  mínimo o suficiente para diferenciar do resto — não reimplementa a
  busca completa de `parsePlanilhaEscala`.
- **PLANTAO**: três colunas contíguas na mesma linha, em qualquer aba,
  onde a primeira normaliza com prefixo `PLANTONISTA` (aceita
  "Plantonista Segurança"/"Plantonista Redes"/etc.), a segunda normaliza
  exatamente para `DATAINICIO` e a terceira para `DATAFIM`. Nunca depende
  do nome da aba (`PlantaoCOSI` não é hardcoded em lugar nenhum — testado
  renomeando a aba da fixture).
- **Ambiguidade nunca é resolvida silenciosamente**: mais de uma aba
  compatível com a estrutura de Plantão retorna `DESCONHECIDA` com
  `abasCandidatas` preenchido, listando os nomes reais das abas em
  conflito. Uma planilha com sinais de **ambos** os domínios ao mesmo
  tempo também retorna `DESCONHECIDA` explícita.
- Uma célula solta contendo só a palavra "Plantão" nunca é suficiente —
  testado explicitamente (a assinatura de 3 colunas precisa bater por
  inteiro).

Normalização usada: `normalizarChaveEstrutural` (nova, em
`normalizar.ts`) — remove tudo que não é letra/dígito (espaço, `/`, `°`,
`º`, pontuação), além de acento/caixa. As duas funções de normalização já
existentes (`normalizarTexto`/`normalizarCelula`) não foram alteradas.

## Arquitetura do parser

`packages/contrato/src/parserPlantao.ts`:

- `parsePlanilhaPlantao(arquivo: ArrayBuffer): ResultadoParsePlantao` —
  único ponto de entrada. Usa `localizarTabelaPlantao` para achar a
  tabela, depois lê linha a linha até encontrar uma linha **inteiramente
  vazia** (nome **e** início **e** fim em branco) — uma linha com nome
  vazio mas datas preenchidas gera erro de linha e a leitura **continua**
  (decisão desta fase: não confundir "faltou o nome nesta linha" com
  "acabou a tabela", ao contrário do loop mais simples do parser 6x1 que
  para no primeiro login vazio).
- Nunca aborta no primeiro erro — cada linha inválida vira uma entrada em
  `erros`, e a leitura segue (`atribuicoes` continua populado mesmo com
  `ok=false`, mesma filosofia de `parsePlanilhaEscala`).
- Helpers puros exportados: `calcularDuracaoBrutaDosIntervalos`,
  `detectarSobreposicoesPlantao`, `identificarLacunasPlantao`,
  `listarPlantonistasUnicos` — nenhum deles chama Firebase, nenhum deles
  decide login.

`packages/contrato/src/celulas.ts` (novo): helpers genéricos de leitura de
célula XLSX (`obterCelula`/`valorCelula`/`textoCelula`/`ehVazio`),
equivalentes aos helpers privados já existentes em `parser.ts`.
**Duplicados deliberadamente**, não exportados de `parser.ts`, para
cumprir literalmente "não reescrever o parser 6x1 sem necessidade" — o
diff de `parser.ts` é zero.

## Tipos públicos adicionados (`tiposPlantao.ts`)

```ts
type TipoPlanilha = 'ESCALA_6X1' | 'PLANTAO' | 'DESCONHECIDA';
interface ResultadoDeteccaoPlanilha { tipo; abaEncontrada?; abasCandidatas?; motivo?; }
interface MomentoPlantao { data: string; hora: string; }   // civil, sem timezone
interface AtribuicaoPlantaoBruta {
  plantonistaNomeOriginal: string;
  inicio: MomentoPlantao; fim: MomentoPlantao;
  duracaoMinutos: number; linhaOrigem: number; abaOrigem: string;
}
interface ErroImportacaoPlantao { linha; coluna; plantonistaNomeOriginal?; valorEncontrado; motivo; sugestao?; }
interface ContabilidadePlantaoInformada { plantonistaNomeOriginal; quantidadeInformada; minutosInformados; valorHorasBruto; }
interface TotaisInformadosPlantao { totalPlantoesInformado; totalMinutosInformado; }
interface TotalBrutoPlantao { quantidade; minutos; }
type TipoSobreposicaoPlantao = 'MESMO_PLANTONISTA' | 'PLANTONISTAS_DIFERENTES';
interface SobreposicaoPlantao { tipo; a: AtribuicaoPlantaoBruta; b: AtribuicaoPlantaoBruta; }
interface LacunaPlantao { fimAnterior: MomentoPlantao; inicioProximo: MomentoPlantao; minutos: number; }
interface ResultadoParsePlantao {
  ok: boolean; abaOrigem: string;
  atribuicoes: AtribuicaoPlantaoBruta[];
  contabilidadeInformada: ContabilidadePlantaoInformada[];
  totaisInformados: TotaisInformadosPlantao | null;
  totalBrutoCalculado: TotalBrutoPlantao;
  sobreposicoes: SobreposicaoPlantao[];
  erros: ErroImportacaoPlantao[];
  avisos: string[];
}
```

`AtribuicaoPlantaoBruta` não tem nenhum campo de identidade técnica além
de `plantonistaNomeOriginal` — testado explicitamente (o objeto retornado
só tem exatamente essas 6 chaves). Nenhum código chama
`importUsers`/`conciliacaoUsuarios`.

## Como datas/horas são representadas

`MomentoPlantao { data: 'YYYY-MM-DD'; hora: 'HH:mm' }` — par civil, nunca
uma string combinada com timezone nem um `Date` com fuso. Mesmo princípio
de `ReferenciaTemporal` (`jornada.ts`), já existente no projeto
exatamente para não sofrer conversão silenciosa pelo timezone da máquina
que roda o código.

A fonte de verdade da data/hora é sempre o padrão numérico
`DD/MM/AAAA - HH:mm`, extraído por regex do texto de exibição da célula
(`textoCelula`: prefere `.w`, cai para `.v` stringificado). O nome do dia
da semana (texto antes da primeira vírgula, ex. "Segunda-feira,") **nunca
altera a data** — é só validado opcionalmente contra o dia da semana real
calculado a partir da data numérica; uma divergência intencionalmente
testada (`Segunda-feira` numa data que é sábado de verdade) gera um
`aviso`, nunca corrige nem rejeita a linha.

## Como o timezone foi tratado

Decisão desta fase: **nenhuma conversão de timezone em lugar nenhum**.
Internamente, para calcular a diferença em minutos entre início e fim,
`Date.UTC(...)` é usado só como relógio aritmético neutro (mesma técnica
de `dataUtc()`/`minutosHora()` em `jornada.ts`) — isso não é uma
afirmação de fuso horário real sobre o dado, é só aritmética de data
civil. Qual timezone real um Grupo de Plantão declara (e como isso é
persistido) continua decisão adiada para PLANTÃO-3; esta fase só garante
que o parser não perde nem corrompe informação por conversão prematura.
Documentado em `docs/spec/PLANTOES.md`, seção 18.3.

## Fixture sanitizada

`packages/contrato/test/fixtures/Plantao-COSI-SANITIZADO.xls` — aba
`PlantaoCOSI` (nome não hardcoded no parser — testado renomeando).
Gerada programaticamente via `xlsx` (`XLSX.utils.aoa_to_sheet` +
`XLSX.write(..., { bookType: 'xls' })`), mesmo formato binário OLE2/CFB da
fixture 6x1 existente.

- **32 atribuições brutas** (`Ana Costa`, `Bruno Lima`, `Carlos Nunes`,
  `Daniela Rocha` — nomes fictícios).
- Primeira linha: sábado 00:00 → domingo 19:00 = **43h** (não virou 24h).
- Última linha: terça 19:00 → quarta 00:00 = **5h** (não virou 12h).
- Padrões normais: **12h** (após expediente) e **24h** (fim de semana).
- **Total bruto calculado: 504h** (30.240 minutos, `quantidade: 32`).
- **Contabilidade informada: 31 plantões, 468h** (28.080 minutos) —
  Carlos Nunes 10/156h, Ana Costa 10/168h, Daniela Rocha 0/0h, Bruno Lima
  11/156h.

## Confirmação explícita: 504h e 468h permanecem distintos

`resultadoFixture().totalBrutoCalculado.minutos` (30.240) e
`resultadoFixture().totaisInformados.totalMinutosInformado` (28.080) são
comparados com `.not.toBe(...)` no teste 19 de
`parserPlantao.test.ts` — a divergência é uma asserção do teste, não um
efeito colateral não verificado.

## Confirmação: nenhuma regra foi inventada para reconciliar 504h e 468h

- `calcularDuracaoBrutaDosIntervalos()` — nome deliberadamente distinto de
  "contabilidade mensal" (documentado no próprio tipo `TotalBrutoPlantao`
  e na função) — só soma o que foi lido, nunca ajusta.
- `extrairContabilidadeInformada()` só lê a seção do XLS como está —
  nenhuma linha é descartada, nenhum valor é recalculado para bater com o
  bruto.
- Quando os dois totais divergem, o único efeito é um `aviso` de texto
  (`avisos.some(a => a.includes('Divergência'))`, testado) — `ok` não
  vira `false` só por causa da divergência (ela não é tratada como erro
  estrutural), e nenhum dos dois números é alterado. Testes 19-21 provam
  isso explicitamente.

## Casos de erro cobertos

Nome vazio (com continuação da leitura), início inválido, fim inválido,
fim anterior ao início, planilha sem estrutura reconhecida (detector e
parser), múltiplas abas ambíguas — todos com `motivo` legível e
`linha`/`coluna` de diagnóstico. Sobreposição de intervalos (mesmo
plantonista, incluindo duplicata exata; plantonistas diferentes) é
detectada e exposta em `sobreposicoes`, nunca corrigida automaticamente.

## Compatibilidade com o parser 6x1

- `packages/contrato/src/parser.ts` — **diff zero**, confirmado por
  `git diff --stat` (arquivo não aparece na lista de alterados).
- `packages/contrato/src/catalogo.ts` — não tocado.
- `packages/contrato/src/index.ts` ganhou 4 linhas de export novas
  (`celulas`, `detectorPlanilha`, `parserPlantao`, `tiposPlantao`);
  nenhum export existente foi removido, renomeado ou reordenado de forma
  destrutiva.
- Teste explícito (`parserPlantao.test.ts`, caso 24): `parsePlanilhaEscala`
  sobre a fixture 6x1 original continua `ok: true` com 9 documentos.
- Toda a suíte `parser.test.ts` (27 testes) continua passando sem
  alteração — 0 modificações nesse arquivo.

## Testes

37 testes novos:

- `detectorPlanilha.test.ts` — **8 testes** (itens 1–8 da seção 21 do
  pedido: fixture 6x1, fixture Plantão, arity da função, aba renomeada,
  planilha desconhecida, ambiguidade explícita, tolerância de
  caixa/acento/espaço, palavra solta insuficiente).
- `parserPlantao.test.ts` — **29 testes** (24 itens da seção 22 + 1 teste
  de dia da semana divergente + 4 testes dos helpers puros isolados:
  `calcularDuracaoBrutaDosIntervalos`, `detectarSobreposicoesPlantao`,
  `identificarLacunasPlantao`, `listarPlantonistasUnicos`).

Resultados finais:

```
npm run typecheck          OK
npm run typecheck:apps     OK (dashboard + app-web)
npm run typecheck:worker   OK (push-worker)
npm run test:unit          549/549 passou (43 arquivos) — era 512, +37 novos
npm run test:boundaries    102/102 passou (sem alteração)
npm run lint               0 erros, 5 warnings pré-existentes
                            (mesmos 2 arquivos de teste não tocados nesta
                            fase: lib/firebase/authRepository.test.ts,
                            lib/firebase/lembretesRepository.test.ts)
npm run build:app:pages    OK
npm run validate:pwa       OK
npm run validate:artifact  OK
git diff --check           limpo
```

`packages/contrato` tem seu próprio `tsconfig.json` local, mais estrito
(`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) que o
`tsconfig.json` raiz usado pelo `npm run typecheck` da baseline. Todo o
código novo desta fase foi ajustado para satisfazer essa configuração
local mais estrita também (`npx tsc --noEmit` dentro de
`packages/contrato` limpo para os arquivos novos). Um erro pré-existente
em `jornada.ts:260` sob essa mesma configuração local foi confirmado como
**anterior a esta fase** (reproduzido isolando as alterações) e está fora
do escopo — `jornada.ts` não foi tocado.

## Busca por PII (obrigatória antes do commit)

```
grep -rn "Bruno Bueno|Caroline Ribeiro de Freitas|Claudio Rogerio Lis|Jean Carlo Machado Ribeiro" \
  --include=*.ts --include=*.tsx --include=*.md --include=*.xls --include=*.xlsx --include=*.json \
  . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.sites-runtime
```

Zero ocorrências confirmadas no estado final. **Achado durante esta fase**
(registrado para transparência): o documento `docs/spec/PLANTOES.md`,
escrito na Fase PLANTÃO-0, continha os nomes reais "Caroline Ribeiro de
Freitas" e "Bruno Bueno" no exemplo ilustrativo da seção "Consulta 'quem
está de plantão'" — copiados do enunciado da fase anterior sem se dar
conta, na hora, de que eram nomes reais da planilha (não uma invenção
genérica). Como esta fase já precisava editar `PLANTOES.md`, os dois
nomes foram substituídos por `Ana Costa`/`Bruno Lima` (as mesmas
identidades fictícias já usadas na fixture), e a busca por PII foi
re-executada para confirmar zero ocorrências no estado final antes do
commit.

O binário `Plantao-COSI-SANITIZADO.xls` foi verificado via leitura real
com a própria biblioteca `xlsx` (não só `strings`, que não decodifica de
forma confiável texto dentro do formato binário OLE2/CFB) — confirmado
que só contém os 4 nomes fictícios (`Ana Costa`, `Bruno Lima`, `Carlos
Nunes`, `Daniela Rocha`) e nenhum dos 4 nomes reais.

## Decisões adiadas para PLANTÃO-2

- Conciliação nome do XLS → login real (a especificação já formaliza o
  fluxo na seção 10 de `PLANTOES.md`; nada disso foi implementado agora —
  `listarPlantonistasUnicos()` só entrega o insumo puro, sem tocar
  `conciliacaoUsuarios`/`importUsers`).
- Preview no Dashboard.
- Decodificação de células de data/hora genuinamente numéricas (serial do
  Excel) sem nenhuma formatação associada — hoje vira erro de linha em vez
  de adivinhar; documentado como risco aceito em `PLANTOES.md`.
- Persistência, Rules, schema Firestore de Grupo/Turno/Contato de Plantão
  — inteiramente adiado para PLANTÃO-3, como já estava.

## Riscos conhecidos

- Ambiguidade de detecção (>1 aba compatível) nunca escolhe
  silenciosamente, mas também não oferece nenhuma UI de resolução ainda —
  isso é trabalho de PLANTÃO-2.
- `interpretarHorasInformadas` reconhece `"H:M"` e `"H"` puro; um formato
  de horas informado de forma bem diferente do observado na planilha real
  vira `0` minutos com um aviso — não falha a importação, mas também não
  tenta adivinhar mais do que isso.
- Nenhum risco nas proteções absolutas da fase (Firestore/Rules/Auth/Push/
  App/Dashboard/parser 6x1) — nenhum desses arquivos foi tocado.

## Próxima fase prevista

PLANTÃO-2 — preview no Dashboard + conciliação nome→login, usando
`detectarTipoPlanilha`/`parsePlanilhaPlantao`/`listarPlantonistasUnicos`
como estão, sem alterar o contrato desta fase a não ser que o preview
real exponha uma lacuna concreta.

## Git

Commit local criado (mensagem `feat(plantao): adiciona detector e parser
isolado`). **Nenhum push. Nenhum deploy. Firebase não foi tocado.
Produção não foi tocada.**
