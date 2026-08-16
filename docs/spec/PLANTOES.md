# Especificação — Plantões (arquitetura + parser + preview, Fases PLANTÃO-0/1/2)

Documento de **planejamento arquitetural**, com fatias reais já
implementadas: PLANTÃO-1 (seção 18) — detecção de tipo de planilha e
parser isolado de Plantão em `packages/contrato`; PLANTÃO-2 (seção 19) —
preview do Dashboard e conciliação obrigatória nome→login, em memória, sem
nenhuma persistência. Não há coleção Firestore nova, nenhuma Rule nova,
nenhum schema persistido — isso continua para PLANTÃO-3. É a fonte de
verdade para as fases seguintes (PLANTÃO-3 em diante), formalizando
decisões de domínio antes de cada fatia de código funcional.

Segue a mesma convenção dos demais documentos de `docs/spec/`: aponta para
evidência real do código quando descreve o que já existe hoje (para não
confundir "estado atual" com "proposta futura"), e é explícito quando está
descrevendo algo que **ainda não existe**.

## Por que este documento existe

O Escala ICI hoje resolve um problema: **jornada normal 6x1** (SOC/NOC),
codificada em `packages/contrato/src/*` e `lib/modelos.ts`, com parser
próprio (`parsePlanilhaEscala`, `packages/contrato/src/parser.ts:501`),
catálogo de códigos (`MD`, `M`, `T`, `N`, `DU`, `DF` e equivalentes,
`packages/contrato/src/catalogo.ts`) e regras de descanso/6x1
(`lib/alertasEscala.ts`).

Existe uma segunda planilha real, de estrutura completamente diferente
("Plantonista Segurança", "Data Inicio", "Data Fim"), representando
**responsabilidade operacional fora da rotina normal** — plantão de
segurança/COSI e afins. Tratar isso como uma variação da escala 6x1 seria
forçar um domínio dentro do outro; ambos precisam de identidade própria.

## 1. Dois domínios, não um

```
ESCALA DE JORNADA                    PLANTÃO
------------------                   -------
Jornada normal do colaborador         Responsabilidade/disponibilidade
Códigos MD/M/T/N/DU/DF                operacional fora da rotina
Regras de descanso/6x1                Pode coexistir com a jornada normal
Hoje: SOC/NOC                         Não usa códigos de jornada
Parser/catálogo próprios              Grupos com regras de cobertura próprias
```

**Regra fundamental: USUÁRIO ≠ ESCALA.** Um usuário não tem um
`tipoEscala` único. Ele pode:

- ter jornada normal e nenhum plantão;
- ter jornada normal e participar de um ou mais grupos de plantão;
- não ter jornada normal (perfil sem 6x1) e ainda assim participar de
  plantão;
- não participar de nenhum plantão e apenas **consultar** quem está de
  plantão (ver seção 9).

Isso implica que a participação em plantão não pode ser um campo escalar em
`Usuario` (`lib/modelos.ts:39`) do tipo `usuario.tipoEscala = 'PLANTAO'` —
isso impediria múltiplas participações e colidiria semanticamente com o que
já existe (`turnoPadrao`, `equipeId`). A participação é uma relação
N:N entre usuário e grupo de plantão (ver seção 3), não um atributo do
usuário.

## 2. Não confundir com política de escalonamento

Dois conceitos que a arquitetura deve manter **desacoplados**:

| Pergunta | Conceito |
| --- | --- |
| "Quem está responsável **agora**?" | Plantão |
| "Quem deve ser acionado se o responsável não atender?" | Política de escalonamento |

Esta fase (e a arquitetura aqui descrita) **não implementa** política de
escalonamento automática. Um `Turno de plantão` (seção 4) não referencia
"próximo nível de escalonamento" nem "tempo até escalar" — esses seriam
conceitos de um domínio adicional, construído por cima do Plantão sem
alterar seu modelo central. Prever o desacoplamento agora evita ter que
desfazer um acoplamento estrutural depois.

## 3. Conceitos de domínio

### Grupo de plantão

Unidade de organização do plantão — análoga a uma `Equipe`
(`lib/modelos.ts:105`) mas não é uma `Equipe`: uma equipe organizacional
(SOC, NOC, Redes, Infra) pode ter zero, um ou vários grupos de plantão
associados, e o inverso também é plausível a longo prazo (um grupo de
plantão que reúne pessoas de mais de uma equipe). Exemplos:
`PLANTAO_COSI`, `PLANTAO_REDES`, `PLANTAO_INFRA`, `PLANTAO_BANCO`.

Campos conceituais (schema Firestore **não fechado** nesta fase):

- identificador e nome;
- descrição;
- equipe(s) responsável(is);
- ativo (`boolean`, mesmo padrão de `Equipe.ativa`/`Usuario.ativo`);
- timezone (a planilha real já mistura virada de dia — ver seção 8; o
  grupo precisa declarar seu fuso horário de referência, não assumir UTC
  nem horário local do navegador);
- visibilidade (quem pode **consultar**, seção 9);
- participantes (ver abaixo);
- regras de cobertura (configuráveis por grupo, seção 7 — nunca globais).

### Participante

