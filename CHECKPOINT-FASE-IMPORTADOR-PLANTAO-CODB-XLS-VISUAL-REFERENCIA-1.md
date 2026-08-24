# Checkpoint — Fase IMPORTADOR-PLANTAO-CODB-XLS-VISUAL-REFERENCIA-1

Data: 2026-08-24. Escopo: analisar a planilha real do Plantão CODB
(`Relatorio-PlantaoCODB.xls`, insumo local fora do repositório) e as
referências visuais de produto para a futura tela de "Plantões
monitorados" consultada pelo NOC, e implementar o parser puro capaz de ler
a estrutura real dessa planilha. **Nenhuma persistência, nenhuma tela,
nenhuma conciliação de login, nenhum commit, nenhum push, nenhum deploy,
nenhuma alteração de Docker/Cloudflare/Tenant Microsoft/seed/produção.**

## Baseline (precheck)

```
pwd                         /root/projetos/Escala-ICI-main
git rev-parse --show-toplevel   idem
git branch --show-current   feature/importador-plantao-codb-xls-visual-ref
git status --short          (vazio)
git rev-parse HEAD          90727734ee0012e8bf16f367f53ed7507294d949
git rev-parse origin/main   90727734ee0012e8bf16f367f53ed7507294d949 (igual — sem divergência)
```

Working tree limpa no início. Nenhuma ação destrutiva (reset/rebase/
merge/stash/checkout/amend) foi necessária.

## Insumos analisados (nunca versionados)

- `/root/insumos-escala-ici/Relatorio-PlantaoCODB.xls` — planilha real,
  1 aba ("Plantao"), 34 linhas, 6 colunas.
- `/root/insumos-escala-ici/referencias-visuais/refs_plantao_noc_codb/` —
  5 imagens PNG + `README_REFERENCIA_VISUAL.md` (referência visual de
  produto, resumida em `docs/spec/PLANTOES.md` § 35.3).

Nenhum dos dois foi copiado para dentro do repositório nem referenciado
por caminho absoluto em código versionado.

## Descoberta estrutural — por que era necessário um parser novo

`localizarTabelaPlantao()`/`parsePlanilhaPlantao()` (Fase PLANTÃO-1)
assumem uma única coluna "Plantonista..." por tabela (3 colunas contíguas:
Plantonista/Data Início/Data Fim). A planilha real do Plantão CODB tem
**quatro** colunas de fonte lado a lado (`Plantonista DBA`/`Plantonista
Linux`/`Plantonista Telecom`/`Plantonista Windows`) compartilhando um
único par `Data Inicio`/`Data Fim` por linha — testado e confirmado que
essa estrutura **não é reconhecida** pelo detector de fonte única (a
coluna imediatamente após a primeira "Plantonista DBA" é "Plantonista
Linux", não "Data Início", então a assinatura de 3 colunas contíguas nunca
bate). Por isso esta fase implementa um domínio irmão, aditivo, sem tocar
nenhum arquivo do domínio de fonte única além de exportar dois símbolos já
existentes.

## Arquivos novos

- `packages/contrato/src/detectorTabelaPlantaoMultiFonte.ts` —
  `localizarTabelaPlantaoMultiFonte(workbook)`: aceita uma ou mais colunas
  contíguas iniciadas em "PLANTONISTA" (normalizado, sem acento/caixa),
  imediatamente seguidas de "Data Início"/"Data Fim" nesta ordem. Cada
  coluna carrega sua `fonte` (texto do cabeçalho após "Plantonista",
  preservado como está — nunca inventado). Mesmos status de
  `localizarTabelaPlantao`: `UNICA`/`AMBIGUA`/`AUSENTE`, mesma filosofia de
  nunca depender de nome de aba/arquivo.
- `packages/contrato/src/parserPlantaoMultiFonte.ts` —
  `parsePlanilhaPlantaoMultiFonte(arquivo)`: gera uma atribuição por
  combinação (linha, fonte com nome preenchido). Reaproveita
  `interpretarMomento()`/`calcularDuracaoEntreMomentos()` já existentes em
  `parserPlantao.ts` — nenhuma regex de data duplicada. Não implementa
  extração de "Contabilidade dos Plantões no mês" (a planilha real do
  Plantão CODB não tem essa seção).
