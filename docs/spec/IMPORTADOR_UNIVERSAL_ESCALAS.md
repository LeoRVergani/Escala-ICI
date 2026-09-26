# Especificação — Importador universal de escalas (modelo canônico)

Fase FASE-IMPORTADOR-UNIVERSAL-1. Substitui a ideia de "um parser por
planilha" (`parserCODB()`, `parserCOSI()`, ...) por um modelo intermediário
neutro e um entrypoint único de análise, sem descartar os
parsers/detectores existentes — eles viram a implementação por trás do
motor, não uma segunda arquitetura paralela.

## 1. Objetivo

Separar, no código, as camadas que hoje ficam misturadas na prática:

1. leitura do arquivo;
2. detecção da estrutura real (fonte única × multi-função × outras, no
   futuro);
3. conversão para um modelo canônico neutro (fato extraído, nunca regra);
4. interpretação/domínio (conciliação, competência, Grupo, cálculos,
   publicação) — inalterado, continua fora deste módulo.

## 2. Princípio fundamental

O leitor/detector/conversor **não decide** competência, Grupo, regra 6x1,
conciliação de usuário ou publicação. Ele só produz fatos: quem, quando,
de onde. Tudo que é decisão de domínio continua em
`lib/conciliacaoPlantoes.ts`, `lib/montagemRascunhoPlantao.ts`,
`competenciaOperacional()`/`periodoDaCompetencia()`/`dataPertenceCompetencia()`
e no Editor do Dashboard — nada disso foi duplicado ou movido para cá.

## 3. Estado real desta fase (o que existe, o que não)

Implementado (`packages/contrato/src/importacao/`):

- `modeloCanonico.ts` — `RegistroEscalaCanonico`, `TipoEstruturaEscala`,
  `DescobertaPlanilhaEscala`, `EstatisticasImportacaoEscala`,
  `ResultadoAnaliseEscala`, `calcularEstatisticasImportacao()`,
  `pessoasUnicasDosRegistros()`.
- `analisadorEscala.ts` — `analisarArquivoEscalaPlantao()` (entrypoint
  universal do domínio Plantão) e `converterAnaliseParaResultadoParsePlantao()`
  (adaptador de volta para o formato que o Editor/Dashboard já consomem).

**NÃO implementado nesta fase** (dívida documentada, não esquecida):

- Scanner/classificador genérico de célula por célula
  (`TipoCelulaProvavel`, `CelulaObservada`, `papelProvavel`/`confianca` por
  coluna) — o "motor universal" atual decide a estrutura reaproveitando os
  DOIS detectores determinísticos já existentes e testados
  (`localizarTabelaPlantaoMultiFonte()`, `localizarTabelaPlantao()`), não
  uma classificação de célula genérica do zero. Continua determinístico,
  testável e sem IA — só menos generalizado do que a visão de longo prazo.
- Estrutura `GRADE_MENSAL` (Jornada 6x1) — `parsePlanilhaEscala()` continua
  com seu próprio pipeline completo, não convertido ao modelo canônico.
  `processarArquivoImportado()` continua roteando para ele sem qualquer
  mudança de comportamento.
- Mapeamento manual de colunas, sistema de "Perfil de Importação", tela de
  diagnóstico no Dashboard, separação visual erro-de-arquivo/alerta-de-domínio/
  pendência-de-conciliação/inconsistência-de-competência — nenhuma UI nova
  nesta fase.
- Conversão do formato de fonte única para o modelo canônico é usada só
  por `analisarArquivoEscalaPlantao()` (diagnóstico/teste); o roteador do
  Dashboard (`lib/importadorPlanilha.ts`) continua chamando
  `parsePlanilhaPlantao()` DIRETO para fonte única, preservando
  `contabilidadeInformada`/`totaisInformados` (seção que só existe nesse
  formato e que o modelo canônico ainda não carrega) — ver seção 6.

Essas quatro dívidas são a Fase C/D natural: generalizar o scanner para
QUALQUER estrutura tabular (não só as duas de Plantão já conhecidas),
migrar Jornada 6x1, e construir a UI de revisão/confiança/mapeamento
manual.

## 4. `TipoEstruturaEscala` (hoje)

```ts
type TipoEstruturaEscala = 'PLANTAO_INTERVALO' | 'PLANTAO_MULTIFONTE' | 'DESCONHECIDA';
```

`PLANTAO_INTERVALO` = fonte única (1 coluna "Plantonista", ex. Plantão
COSI/Segurança). `PLANTAO_MULTIFONTE` = 2+ colunas "Plantonista <fonte>"
(ex. Plantão CODB: DBA/Linux/Telecom/Windows). `GRADE_MENSAL` (Jornada
6x1) ainda não é um valor deste tipo — ver seção 3.

## 5. `RegistroEscalaCanonico`