Usuário real do Escala ICI, identificado **obrigatoriamente pelo login
funcional** (`usuarios/{login}`, mesma chave usada em todo o projeto — não
o UID do Firebase Auth, princípio já estabelecido em
`docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`). O nome é dado de apresentação;
o login é a identidade técnica permanente. Um participante pode estar em
zero, um ou vários grupos de plantão simultaneamente.

### Turno/intervalo de plantão

Representa um período coberto por um plantonista:

- plantonista (login);
- início / fim (timestamp, considerando o timezone do grupo);
- duração calculada (nunca armazenada como fonte de verdade — derivada de
  início/fim, mesmo princípio de "calcular, não guardar" já usado em
  `lib/alertasEscala.ts` para descanso/6x1);
- competência (mês de referência, para consistência com `turnosMes` e a
  contabilidade mensal existente);
- grupo de plantão a que pertence;
- origem (importação de planilha, geração determinística futura, ou
  override manual — ver seção 4);
- papel primário/secundário — campo previsto para o futuro (plantão com
  titular + backup), não modelado em detalhe nesta fase.

### Escala base, override e escala efetiva

Três níveis, análogos ao par `turnosMes`/`rascunhosTurnosMes` +
publicação/revisão que já existe para a jornada 6x1
(`docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`, `lib/revisoes.ts`), mas como
conceito próprio do domínio de Plantão:

```
BASE       → programação originalmente gerada ou importada da planilha
  ↓
OVERRIDE   → alteração pontual (troca de plantonista, ajuste de horário)
             sem destruir a programação original
  ↓
EFETIVA    → resultado final depois de aplicar os overrides sobre a base
```

Esta fase **não implementa** override — só reserva o lugar dele na
arquitetura, para que PLANTÃO-6 (trocas/substituições) não exija reabrir o
modelo de dados. A "escala efetiva" é sempre a que a Central de Plantões
(seção 5) deve mostrar ao usuário; a base nunca é sobrescrita fisicamente.

## 4. Contatos do plantonista

Até **3 contatos operacionais** por participante, com estrutura semântica
— não três campos posicionais fixos:

```ts
interface ContatoPlantonista {
  rotulo: 'CELULAR_CORPORATIVO' | 'CELULAR_ALTERNATIVO' | 'CELULAR_PESSOAL' | 'RAMAL' | 'OUTRO';
  numero: string;
  ativo: boolean;
}
```

(nomes de campo ilustrativos — o schema Firestore final é decisão de
PLANTÃO-3, não desta fase.)

Regras obrigatórias, a valer desde a primeira implementação real:

- contatos são **dado autenticado** — nunca aparecem antes do login, nunca
  em tela pública, nunca embutidos como dado estático no bundle da
  aplicação, nunca versionados em arquivo de configuração no Git;
- visibilidade por grupo/equipe é prevista como evolução futura (quem pode
  ver o contato de quem depende de quem tem permissão de **consultar** o
  grupo, seção 9) — não implementada nesta fase;
- Firestore Rules para proteger esse dado são trabalho de PLANTÃO-3, não
  desta fase (esta fase não altera `firestore.rules`).

## 5. Central de Plantões — experiência pretendida (não implementada)

Objetivo: um analista SOC/NOC consegue responder "quem está de plantão
agora?" sem abrir XLS, Teams, ou perguntar para outra pessoa.

**Sem alterar a navegação inferior atual** (`Hoje`, `Agenda`, `Trocas`,
`Equipe`, `Perfil` — nenhum sexto item nesta fase, nem nas fases
imediatamente seguintes previstas). A proposta encaixa Plantões dentro da
navegação existente:

- **Tela Hoje**: card rápido "Plantão de Apoio" / "Plantão de Segurança" —
  mesmo espírito do `next-shift-card` que já existe ali para a jornada
  normal, mas para o plantão ativo do momento.
- **Tela Equipe**: sub-navegação `Equipe | Plantões` (mesmo padrão de
  abas/segmented control já usado em outras telas do App).
- **Área Plantões**: `Em plantão agora` / `Próximos` / `Todos os
  plantões` / `Meus plantões` (esta última só relevante para quem
  participa de ao menos um grupo).

Para um participante, "Meus plantões" deve oferecer: calendário mensal,
próximo plantão, plantão atual, plantões posteriores, contabilidade da
competência corrente (seção 8).

## 6. Consulta "quem está de plantão" — visão operacional

Prioridade de design: resposta **rápida**, sem navegação profunda. Exemplo
conceitual do resultado esperado:

```
Plantão de Segurança — COSI

EM PLANTÃO AGORA
Ana Costa

Início:  15/08 19:00
Término: 16/08 19:00

Contato corporativo: <número>
Contato alternativo: <número>

Próximo: Bruno Lima, 16/08 19:00
```

Capacidades a prever (não implementar):

- busca por grupo de plantão;
- busca por nome;
- indicação clara de "ativo agora";
- próximo plantonista, horário de início/fim, duração;
- ação para ligar (deep-link `tel:`) e ação para copiar contato/dados.

## 7. Participar vs. consultar

Dois conceitos formalmente separados — a arquitetura não deve misturá-los
em uma única flag:

- **Participar do plantão** — estar na lista de plantonistas de um grupo,
  entra em rotação, aparece em "Meus plantões".