- `packages/contrato/test/parserPlantaoMultiFonte.test.ts` — 14 testes:
  fixture real (contagem de atribuições, fontes na ordem do cabeçalho,
  nome original preservado, coluna vazia numa linha não é erro, aviso de
  dia da semana divergente sem alterar a data, duração através de virada
  de dia, aba de origem preservada), detector isolado (N=1, "Plantonista"
  sem sufixo, AUSENTE, AMBIGUA) e erros estruturais do parser.
- `packages/contrato/test/dadosPlantaoMultiFonte.ts` — carrega a fixture,
  mesmo padrão de `dadosPlantao.ts`.
- `packages/contrato/test/fixtures/Plantao-CODB-SANITIZADO.xls` — fixture
  binária sanitizada (nomes fictícios), gerada via `xlsx` reproduzindo a
  estrutura de 4 colunas e os casos de borda reais: janela atravessando
  mais de um dia (43h), dia da semana em texto divergente da data numérica
  e uma linha com uma fonte sem plantonista.

## Arquivos alterados (diff mínimo, aditivo)

- `packages/contrato/src/tiposPlantao.ts` — adicionados
  `AtribuicaoPlantaoBrutaMultiFonte`/`ResultadoParsePlantaoMultiFonte`,
  tipos próprios que nunca reaproveitam
  `AtribuicaoPlantaoBruta`/`ResultadoParsePlantao` do domínio de fonte
  única. Nenhum tipo existente foi modificado.
- `packages/contrato/src/parserPlantao.ts` — só `export` adicionado a
  `interpretarMomento()` e à interface `MomentoInterpretado` (nenhuma
  lógica alterada), para o novo parser reaproveitar a mesma interpretação
  de data/hora e o mesmo aviso de dia da semana.
- `packages/contrato/src/index.ts` — exporta os dois módulos novos.
- `docs/spec/PLANTOES.md` — nova seção 35 documentando a estrutura
  multi-fonte, a fixture e o resumo das 5 referências visuais (§ 35.3),
  mais o que esta fase explicitamente não faz (§ 35.4).

## Referências visuais — resumo (detalhe completo em `PLANTOES.md` § 35.3)

As 5 imagens (menu real do CODB/COSI/NOC, dashboard desktop de consulta,
dashboard desktop de configuração de fontes visíveis, "Plantões de hoje"
mobile, bottom sheet mobile de seleção de fontes) confirmam a direção já
prevista pelo modelo de administração por Grupo
(`escoposOperacionais.ts`): NOC consulta múltiplas fontes sem administrar
nenhuma; CODB administra DBA/Linux/Telecom/Windows; COSI administra
Plantão COSI; NOC administra a própria Escala NOC. Em mobile, filtro por
fonte é chip horizontal e seleção avançada abre em bottom sheet, nunca
modal de tela cheia. Essa direção fica registrada para a fase futura que
implementar a tela — nenhuma tela foi criada nesta fase.

## Testes executados

```
npm run typecheck          OK
npm run test:unit          OK (68 arquivos, 1254 testes — todos os
                            pré-existentes seguem verdes, nenhum tocado
                            além dos novos)
npm run test:boundaries    OK (462 testes)
npm run lint               OK (0 erros; 6 warnings pré-existentes,
                            nenhum nos arquivos desta fase)
```

`npm run build`/`validate:pwa`/`validate:artifact`/testes de Firestore
Rules não foram executados nesta fase — não há mudança de UI, build de
apps, PWA nem Rules; escopo é só o pacote `packages/contrato` e a
especificação.

## Busca por PII (obrigatória antes de qualquer commit futuro)