```ts
interface RegistroEscalaCanonico {
  origem: { folha: string; linha: number };
  pessoa: { nomeFonte: string };
  inicio: MomentoPlantao;
  fim: MomentoPlantao;
  duracaoMinutos: number;
  funcao?: FuncaoPlantao; // só presente no fluxo PLANTAO_MULTIFONTE
}
```

Preserva fato, nunca regra: nenhum campo de usuário conciliado, uid,
Grupo, competência ou status de publicação. `funcao` vem sempre do
CABEÇALHO da coluna (`Plantonista <fonte>`), nunca inferida do nome da
pessoa.

## 6. Bug real corrigido: "4 plantonistas" em vez de 17

Causa raiz (`lib/importadorPlanilha.ts`, antes desta fase): o roteador só
conhecia dois destinos — `parsePlanilhaEscala()` (6x1) e
`parsePlanilhaPlantao()` (fonte única) — decididos por
`detectarTipoPlanilha()`, que só chama `localizarTabelaPlantao()` (fonte
única). Numa planilha multi-fonte real (Plantão CODB: "Plantonista DBA,
Plantonista Linux, Plantonista Telecom, Plantonista Windows, Data Inicio,
Data Fim"), a ÚLTIMA coluna "Plantonista Windows" fica contígua às duas
colunas de data — exatamente o padrão que `localizarTabelaPlantao()`
procura (`Plantonista* | Data Início | Data Fim`, três colunas
consecutivas). O detector "acertava" sozinho, silenciosamente,
interpretando a planilha inteira como se tivesse UM posto só (Windows) —
os outros 3 postos (96 das 128 atribuições reais, a maioria das pessoas)
nunca eram lidos. Resultado real reportado: 4 plantonistas / 32 plantões /
4 vínculos, quando o arquivo real tem 17 pessoas / 128 atribuições / 32
ocorrências / 32 por função.

Corrigido em `lib/importadorPlanilha.ts`: `processarArquivoImportado()`
agora chama `analisarArquivoEscalaPlantao()` PRIMEIRO — que checa
`localizarTabelaPlantaoMultiFonte()` antes de qualquer outra coisa e só
aceita a estrutura como `PLANTAO_MULTIFONTE` quando há **2 ou mais**
colunas "Plantonista <fonte>" (nunca 1 — isso continua fonte única). Uma
planilha genuinamente multi-fonte nunca mais degrada silenciosamente para
fonte única. Confirmado com o arquivo real
(`Relatorio-PlantaoCODB.xls`, via `processarArquivoImportado()`, o mesmo
entrypoint que o Dashboard chama):

```
tipo: PLANTAO
atribuicoes: 128
pessoasUnicas: 17
porFuncao: { DBA: 32, LINUX: 32, TELECOM: 32, WINDOWS: 32 }
ocorrencias: 32
periodo: 2026-07-25 -> 2026-08-26
```

## 7. Confiança

`DescobertaPlanilhaEscala.confianca`: `1` quando o parser subjacente
terminou sem erro estrutural (`resultado.ok`), `0.5` quando terminou com
erros mas ainda produziu uma estrutura reconhecida, `0` (via
`'DESCONHECIDA'`) quando nenhuma estrutura foi localizada. Ainda não há
os graus intermediários de confiança (0.60–0.89 "requer confirmação")
descritos na visão de longo prazo — são parte da Fase C (scanner
genérico), que ainda não existe.

## 8. Testes

- `packages/contrato/test/importacao/analisadorEscala.test.ts` —
  `PLANTAO_MULTIFONTE` com estatísticas corretas; a regressão específica
  do bug real (2+ colunas nunca degrada para fonte única, mesmo quando a
  última coluna sozinha formaria um "trio" válido de fonte única);
  `PLANTAO_INTERVALO` inalterado (nenhuma `funcao` em nenhum registro);
  `DESCONHECIDA` sem inventar registro; `converterAnaliseParaResultadoParsePlantao()`
  produzindo um `ResultadoParsePlantao` válido.
- `lib/importadorPlanilha.test.ts` — teste 4, mesma reprodução da
  estrutura CODB real, mas através do entrypoint que o Dashboard chama de
  fato (`processarArquivoImportado()`), provando que os outros 3 tipos de
  arquivo (6x1, Plantão fonte única, desconhecido) continuam com
  comportamento idêntico ao de antes da fase.

## 9. Limites (documentados, não escondidos)

O importador não promete entender qualquer planilha. Hoje ele só
reconhece as duas estruturas de Plantão já conhecidas — uma planilha
genuinamente nova (ex. uma grade `Nome | Data | Início | Fim` sem nenhum
prefixo "Plantonista") cai em `DESCONHECIDA`, não em interpretação
inventada. Generalizar essa detecção (scanner por conteúdo de célula,
confiança graduada, mapeamento manual de colunas) é o trabalho da
próxima fase — nada disso foi construído ainda para não fazer "big bang"
sobre um bug que já tinha causa raiz clara e testável.