- **Ter permissão para consultar o plantão** — poder ver quem está de
  plantão, contatos e próximo plantonista, **sem** necessariamente
  participar. Um analista SOC pode consultar o Plantão de Segurança sem
  nunca ter feito um plantão de segurança na vida.

Isso espelha a separação que `docs/spec/ADMINISTRACAO_E_HIERARQUIA.md` já
faz entre escopo de gestão (`equipesPermitidas`/`unidadesPermitidas`) e
pertencimento (`equipeId`) — mesmo princípio, aplicado a um domínio novo:
pertencimento a um grupo de plantão não é a mesma coisa que autorização
para consultá-lo.

## 8. Regras de cobertura são configuráveis por grupo

Não hardcodar no domínio global algo como "segunda = X, sexta = Y". O
Plantão COSI analisado tem, por exemplo, uma janela diferente em dias úteis
(após o expediente) e janelas distintas em fins de semana — mas isso é
**configuração daquele grupo**, não regra universal de todos os plantões.
Outros grupos podem ter:

- quantidade diferente de participantes;
- horários diferentes;
- dias diferentes;
- rotação diferente.

A arquitetura de regras de cobertura deve viver no Grupo de Plantão (seção
3), nunca em uma tabela de constantes compartilhada entre todos os grupos.

## 9. Importação da planilha de plantão (estratégia futura)

O parser 6x1 atual (`parsePlanilhaEscala`,
`packages/contrato/src/parser.ts:501`) **não é alterado nesta fase nem é
alterado pelo desenho abaixo** — ele continua resolvendo exclusivamente a
planilha de jornada normal.

Desenho futuro (PLANTÃO-1):

```
detectarTipoPlanilha()
    │
    ├── estrutura de escala 6x1  → parser atual (parsePlanilhaEscala)
    │
    └── estrutura de plantão     → parsePlanilhaPlantao() (novo, isolado)
```

A detecção deve ser por **estrutura/conteúdo** da planilha (nomes e forma
das colunas, ex.: presença de `Plantonista Segurança` / `Data Inicio` /
`Data Fim` na planilha real analisada) — nunca por nome de arquivo. Nome de
arquivo é metadado do usuário, não contrato de dados.

### Planilhas reais não são versionadas

A planilha analisada nesta fase contém dados reais e **não foi e não deve
ser adicionada ao Git**. A fixture de teste para PLANTÃO-1 será
**sanitizada** (nomes fictícios) e deverá reproduzir, como casos de borda:

- estrutura real da planilha;
- períodos de plantão;
- virada de dia (plantão que atravessa meia-noite);
- virada de competência (plantão que começa num mês e termina no
  seguinte);
- plantões de 12h;
- plantões de 24h;
- contabilidade (para o cruzamento descrito na seção 10).

## 10. Nome do XLS → login real

Regra de negócio obrigatória, análoga (mas não idêntica) à conciliação já
existente para a escala 6x1 (`lib/conciliacaoUsuarios.ts`,
`aliasesPlanilha?` em `Usuario`, `lib/modelos.ts:100`):

```
XLS (nome completo, ex. "Ana Costa")
    ↓
extrair nomes únicos
    ↓
tentar conciliar com usuários existentes
    ↓
gestor confirma o login
    ↓
todas as ocorrências daquele nome no período passam a apontar para o login confirmado
```

- nome completo **nunca** é tratado como identidade técnica permanente;
- se não houver usuário correspondente: cadastrar um novo ou selecionar um
  existente;
- em caso de ambiguidade (dois usuários com nome parecido, por exemplo):
  **exigir seleção manual** — nunca aproximação silenciosa, nunca login
  inventado;
- **nenhuma escala de plantão é publicada enquanto existir plantonista sem
  login conciliado.**

Este fluxo é conceitualmente equivalente ao processo de conciliação já
descrito para a escala 6x1, mas precisa de sua própria tela/etapa em
PLANTÃO-2, porque a estrutura de origem (planilha de plantão) é diferente.

## 11. Contabilidade de plantões

Visão prevista no Dashboard (PLANTÃO-2/3):

```
Plantonista | Qtd. plantões | Horas de cobertura | Plantões 12h | Plantões 24h | Outras durações | Total
```

A fonte de verdade é sempre **calculada a partir dos intervalos de
plantão** (início/fim de cada turno), nunca o valor pronto do XLS. Quando o
XLS também trouxer sua própria seção de contabilidade:

- valores iguais → "conferência OK";
- valores diferentes → aviso de divergência (nunca falha silenciosa, nunca
  sobrescrita automática de um valor pelo outro).

## 12. Nova escala — visão futura (Plantão e 6x1)

Fluxo futuro do Dashboard, `+ Nova escala`:

```
escolher grupo/equipe → escolher competência → escolher método
```

Métodos: `Continuar escala anterior`, `Criar em branco`, `Importar XLS`.

Para escala 6x1: preservar ciclo, participantes e posição/sequência;
sempre criar **rascunho**, gestor revisa antes de publicar — mesmo
princípio de `rascunhosTurnosMes` que já existe hoje.

Para Plantão: carregar participantes, regras de cobertura e
sequência/rotação do grupo; calcular o próximo período; sempre criar
**rascunho**; gestor revisa antes de publicar.