```
grep -rn "Mikelis|Cechelero|Bruno Carneiro|Rachel Christine Reszka|Diogenes Fabricio|\
Larissa de Britto|Vitoria Dias Nogueira|Alex dos Santos Vilanova|Luiz Felipe Souza Dias|\
Carlos Eduardo Ribas|Ramses Albino|Dhyego Andre Reszka|Cleber Augusto Cesconetto|\
Jose Carlos Batista|Fabiano de Albuquerque|Andr.* Felipe Plautz Rempel|\
Juliana Medeiros Camargo|Peterson Tahuny" \
  --include=*.ts --include=*.tsx --include=*.md --include=*.xls --include=*.xlsx --include=*.json \
  . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.sites-runtime
```

Zero ocorrências no estado final. **Achado durante esta fase** (registrado
para transparência): a primeira versão do exemplo estrutural escrito em
`docs/spec/PLANTOES.md` § 35.1 usou os 4 primeiros nomes reais da
planilha truncados com "..." (`Mikelis .../Larissa .../Ramses
.../Fabiano ...`) — corrigido antes de qualquer commit para os mesmos
nomes fictícios já usados na fixture (`Ana Costa`/`Bruno Lima`/`Carlos
Nunes`/`Diana Melo`), e a busca por PII foi re-executada confirmando zero
ocorrências. A fixture binária `Plantao-CODB-SANITIZADO.xls` foi verificada
via leitura real com `xlrd` (não só `strings`) — confirmado que só contém
os 8 nomes fictícios (`Ana Costa`, `Bruno Lima`, `Carlos Nunes`, `Diana
Melo`, `Eduardo Reis`, `Fernanda Alves`, `Gustavo Pinto`, `Helena Souza`).

## Decisões adiadas para fases futuras

- Tela "Plantões monitorados"/"Plantões visíveis para consulta" (dashboard
  e app, desktop e mobile) — § 35.3 é só a referência de produto.
- Conciliação nome→login para atribuições multi-fonte.
- Modelo persistente/Firestore para um `GrupoPlantao` do tipo CODB —
  `AtribuicaoPlantaoBrutaMultiFonte` continua um contrato só de parser, sem
  nenhum schema Firestore associado.
- Roteamento automático entre fonte única e multi-fonte (hoje são duas
  funções de entrada separadas — `parsePlanilhaPlantao` e
  `parsePlanilhaPlantaoMultiFonte` — sem um `detectarTipoPlanilha` comum
  que escolha entre elas; decisão adiada até existir uma segunda fonte
  real de multi-fonte para confirmar o critério de desambiguação).

## Riscos conhecidos

- `localizarTabelaPlantaoMultiFonte` também reconhece o caso degenerado
  N=1 (uma única coluna "Plantonista..."), o que colide estruturalmente
  com `localizarTabelaPlantao` do domínio de fonte única para a mesma
  planilha. Sem risco nesta fase porque as duas funções nunca são
  chamadas em conjunto por nenhum código de produção — ambas são apenas
  exportadas do pacote `contrato`, não há nenhum roteador que as invoque
  automaticamente ainda.
- Nenhum risco nas proteções absolutas da fase (Firestore/Rules/Auth/
  Push/App/Dashboard/Docker/Cloudflare/Tenant Microsoft/seed/produção/
  parser de fonte única) — nenhum desses foi tocado.

## Próxima fase prevista

Uma fase futura decide como expor `parsePlanilhaPlantaoMultiFonte` a um
fluxo de importação real (provavelmente reaproveitando o preview do
Dashboard da Fase PLANTÃO-2, com a fonte de cada atribuição virando um
campo visível) e, separadamente, implementa a tela "Plantões monitorados"
usando `docs/spec/PLANTOES.md` § 35.3 como referência.

## Git

**Nenhum commit criado nesta sessão** — por instrução explícita do
usuário ("Não fazer commit, push ou deploy"). Todas as alterações
permanecem no working tree da branch
`feature/importador-plantao-codb-xls-visual-ref`, prontas para revisão e
commit manual pelo usuário. Nenhum push. Nenhum deploy. Firebase não foi
tocado. Produção não foi tocada. Docker/Cloudflare/Tenant Microsoft/seed
não foram tocados.