**Gerador determinístico, reproduzível e testável — nunca IA para decidir
escala operacional.** Mesma filosofia que já rege a escala 6x1 hoje: a
publicação é sempre uma ação humana explícita sobre um rascunho gerado por
uma função pura.

## 13. Experiência do plantonista (participante)

Ao acessar o App, o sistema reconhece as participações do usuário pelo
login (não pelo nome, não por heurística). Ele pode visualizar: plantão
atual, próximo plantão, "Meus plantões", calendário mensal, quem vem
depois, quantidade de plantões e horas de cobertura da competência.

**Jornada normal e Plantão coexistem** — participar de um grupo de
plantão nunca substitui a Agenda normal do usuário. Um colaborador SOC com
escala 6x1 e participação em `PLANTAO_COSI` continua vendo sua Agenda 6x1
normalmente, com Plantão como informação adicional, não concorrente.

## 14. Experiência de quem só consulta

Um analista SOC/NOC que não participa do Plantão de Segurança pode, ainda
assim, consultá-lo (seção 7), conforme as regras de visibilidade do grupo:
quem está de plantão, início, término, contatos e próximo plantonista.

## 15. Sequência de fases prevista

```
PLANTÃO-0  Arquitetura + correção visual                         (concluída)
PLANTÃO-1  Detector de planilha + parser isolado + fixture sanitizada  (concluída — ver seção 18)
PLANTÃO-2  Preview no Dashboard + conciliação nome/login          (concluída — ver seção 19)
PLANTÃO-3  Persistência + Rules + grupos + participantes + contatos
PLANTÃO-4  Central de Plantões no App
PLANTÃO-5  Nova escala + gerador determinístico
PLANTÃO-6  Overrides/substituições/trocas
PLANTÃO-7  Homologação staging completa
```

Nenhuma das fases 3–7 é iniciada nesta fase.

## 16. O que esta fase explicitamente NÃO faz

- Não altera Firestore Rules.
- Não cria novas coleções.
- Não altera schema persistido.
- Não altera autenticação (Microsoft/Firebase Auth).
- Não altera push worker nem notificações FCM.
- Não altera o fluxo de publicação de escala 6x1.
- Não altera `parsePlanilhaEscala` nem o catálogo SOC.
- Não implementa nenhum código funcional de Plantão.
- Não adiciona item à navegação inferior.
- Não versiona a planilha real de plantão analisada.

## 17. Riscos e decisões abertas

- Schema Firestore de Grupo de Plantão/Turno de Plantão/Contato é decisão
  de PLANTÃO-3, deliberadamente não fechada aqui, para não engessar o
  desenho antes de ver a fixture sanitizada (PLANTÃO-1) e o preview real de
  conciliação (PLANTÃO-2).
- A relação grupo de plantão ↔ equipe organizacional (N:N vs. 1:N) é uma
  decisão em aberto — o desenho aqui não assume 1:N para não fechar a porta
  a um grupo de plantão que reúne pessoas de mais de uma equipe.
- Visibilidade/autorização de consulta (seção 7) por grupo é um esboço
  conceitual; o mecanismo de concessão (por equipe, por perfil, por lista
  explícita) é decisão de PLANTÃO-3, alinhada ao padrão de
  `equipesPermitidas`/`unidadesPermitidas` já existente.
- Timezone por grupo é mencionado como campo necessário (planilha real
  mistura virada de dia), mas a estratégia de armazenamento/exibição em
  Firestore (UTC + timezone vs. horário local gravado direto) continua
  decisão de PLANTÃO-3. O que a PLANTÃO-1 já resolveu foi só o nível do
  parser: `MomentoPlantao` representa data+hora como par civil
  (`{data, hora}`, sem timezone anexado — ver seção 18) para não sofrer
  conversão silenciosa pelo timezone da máquina que roda o código; isso não
  fecha a decisão de timezone do Grupo de Plantão em si.
- `interpretarMomento` (ver seção 18) lê a data/hora a partir do texto de
  exibição da célula (`.w`, quando presente, senão `.v`). Uma célula de
  data/hora genuinamente numérica (serial do Excel) sem nenhuma formatação
  associada (`.w` ausente) não é decodificada automaticamente hoje — vira
  erro de linha em vez de adivinhar silenciosamente. A fixture sanitizada
  desta fase usa texto (mesma forma da planilha real analisada); esse
  caminho numérico "puro" fica como risco aceito e documentado, a revisar
  se aparecer um caso real assim em PLANTÃO-2.
- A busca de usuário do preview de Plantão (PLANTÃO-2, seção 19) reaproveita
  o `<select>` já usado pela conciliação 6x1 (todas as opções na lista) em
  vez de um combobox de busca ao vivo — decisão deliberada de reaproveitar
  Design System existente em vez de construir um widget novo; em uma
  equipe muito grande, isso pode ficar menos ágil do que uma busca
  filtrada de verdade. Risco aceito nesta fase, mesma limitação que a
  conciliação 6x1 já tem hoje.
- O preview de Plantão não reage automaticamente a novos usuários
  cadastrados enquanto a planilha já está carregada (sem um recadastro
  explícito da lista de sugestões) — a lista de usuários pesquisável é
  sempre a atual (o coordenador consegue vincular a um usuário recém
  cadastrado normalmente), mas a `sugestao` automática calculada no
  momento da importação não se atualiza sozinha. Aceitável nesta fase
  (seção 19 do pedido original não exige isso); revisar se o fluxo real de
  "cadastrar durante a conciliação" mostrar necessidade.

## 18. PLANTÃO-1 — o que foi implementado

Tudo em `packages/contrato` (pacote puro, sem React/Firebase/DOM). Nenhuma
persistência, nenhuma tela, nenhum login/conciliação (ver seção 10, ainda
não implementada) — só leitura determinística de planilha.

### Arquivos novos

- `src/tiposPlantao.ts` — contrato puro (tipos abaixo).
- `src/celulas.ts` — helpers genéricos de leitura de célula XLSX
  (`obterCelula`/`valorCelula`/`textoCelula`/`ehVazio`), equivalentes aos
  helpers privados já existentes em `parser.ts`, duplicados deliberadamente
  para não tocar no parser 6x1 (ver seção 9).
- `src/detectorPlanilha.ts` — `detectarTipoPlanilha()` (roteador) e
  `localizarTabelaPlantao()` (localização da tabela de Plantão,
  compartilhada com o parser).
- `src/parserPlantao.ts` — `parsePlanilhaPlantao()` e os helpers puros
  `calcularDuracaoBrutaDosIntervalos`, `detectarSobreposicoesPlantao`,
  `identificarLacunasPlantao`, `listarPlantonistasUnicos`.
- `src/normalizar.ts` ganhou uma função nova, `normalizarChaveEstrutural`
  (remove tudo que não é letra/dígito, além de acento/caixa) — usada para
  comparar cabeçalhos por assinatura estrutural. As duas funções já
  existentes (`normalizarTexto`/`normalizarCelula`) não foram alteradas.
- `test/dadosPlantao.ts`, `test/detectorPlanilha.test.ts`,
  `test/parserPlantao.test.ts`.
- `test/fixtures/Plantao-COSI-SANITIZADO.xls` — fixture sanitizada (ver
  seção 18.3).

`src/parser.ts` (parser 6x1) **não foi alterado** — zero linhas no diff.
`src/index.ts` só ganhou 4 linhas de export novas, nenhum export existente
foi removido ou renomeado.

### 18.1 Detecção de tipo de planilha

`detectarTipoPlanilha(arquivo: ArrayBuffer): ResultadoDeteccaoPlanilha` —
um único parâmetro, nunca nome de arquivo. Retorna:

```ts
type TipoPlanilha = 'ESCALA_6X1' | 'PLANTAO' | 'DESCONHECIDA';
interface ResultadoDeteccaoPlanilha {
  tipo: TipoPlanilha;
  abaEncontrada?: string;
  abasCandidatas?: string[];   // presente só quando há ambiguidade
  motivo?: string;
}
```

Assinatura estrutural usada (nenhuma depende de nome de aba/arquivo):

- **ESCALA_6X1**: existe uma aba cujo nome normaliza para "ESCALISTAS"
  (sem acento/caixa) e que contém, em algum lugar, a célula "DIA/MÊS" —
  sinal mínimo, não uma reimplementação da busca completa de
  `parsePlanilhaEscala`.
- **PLANTAO**: em qualquer aba, três colunas contíguas na mesma linha onde
  a primeira normaliza com prefixo "PLANTONISTA" (aceita "Plantonista
  Segurança"/"Plantonista Redes"/etc.), a segunda normaliza exatamente
  para "DATAINICIO" e a terceira para "DATAFIM". Uma célula solta com a
  palavra "Plantão" nunca basta — as três colunas precisam bater juntas.
- **Ambiguidade nunca é resolvida silenciosamente**: mais de uma aba com a
  assinatura de Plantão retorna `DESCONHECIDA` com `abasCandidatas`
  preenchido; uma planilha com sinais de **ambos** os domínios ao mesmo
  tempo (6x1 e Plantão) também retorna `DESCONHECIDA` explícita, nunca
  escolhe um lado.

### 18.2 Parser de Plantão

`parsePlanilhaPlantao(arquivo: ArrayBuffer): ResultadoParsePlantao`.
Contrato:

```ts
interface MomentoPlantao { data: string; hora: string; }  // civil, sem timezone

interface AtribuicaoPlantaoBruta {
  plantonistaNomeOriginal: string;
  inicio: MomentoPlantao;
  fim: MomentoPlantao;
  duracaoMinutos: number;
  linhaOrigem: number;
  abaOrigem: string;
}

interface ResultadoParsePlantao {
  ok: boolean;
  abaOrigem: string;
  atribuicoes: AtribuicaoPlantaoBruta[];
  contabilidadeInformada: ContabilidadePlantaoInformada[];
  totaisInformados: TotaisInformadosPlantao | null;
  totalBrutoCalculado: { quantidade: number; minutos: number };
  sobreposicoes: SobreposicaoPlantao[];
  erros: ErroImportacaoPlantao[];
  avisos: string[];
}
```

Pontos de desenho relevantes:

- **Nunca cria login.** `AtribuicaoPlantaoBruta` só tem
  `plantonistaNomeOriginal` — nenhum campo de identidade técnica. Testado
  explicitamente (o objeto retornado só tem essas 6 chaves).
- **Fim de tabela vs. linha com erro**: a leitura só para quando a linha
  inteira está vazia (nome **e** início **e** fim em branco). Uma linha
  com nome vazio mas datas preenchidas gera um erro de linha e a leitura
  continua — não trata "faltou o nome aqui" como "acabou a tabela".
- **Nunca aborta no primeiro erro**: cada linha inválida vira uma entrada
  em `erros` e a leitura segue para a próxima linha, na mesma filosofia de
  `parsePlanilhaEscala` (`ok=false` não impede preview parcial).
- **Sobreposição, nunca correção**: `detectarSobreposicoesPlantao` marca
  pares de atribuições cujos intervalos se cruzam no tempo —
  `MESMO_PLANTONISTA` (inclusive o caso degenerado de duas linhas
  idênticas) ou `PLANTONISTAS_DIFERENTES`. Nunca escolhe vencedor, nunca
  remove linha.
- **Lacuna ≠ violação**: `identificarLacunasPlantao` só expõe o intervalo
  cronológico entre o fim de uma atribuição e o início da seguinte — a
  lacuna real de 12h (07:00 → 19:00) que aparece na fixture **não** é
  tratada como falta de cobertura; isso é regra do futuro Grupo de
  Plantão (PLANTÃO-3).
- **Contabilidade bruta ≠ contabilidade de negócio**: a soma das durações
  lidas vive em `totalBrutoCalculado`, nunca chamada de "contabilidade
  mensal" — só `calcularDuracaoBrutaDosIntervalos()`. O valor informado
  pelo XLS (`totaisInformados`) é lido à parte, da seção opcional
  "Contabilidade dos Plantões no mês" (colunas "Plantonistas"/"N°
  Plantões"/"N° Horas"; uma linha cuja coluna de nome normaliza para
  "TOTAL" vira o agregado, não um plantonista). Quando os dois valores
  divergem, um aviso é adicionado — **nenhum dos dois números é alterado**
  para forçar coincidência.
- **Zero plantões é um dado, não um motivo de exclusão**: uma linha de
  contabilidade com quantidade/horas zeradas (ex.: "Daniela Rocha" na
  fixture) é preservada normalmente.

### 18.3 Datas, horas e timezone (decisão desta fase)

A fonte real usa texto como `"Segunda-feira, 17/08/2026 - 19:00"`. Decisão:

- A **fonte de verdade é sempre o padrão numérico** `DD/MM/AAAA - HH:mm`,
  extraído por regex do texto de exibição da célula
  (`textoCelula`: prefere `.w`, cai para `.v` stringificado).
- O nome do dia da semana (texto antes da primeira vírgula) **nunca altera
  a data** — é só validado opcionalmente contra o dia da semana real
  calculado a partir da data numérica; uma divergência vira `aviso`, nunca
  corrige nem rejeita a linha.
- **Sem conversão de timezone em lugar nenhum.** `MomentoPlantao` é um par
  civil `{ data: 'YYYY-MM-DD', hora: 'HH:mm' }`, nunca uma string
  combinada com timezone nem um `Date` com fuso — mesmo princípio de
  `ReferenciaTemporal` (`jornada.ts`), que já existe no projeto
  exatamente para não sofrer conversão silenciosa pelo timezone da
  máquina que roda o código. Interna e apenas para calcular a diferença
  em minutos entre dois momentos, `Date.UTC(...)` é usado como relógio
  aritmético neutro (mesma técnica de `dataUtc()`/`minutosHora()` em
  `jornada.ts`) — isso **não é uma afirmação de fuso horário real** sobre
  o dado; é só aritmética de data civil.
- **Decisão adiada, documentada**: qual timezone real um Grupo de Plantão
  declara (e como isso é persistido) é decisão de PLANTÃO-3. Esta fase só
  garante que o parser não perde nem corrompe a informação por conversão
  prematura.

### 18.4 Fixture sanitizada — o que ela prova

`test/fixtures/Plantao-COSI-SANITIZADO.xls` (aba `PlantaoCOSI`, mas o
parser não depende desse nome — testado explicitamente renomeando a aba).
Nomes fictícios (`Ana Costa`, `Bruno Lima`, `Carlos Nunes`, `Daniela
Rocha`) — busca automatizada confirmou **zero ocorrências** dos quatro
nomes reais da planilha original em qualquer arquivo novo/versionado desta
fase.

Reproduz, com os mesmos números da planilha real:

- **32 atribuições brutas**, incluindo a virada de mês (última semana de
  julho → agosto) e a virada de competência dentro do próprio período.
- Primeira linha: sábado 00:00 → domingo 19:00 = **43h** (não virou 24h).
- Última linha: terça 19:00 → quarta 00:00 = **5h** (não virou 12h).
- Padrões normais: plantões de **12h** (após expediente) e **24h** (fim de
  semana), calculados pelo intervalo, nunca por uma regra fixa tipo
  "sexta = 24h".
- Contabilidade informada: **31 plantões, 468h** (Carlos Nunes 10/156h,
  Ana Costa 10/168h, Daniela Rocha 0/0h, Bruno Lima 11/156h).
- Soma bruta calculada dos 32 intervalos: **504h**.
- **504h ≠ 468h — divergência preservada e testada explicitamente**
  (`parserPlantao.test.ts`, casos 18-21): nenhuma das duas somas é alterada
  para forçar coincidência; o parser gera um aviso de divergência e segue.
  A reconciliação de negócio (por que a contabilidade informada dá um
  número diferente da soma literal dos intervalos) não foi — e não devia
  ser — inventada nesta fase.

### 18.5 Testes

37 testes novos (8 em `detectorPlanilha.test.ts`, 29 em
`parserPlantao.test.ts`), cobrindo os 8 cenários de detecção e os 24+
cenários de parser pedidos para esta fase, incluindo os casos de erro
(nome vazio, início/fim inválido, fim antes do início), sobreposição
(mesmo plantonista e plantonistas diferentes), aba renomeada, planilha
desconhecida, e a confirmação de que `parsePlanilhaEscala` continua
passando sobre a fixture 6x1 original.

## 19. PLANTÃO-2 — preview no Dashboard + conciliação nome→login

Fatia real implementada: importar um XLS agora detecta a estrutura e
mostra um preview coerente para Plantão, com conciliação obrigatória de
cada nome para um login real — tudo em memória, sem persistir nada.

### 19.1 Roteamento no Dashboard

`lib/importadorPlanilha.ts` (novo, puro): `processarArquivoImportado(arquivo,
opcoes6x1)` chama `detectarTipoPlanilha()` e delega para
`parsePlanilhaEscala()` (ESCALA_6X1) ou `parsePlanilhaPlantao()` (PLANTAO),
ou retorna `{ tipo: 'DESCONHECIDA', motivo }`. Não reimplementa detecção
nem parsing — só decide qual dos dois parsers do pacote `contrato` chamar.

`apps/dashboard/src/DashboardApp.tsx`: `receberArquivo()` (ponto único de
entrada — o mesmo dropzone/input já existente, nenhum segundo botão de
importação) passa a chamar `processarArquivoImportado` antes de decidir o
fluxo:

- **ESCALA_6X1**: `interpretar()` continua exatamente como antes —
  mesma função, mesmo corpo, nenhuma linha alterada dentro dela. O
  preview 6x1 (resumo/erros/avisos/conciliação/grade) continua idêntico.
- **PLANTAO**: `interpretarPlantao()` (novo) popula o preview em memória —
  nunca chama `salvarRascunho`/`publicarEscalas`/nenhuma escrita.
- **DESCONHECIDA**: mensagem explícita, nenhum dos dois parsers é
  tentado "na sorte".

Os blocos visuais do preview 6x1 (resumo/erros/avisos/conciliação 6x1/
grade) ficam escondidos enquanto `tipoArquivoDetectado === 'PLANTAO'` —
achado durante a implementação: o Dashboard já tem um `useEffect` que
recarrega automaticamente a escala de demonstração sempre que `resultado`
fica `null` (modo demo). Como o fluxo de Plantão zera `resultado`
propositalmente (não é uma escala 6x1), esse efeito recarregava a
demonstração por baixo do preview de Plantão; a correção foi um guard
único (`tipoArquivoDetectado !== 'PLANTAO'`) ao redor de todo o bloco
6x1 antigo, sem tocar no próprio efeito nem no fluxo 6x1.

### 19.2 Camada de conciliação (`lib/conciliacaoPlantoes.ts`, novo, puro)

Sem SDK do Firestore, sem React. Núcleo:

```ts
type StatusVinculoPlantao = 'PENDENTE' | 'VINCULADO' | 'USUARIO_NAO_ENCONTRADO' | 'CONFLITO';

interface VinculoPlantao {
  participanteNomeOriginal: string;
  login: string | null;       // nunca UID
  status: StatusVinculoPlantao;
  sugestao: { login: string; nome: string } | null;
}
```

- `consolidarParticipantesPlantao(resultado)` — união dos nomes das
  atribuições brutas com a contabilidade informada (um participante só na
  contabilidade, como "0 plantões", continua identificado).
- `iniciarVinculosPlantao(participantes, usuarios)` — estado inicial:
  **nunca** com `login` preenchido. Uma correspondência única de nome
  normalizado vira `sugestao` (não aplicada); zero correspondências vira
  `USUARIO_NAO_ENCONTRADO` (o coordenador ainda pode escolher manualmente
  qualquer usuário — não é um estado bloqueante, só informativo).
- `confirmarVinculoPlantao(vinculos, nome, usuario)` — único jeito de um
  vínculo ganhar `login`; recebe o `Usuario` inteiro (não uma string), e
  o `login` gravado é sempre `usuario.login`.
- `desfazerVinculoPlantao(vinculos, nome)` — volta ao estado sem login.
- Conflito (dois participantes apontando pro mesmo login) é recalculado a
  cada mudança (`recalcularConflitosPlantao`, interno): ambos os lados
  viram `CONFLITO` até um dos dois ser desfeito.
- `previaPlantaoValidavel(vinculos)` — só `true` quando **todo**
  participante está `VINCULADO`.
- `aplicarVinculosNasAtribuicoes(atribuicoes, vinculos)` — todas as
  atribuições do mesmo plantonista refletem o mesmo vínculo automaticamente
  (o coordenador vincula uma vez, não linha a linha).
- `buscarUsuariosPlantao(usuarios, termo)` — filtro por nome/login sobre a
  mesma lista de usuários já carregada pelo Dashboard (nenhum endpoint novo).

Esta camada é deliberadamente **mais estrita** que
`lib/conciliacaoUsuarios.ts` (a conciliação 6x1): lá, uma correspondência
única de nome/alias já vincula automaticamente. Aqui, nenhuma
correspondência — nem exata — vincula sozinha; o máximo é uma `sugestao`
que o coordenador precisa confirmar clicando.

### 19.3 UI do preview (Dashboard)

Reaproveita o Design System do preview 6x1 — nenhum componente visual
novo, só uma composição nova das classes existentes
(`.panel`/`.status-badge`/`.data-table`+`.table-scroll`/
`.segmented-control`/`.conciliation-table`+`.conciliation-actions`).
Estrutura: card de resumo (Intervalos lidos / Duração bruta dos
intervalos / Plantões informados no relatório / Horas informadas no
relatório, via `formatarMinutos` — mesma convenção de exibição de horas
já usada em todo o Dashboard) + aviso de divergência (quando aplicável) +
`segmented-control` com 4 seções: **Resumo** (erros/avisos do parser),
**Plantões** (32 intervalos em ordem cronológica, com badge "duração
atípica" para o que não é 12h/24h — nunca "incorreto"), **Contabilidade**
(linhas informadas + total, participante de 0 plantões preservado),
**Vínculos** (uma linha por participante único: contexto encontrado na
planilha, busca por nome/login, sugestão clicável, status, ação de
desfazer). Botão **"Validar prévia"** (nunca "Publicar"/"Salvar escala")
fica desabilitado enquanto houver pendência; ao clicar, mostra "Prévia
validada. Nenhum dado de Plantão foi publicado nesta fase." — não chama
nenhuma escrita.

Duas correções de cascade encontradas durante a implementação (mesma
disciplina de `docs/spec/UI_CASCADE_E_HERANCA.md`):

- `.import-summary` tem `grid-template-columns: repeat(3, 1fr)` — o
  resumo de Plantão tem 4 indicadores. Em vez de reescrever a classe
  compartilhada com o preview 6x1, o card de Plantão leva as duas classes
  (`import-summary plantao-resumo-grid`), e só a coluna é redefinida (nos
  mesmos dois breakpoints de `.import-summary`) — border/tipografia
  continuam vindo da classe original.
- `.search-control` (usada no `<label>` de busca de usuário) só recebe
  borda/fundo/padding quando é descendente de `.toolbar`; usá-la solta
  dentro de uma célula de tabela renderizaria sem estilo nenhum. Criada
  `.plantao-busca-linha`, com os mesmos tokens (`--border`/`--surface`),
  própria para o contexto de célula de tabela — `.search-control` em si
  não foi alterada.

### 19.4 Permissão

Nenhum guard novo: o preview de Plantão vive na mesma tela "Importar
escala" já protegida pelo acesso normal ao Dashboard — mesma exposição que
a importação 6x1 sempre teve. Não foi criado nenhum bypass nem checagem
baseada em cargo.

### 19.5 Testes

24 testes novos: `lib/conciliacaoPlantoes.test.ts` (21 — consolidação,
sugestão sem vínculo automático, confirmação usando `usuario.login`,
conflito de login duplicado e sua resolução, bloqueio/liberação de
`previaPlantaoValidavel`, propagação do vínculo a todas as atribuições do
mesmo participante, contagens/durações preservadas) e
`lib/importadorPlanilha.test.ts` (3 — roteamento 6x1/Plantão/desconhecida
usando as fixtures reais). Mais 5 testes de fronteira em
`tests/plantao-preview-boundaries.test.mjs` (registrado em
`test:boundaries`): os módulos puros de Plantão não importam nenhuma
escrita administrativa nem usam catálogo/regras 6x1; `writeRepository.ts`
e `firestore.rules` seguem sem nenhuma menção a Plantão; o Dashboard
roteia pelo importador/conciliação puros.

### 19.6 Confirmações desta fase

- Nenhuma escala de Plantão foi persistida — "Validar prévia" só muda
  estado local.
- `firestore.rules`/`writeRepository.ts` sem nenhuma menção a Plantão.
- `parsePlanilhaEscala`/`CATALOGO_SOC`/`lib/alertasEscala.ts` não são
  usados por nenhum caminho de código de Plantão.
- `login` é sempre a identidade gravada em `VinculoPlantao` — nunca UID.
- Zero PII real: busca automatizada por `Bruno Bueno`/`Caroline Ribeiro
  de Freitas`/`Claudio Rogerio Lis`/`Jean Carlo Machado Ribeiro` confirma
  zero ocorrências em todo arquivo novo/alterado desta fase.

### 19.7 Decisões adiadas para PLANTÃO-3

- Persistir grupos/participantes/contatos de Plantão de verdade.
- Regra de "não pode publicar Plantão com plantonista sem login
  conciliado" — nesta fase não existe "publicar" Plantão, então essa
  regra ainda não tem onde se aplicar; `previaPlantaoValidavel` é o
  equivalente em memória.
- Reconciliar 504h vs. 468h — continua só documentado como divergência,
  nunca resolvido automaticamente.
