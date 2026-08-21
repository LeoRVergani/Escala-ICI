# Especificação — Plantões (arquitetura + parser + preview + modelo persistente, Fases PLANTÃO-0/1/2/3A)

Documento de **planejamento arquitetural**, com fatias reais já
implementadas: PLANTÃO-1 (seção 18) — detecção de tipo de planilha e
parser isolado de Plantão em `packages/contrato`; PLANTÃO-2 (seção 19) —
preview do Dashboard e conciliação obrigatória nome→login, em memória, sem
nenhuma persistência; PLANTÃO-3A (seção 20) — modelo persistente,
Firestore Rules e repositórios de leitura/escrita, ainda sem nenhuma
integração de UI e sem publicação. É a fonte de verdade para as fases
seguintes (PLANTÃO-3B em diante), formalizando decisões de domínio antes
de cada fatia de código funcional.

Segue a mesma convenção dos demais documentos de `docs/spec/`: aponta para
evidência real do código quando descreve o que já existe hoje (para não
confundir "estado atual" com "proposta futura"), e é explícito quando está
descrevendo algo que **ainda não existe**.

**Antes de ler este documento, ler
[`docs/spec/HIERARQUIA_ORGANIZACIONAL.md`](HIERARQUIA_ORGANIZACIONAL.md)**
(Fase HIERARQUIA-1) — é a fonte normativa de como Unidade Organizacional,
Equipe, Usuário, perfis e escopos administrativos se relacionam, e de
regras permanentes que este documento pressupõe sem repetir por inteiro:
"pertencimento não é autorização" (§ 8) e "visibilidade de Plantão é
data-driven via `equipesConsulta`, nunca inferida pela hierarquia" (§ 9,
que detalha e formaliza exatamente a decisão já tomada aqui na seção 20.3).
Qualquer sigla (COSI/SOC/NOC/CODB/GEDSI) usada abaixo é **exemplo
conhecido nesta data**, nunca a árvore inteira do ICI nem uma regra de
autorização compilada — ver a mesma ressalva, em detalhe, no documento de
hierarquia.

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

**Atualização ESCOPO-OPERACIONAL-MATRIZ-1:** `equipesConsulta` permite
apenas consulta/monitoramento de Plantão. Administração operacional de
Plantão vem da matriz explícita `escoposOperacionais` (`tipo: "PLANTAO"`).
Se a spec antiga ou o código legado der administração por equipe/unidade do
Grupo, essa regra é **Regra transitória / fallback de compatibilidade** até
existir matriz para o alvo. `GrupoPlantao ativo:false` não entra em seletor
operacional nem no Wizard; aparece somente na Administração com badge
Inativo.

`GrupoPlantao ativo:false` também não pode contaminar o destino operacional
da equipe responsável. Se um grupo antigo/inativo aponta para `EQ_SOC`, a
tabela de Equipes não deve rotular `EQ_SOC` como Plantão por causa desse
documento; o grupo fica visível apenas em Administração → Grupos de Plantão.

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
PLANTÃO-0   Arquitetura + correção visual                                (concluída)
PLANTÃO-1   Detector de planilha + parser isolado + fixture sanitizada   (concluída — ver seção 18)
PLANTÃO-2   Preview no Dashboard + conciliação nome/login                (concluída — ver seção 19)
PLANTÃO-3A  Modelo persistente + Firestore Rules + repositórios          (concluída — ver seção 20)
PLANTÃO-3B  Integração da UI (Dashboard chama os repositórios de verdade)
PLANTÃO-3C  Publicação de Plantão (RASCUNHO -> PUBLICADA)
PLANTÃO-4   Central de Plantões no App
PLANTÃO-5   Nova escala + gerador determinístico
PLANTÃO-6   Overrides/substituições/trocas
PLANTÃO-7   Homologação staging completa
```

Nenhuma das fases 3B–7 é iniciada nesta fase.

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

## 20. PLANTÃO-3A — modelo persistente + Firestore Rules + repositórios

Fatia real implementada: a fundação persistente do domínio — schema,
validação pura, Firestore Rules e repositórios de leitura/escrita. **Sem
nenhuma integração de UI** (Dashboard/App inalterados) **e sem
publicação** (RASCUNHO → PUBLICADA continua bloqueado nas Rules).

### 20.1 Auditoria — padrões reaproveitados, nada reinventado

Antes de desenhar o schema, a fase auditou como o projeto já resolve os
mesmos problemas para a escala 6x1, e reaproveitou cada um deles:

- **Identidade**: `loginDoAuth()` deriva o login do e-mail autenticado;
  `usuarios/{login}` é a fonte de verdade. Plantão nunca usa UID.
- **Autorização**: `souGestor()`/`podeOperarNaEquipe()`/`souAdminSistema()`
  (`firestore.rules`) — reaproveitados tal como são, nunca duplicados.
  Achado real durante a implementação: `podeOperarNaEquipe()` sozinha só
  checa PERTENCIMENTO à equipe, não perfil — toda regra de escrita 6x1
  (`turnosMes`/`rascunhosTurnosMes`) sempre combina `souGestor() &&
  podeOperarNaEquipe(...)`. Uma primeira versão de
  `podeGerenciarGrupoPlantao()` esqueceu o `souGestor()` e deixava
  qualquer analista da equipe responsável editar o Grupo — pego pelo
  teste "participante do grupo não administra nada" no emulador, corrigido
  antes do commit (ver seção 20.9).
- **IDs determinísticos**: mesma técnica de `idDocumento()`
  (`packages/contrato/src/documentos.ts`) — concatenação validada
  (sem `/`, sem vazio) em vez de UUID aleatório.
- **RASCUNHO/PUBLICADA como coleções separadas**: `turnosMes` (sempre
  `PUBLICADA`, imposto pela Rule) e `rascunhosTurnosMes` (sempre
  `RASCUNHO`) já são duas coleções distintas, nunca uma única filtrada por
  `status` — Plantão espelha exatamente essa separação (seção 20.4).
- **Sem `undefined` no Firestore**: `removerUndefined()`
  (`lib/firebase/sanitizar.ts`) reaproveitado tal como é.
- **Timestamps**: todo o projeto usa string ISO 8601 (`new
  Date().toISOString()`), nunca `Timestamp` nativo do Firestore
  (`PublicacaoEscala.publicadoEm`, `EventoEscala.publicadoEm`, etc.) —
  Plantão segue a mesma convenção para `criadoEm`/`atualizadoEm`/
  `inicio`/`fim`.
- **Auditoria administrativa**: `auditoriaAdmin`/`registrarAuditoriaSeSimulando`
  não foram estendidos nesta fase — não há nenhuma escrita administrativa
  de Plantão acontecendo de verdade ainda (PLANTÃO-3B fará a integração;
  a auditoria será conectada nesse momento, reaproveitando o padrão
  existente, não um sistema novo).

### 20.2 Por que dois domínios continuam separados no schema

Nenhum campo de Plantão foi adicionado a `usuarios`/`turnosMes`. Participar
de um grupo de Plantão é uma relação N:N (subcoleção `participantes` por
grupo, ver 20.4) — nunca um campo escalar como `usuario.tipoEscala`.

### 20.3 Grupo de Plantão — `gruposPlantao/{grupoId}`

```ts
interface GrupoPlantao {
  grupoId: string;
  nome: string;
  descricao?: string;
  equipeResponsavelId: string;
  equipesConsulta: string[];   // sempre não vazio, sempre inclui equipeResponsavelId
  timezone: string;           // nome IANA, ex. "America/Sao_Paulo" — validado, nunca hardcoded como única opção
  ativo: boolean;
  schemaVersion: number;
  criadoPorLogin: string;
  criadoEm: string;
  atualizadoEm: string;
}
```

Decisão deliberada: `equipesConsulta` é **sempre concreto** (nunca um
campo opcional com fallback calculado em tempo de leitura, diferente de
`equipesPermitidas`/`unidadesPermitidas` em `usuarios`). Essas duas
existem com fallback porque `usuarios` tem cadastros ANTIGOS que precisam
continuar funcionando sem migração — Plantão é domínio novo, sem nenhum
documento legado, então `equipesConsultaEfetivas(equipeResponsavelId,
lista)` (`packages/contrato`) já resolve o valor final ANTES de qualquer
escrita, garantindo por construção que `equipeResponsavelId` está sempre
incluído. Isso também simplifica a Rule e a query "grupos que posso
consultar" (`array-contains` direto, sem se preocupar com ausência do
campo).

`equipeResponsavelId` é imutável após a criação (seção 20.6) — reatribuir
o grupo a outra equipe é decisão adiada.

#### 20.3-A `unidadeResponsavelId`/`caminhoUnidadeResponsavel` (Fase ESCOPO-GESTOR-UNIDADE-1)

Dois campos novos, **opcionais e retrocompatíveis**:

```ts
interface GrupoPlantao {
  // ...campos de 20.3, inalterados...
  unidadeResponsavelId?: string;       // Equipe.unidadeId da equipe responsável, copiado na criação/edição
  caminhoUnidadeResponsavel?: string[]; // Equipe.caminhoUnidade da equipe responsável, idem
}
```

Denormalizados para autorizar `GESTOR_UNIDADE` sem exigir `get()` na
`Equipe` a cada avaliação de Rule (mesmo padrão de `destinatarioEquipeId`
em `lembretesAtribuidos`). Diferente de `equipeResponsavelId` (imutável),
estes dois campos são **mutáveis** — se a equipe responsável migrar de
unidade depois, alguém com poder de gestor sobre o Grupo precisa
atualizá-los manualmente; não há recálculo automático. Detalhe completo
em `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` § 5.

**Fase PROVISIONAMENTO-GRUPO-PLANTAO-1**: `firestore.rules`
`gruposPlantao.update` passou a checar `podeGerenciarGrupoPlantao()` tanto
sobre o estado atual quanto sobre o estado novo do documento — antes,
`unidadeResponsavelId` podia migrar livremente para fora do escopo do
gestor que fez a edição (mesma classe de gap corrigida para `equipes` na
Fase ESCOPO-GESTOR-UNIDADE-1, agora fechada aqui também). A derivação
desses dois campos a partir da `Equipe` responsável NUNCA é feita à mão
pelo usuário nem duplicada em dois lugares — `lib/gruposPlantaoProvisionamento.ts`
(`construirGrupoPlantaoOficial()`/`derivarUnidadeResponsavelDoGrupoPlantao()`)
é a única fonte, usada tanto por `ModalGrupoPlantao` (Administração) quanto
por `criarGrupoWizard()` (Wizard) — ver
`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` § 9.

### 20.4 Por que RASCUNHO e PUBLICADA são coleções separadas

Mesmo padrão de `rascunhosTurnosMes`/`turnosMes`: nunca um único campo
`status` filtrando a mesma coleção. `rascunhosCompetenciasPlantao` só
existe enquanto rascunho — a Rule de leitura exige
`podeGerenciarGrupoPlantao()` (nunca visível a quem só consulta).
`competenciasPlantao` (o lado PUBLICADA) existe só para a **leitura**
futura (App, PLANTÃO-4) não exigir uma migração de Rules quando a
publicação chegar — a **escrita está bloqueada com `if false`** nesta
fase inteira, de propósito (seção 20.7).

### 20.5 Participante — `gruposPlantao/{grupoId}/participantes/{login}`

```ts
interface ParticipantePlantao {
  grupoId: string;
  login: string;              // ID do documento — determinístico, nunca UID/nome/e-mail
  ativo: boolean;
  ordem?: number;              // posição para futura rotação (PLANTÃO-5)
  contatos: ContatoPlantonista[];  // 0 a 3
  schemaVersion: number;
  criadoPorLogin: string;
  criadoEm: string;
  atualizadoEm: string;
}

interface ContatoPlantonista {
  rotulo: string;   // texto livre validado — não um enum fechado
  numero: string;
  ativo: boolean;
}
```

`login` como ID do documento garante unicidade por participante sem
precisar de query extra. A Rule de `create` exige
`exists(usuarios/{login})` — nunca inventa identidade; o login precisa
corresponder a um usuário cadastrado de verdade.

Contatos: até 3, validados em dois níveis independentes —
`validarContatosPlantonista()` (client, `packages/contrato`, mensagem de
erro legível) e `contatosPlantonistaValidos()` (Rules, defesa real —
`firestore.rules` valida cada um dos até 3 elementos individualmente,
já que a linguagem de Rules não itera listas de tamanho variável).
`normalizarContatosPlantonista()` remove espaços extras antes de gravar.
Nenhum contato é obrigatório (0 contatos é um estado válido).

### 20.6 Competência — `rascunhosCompetenciasPlantao/{grupoId_competencia}`

```ts
interface CompetenciaPlantao {
  id: string;                 // idCompetenciaPlantao(grupoId, competencia)
  grupoId: string;
  competencia: string;        // "2026-08"
  periodoInicio: string;
  periodoFim: string;
  status: 'RASCUNHO' | 'PUBLICADA';
  revisao: number;             // fixo em 0 nesta fase — só ganha sentido em PLANTÃO-3C
  origem: 'IMPORTADO' | 'MANUAL' | 'GERADO';
  totaisInformadosOrigem: { totalPlantoesInformado: number; totalMinutosInformado: number } | null;
  totalBruto: { quantidade: number; minutos: number };
  schemaVersion: number;
  criadoPorLogin: string;
  criadoEm: string;
  atualizadoEm: string;
}
```

`totaisInformadosOrigem`/`totalBruto` preservam a divergência real da
planilha (504h brutas vs. 468h informadas, PLANTÃO-1) — nenhum dos dois é
recalculado no outro (seção 20.10).

### Atribuição — subcoleção `.../atribuicoes/{atribuicaoId}`

```ts
interface AtribuicaoPlantaoPersistida {
  atribuicaoId: string;       // idAtribuicaoPlantao(indice) -> "0001", "0002", ...
  grupoId: string;
  competenciaId: string;
  plantonistaLogin: string;
  inicio: string;              // instante ISO 8601 UTC
  fim: string;
  duracaoMinutos: number;      // derivado, VALIDADO contra fim-início — nunca fonte da verdade
  papel: 'PRIMARIO' | 'SECUNDARIO';
  origem: 'IMPORTADO' | 'MANUAL' | 'GERADO';
  revisao: number;             // fixo em 0 nesta fase
  schemaVersion: number;
  criadoEm: string;
  atualizadoEm: string;
}
```

Cada intervalo é o próprio documento — não um mapa gigante dentro da
competência (diferente de `Dia`/`dias` da escala 6x1). Decisão pensando no
futuro: um override pontual (PLANTÃO-6, seção "BASE/OVERRIDE/EFETIVA") vai
poder mirar uma atribuição específica por ID sem reescrever a competência
inteira. `atribuicaoId` é sequencial e determinístico (`idAtribuicaoPlantao`,
`0001`/`0002`/...) — reimportar a mesma planilha na mesma ordem sobrescreve
os mesmos IDs, em vez de duplicar.

`duracaoMinutos` nunca é fonte de verdade: `validarAtribuicaoPlantaoPersistida()`
recusa qualquer atribuição cuja duração não bata com `fim - início`
recalculado a partir dos instantes.

### 20.7 Fronteira RASCUNHO/PUBLICADA — bloqueio deliberado

```
match /competenciasPlantao/{id} { allow create, update, delete: if false; }
match /competenciasPlantao/{id}/atribuicoes/{atribuicaoId} { allow create, update, delete: if false; }
```

Nenhum fluxo de publicação existe ainda (PLANTÃO-3C) — abrir a transição
RASCUNHO → PUBLICADA antes de existir esse fluxo seria publicar escala de
Plantão sem revisão nenhuma. Bloquear explicitamente é preferível a criar
uma regra "provisória" permissiva que alguém esqueceria de revisitar. A
leitura de `competenciasPlantao` já está pronta (gated por
`podeConsultarGrupoPlantao()`) para quando PLANTÃO-3C existir.

### 20.8 Timezone — momento civil (parser) + timezone do Grupo → instante

`converterMomentoParaInstanteUtc(momento, timezone)`
(`packages/contrato/src/modeloPlantaoPersistente.ts`) usa
`Intl.DateTimeFormat` com `timeZone` explícito — determinístico,
independente do timezone da máquina que roda o código (nunca `new
Date(string)` puro, que depende do fuso do processo). Duas passadas
resolvem uma eventual virada de horário de verão; não resolve o caso
extremo de horário civil inexistente/ambíguo exatamente no segundo da
transição — aceitável porque os grupos reais de hoje usam
`America/Sao_Paulo`, sem DST desde 2019. Testado explicitamente: 19:00 →
22:00 UTC, 07:00 → 10:00 UTC, 00:00 → 03:00 UTC (mesmo dia), 23:00 → 02:00
UTC do dia seguinte (a conversão muda a data, não só a hora), timezone
inválida rejeitada, determinismo (mesma entrada sempre produz a mesma
saída).

### 20.9 Autorização — resumo por ator

| Ator | Lê Grupo/participante/contato | Administra (Grupo/participante/contato/rascunho) |
| --- | --- | --- |
| Não autenticado | não | não |
| Analista de equipe em `equipesConsulta` | sim | não |
| Analista de equipe fora de `equipesConsulta` | não | não |
| Participante do grupo (analista comum) | sim (se a equipe dele está em `equipesConsulta`) | **não** — participar não implica administrar |
| Gestor da equipe responsável | sim | sim |
| Gestor de outra equipe (mesmo que em `equipesConsulta`) | sim | não |
| ADMIN_SISTEMA | sim, sempre | sim, sempre |

Todas as linhas desta tabela têm um teste correspondente no emulador
(`tests/firebase/firestore.rules.test.ts`, describe `Plantão —
Grupo/Participantes/Contatos/Competência`), incluindo o bug real
encontrado e corrigido (seção 20.1): a primeira versão de
`podeGerenciarGrupoPlantao()` deixava um analista comum da equipe
responsável editar o Grupo.

### 20.10 Contabilidade 504h/468h — continua preservada, não resolvida

`totalBruto` (calculado) e `totaisInformadosOrigem` (vindo do XLS) são
dois campos INDEPENDENTES na mesma `CompetenciaPlantao` — nenhuma função
de escrita converte um no outro. A reconciliação de negócio continua
decisão adiada.

### 20.11 Repositórios

`lib/firebase/plantaoReadRepository.ts`: `obterGrupoPlantao`,
`listarGruposPlantaoPermitidos` (query `array-contains` em
`equipesConsulta` — só possível sem fallback porque o campo é sempre
concreto, seção 20.3), `listarParticipantesPlantao`,
`obterCompetenciaPlantaoRascunho`, `listarAtribuicoesPlantaoRascunho`.
Deliberadamente SEM `localizarPlantaoNoInstante()`/`localizarProximoPlantao()`
— só fariam sentido sobre `competenciasPlantao` (PUBLICADA), que não tem
nenhum dado real ainda (escrita bloqueada); adicionar agora seria API
especulativa sem dado para exercitar.

`lib/firebase/plantaoWriteRepository.ts`: `salvarGrupoPlantao`,
`salvarParticipantePlantao`, `desativarParticipantePlantao` (nunca
exclui — `ativo: false`, mesmo princípio de `equipes`/
`unidadesOrganizacionais`), `salvarCompetenciaPlantaoRascunho` (recusa
qualquer `status` diferente de `RASCUNHO` antes mesmo de chegar à Rule),
`salvarAtribuicoesPlantaoRascunho` (em lotes de até 499, mesmo padrão de
`salvarRascunho()` em `writeRepository.ts`). **Nenhuma função
`publicarPlantao()` existe.** Cada função valida com `validar*()` de
`@escala-ici/contrato` antes de qualquer chamada ao SDK, e usa
`removerUndefined()` antes de `setDoc`/`batch.set`.

**Nenhum destes repositórios é chamado pelo Dashboard/App nesta fase** —
confirmado por teste de fronteira (`tests/plantao-model-boundaries.test.mjs`).
A integração é PLANTÃO-3B.

### 20.12 Índices Firestore

**Nenhum índice novo foi adicionado.** Toda consulta preparada nesta fase
é de campo único: `array-contains` em `equipesConsulta` (índice de campo
único, criado automaticamente pelo Firestore) ou listagem simples de
subcoleção (sem `where` composto). Uma futura consulta "meus grupos de
Plantão" (`collectionGroup('participantes').where('login', '==', X)`,
PLANTÃO-4) vai precisar de um índice de collection group dedicado — não
adicionado agora porque nenhum repositório desta fase efetivamente a
executa (`docs/spec/PLANTOES.md` seção 19 já lista essa consulta como
"suportável pelo schema", não como "implementada").

### 20.13 Testes

67 testes novos: `packages/contrato/test/modeloPlantaoPersistente.test.ts`
(43 — validações de domínio, IDs determinísticos, conversão de
timezone), `lib/firebase/plantaoReadRepository.test.ts` (6),
`lib/firebase/plantaoWriteRepository.test.ts` (14, incluindo a prova de
que nenhum campo `undefined` chega ao mock de `setDoc`), 22 testes novos
no emulador Firestore (`tests/firebase/firestore.rules.test.ts`, describe
dedicado — leitura/escrita para os 7 perfis de ator da tabela 20.9,
payload inválido nos 7 formatos pedidos, competência publicada com
leitura permitida e escrita sempre bloqueada), e 8 testes de fronteira
(`tests/plantao-model-boundaries.test.mjs`).

### 20.14 Decisões adiadas para PLANTÃO-3B/3C

- Integração real: Dashboard passa a chamar
  `plantaoReadRepository`/`plantaoWriteRepository` de verdade (formulário
  de Grupo, tela de participantes/contatos, botão para salvar rascunho de
  competência a partir do preview da PLANTÃO-2).
- Conectar `registrarAuditoriaSeSimulando`/`auditoriaAdmin` às escritas de
  Plantão quando a integração de UI existir.
- `publicarPlantao()` e a transição RASCUNHO → PUBLICADA (PLANTÃO-3C).
- Índice de collection group para "meus grupos de Plantão" (PLANTÃO-4).
- Reatribuir `equipeResponsavelId` de um Grupo já existente para outra
  equipe — hoje imutável, decisão aceita para não abrir uma via de
  transferência de poder administrativo sem revisão dedicada.

> **Atualização — Fase PROVISIONAMENTO-GRUPO-PLANTAO-1**
> (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` § 9): "Integração real"
> item acima foi concluído — `ModalGrupoPlantao`/`criarGrupoWizard()`
> (Dashboard) chamam `plantaoWriteRepository`/`plantaoReadRepository` de
> verdade; nenhuma versão estável pode mais depender de criar
> `gruposPlantao/{grupoId}` manualmente pelo Console do Firestore. Ver essa
> seção para o detalhe completo do provisionamento oficial (Wizard,
> Administração, e seed idempotente).

## 21. PLANTÃO-3B — administração e rascunho no Dashboard

Integra no Dashboard tudo que a PLANTÃO-3A construiu sem UI: uma tela
"Plantões" para criar/editar Grupos, administrar participantes e contatos, e
um botão que transforma a prévia validada da PLANTÃO-2 num rascunho
persistido. **Publicação continua fora do escopo** — nenhuma
`publicarPlantao()`, `competenciasPlantao` continua com escrita bloqueada.

Ver também `docs/spec/HIERARQUIA_ORGANIZACIONAL.md` — a autorização desta
fase (§21.7) é a aplicação direta da regra "pertencimento não é autorização"
documentada lá em § 7.

### 21.1 Nova tela e gate de acesso

`Tela` ganha `'plantoes'`, com ícone próprio (`plantao` → `Radio`, mapeado em
`components/AppFrame.tsx`) e entrada na navegação. O gate para ENXERGAR a
tela — `podeAcessarPlantoes = souGestorDePlantao(usuarioReal)` — é
deliberadamente diferente de `podeAcessarAdministracao`
(`souAdmin || souGestorUnidade`): `souGestorDePlantao()` (nova função em
`lib/sessao.ts`) é `ADMIN_SISTEMA || GESTOR_EQUIPE`, espelhando `souGestor()`
de `firestore.rules` — **GESTOR_UNIDADE nunca vê a tela**, porque não
administra Plantão em nenhuma circunstância (a Rule já garantia isso desde a
PLANTÃO-3A; esta fase só faz o Dashboard refletir a mesma fronteira).

> **Atualização — Fase ESCOPO-GESTOR-UNIDADE-1
> (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`), mudança de regra
> aprovada**: o parágrafo acima descreve o comportamento **até** essa fase.
> A partir dela, `souGestorDePlantao()` também é `true` para
> `GESTOR_UNIDADE` (gate de VISIBILIDADE da tela/seletor superior), e
> `podeGerenciarGrupoPlantao()` ganhou um segundo caminho de autorização:
> `GESTOR_UNIDADE` administra um Grupo cuja `unidadeResponsavelId`
> (campo novo, opcional/retrocompatível, seção 20.3-A) esteja dentro de
> `unidadesPermitidasEfetivas()`. Um coordenador de unidade que administra
> uma equipe dedicada a Plantão (ex.: "Plantão COSI") passa a administrar
> o Grupo correspondente, sem precisar de `equipesPermitidas` explícito.
> Grupo antigo sem o campo continua fora do alcance de qualquer
> `GESTOR_UNIDADE` — só do `GESTOR_EQUIPE`/`ADMIN_SISTEMA` de sempre.

Dentro da tela, cada Grupo listado mostra um badge "Você só consulta este
grupo" e esconde os botões de administração quando
`podeGerenciarGrupoPlantao(usuarioReal, grupo.equipeResponsavelId)` — nova
função-espelho de `lib/sessao.ts`, mesma composição `souGestorDePlantao() &&
(admin || equipeResponsavelId em equipesPermitidasEfetivas())` que a Rule já
usava — é `false`. Isso é só UX: a Rule continua sendo a fronteira real (ver
§21.7). Desde a Fase ESCOPO-GESTOR-UNIDADE-1, `podeGerenciarGrupoPlantao()`
passou a receber o Grupo inteiro (não só `equipeResponsavelId`), para também
avaliar o caminho de `GESTOR_UNIDADE` descrito acima.

### 21.2 `ModalGrupoPlantao` — criar/editar Grupo

Segue o MESMO padrão estrutural de `ModalUnidadeOrganizacional`/
`ModalEquipe` (classes `modal-backdrop`/`edit-modal admin-modal`/
`admin-form-grid`/`rollback-actions`, `useTeclaEsc`, estado
`form`/`erro`/`salvando`).

**Decisão de design deliberada** sobre "escolher a equipe responsável
reaproveitando a árvore existente": o Dashboard já tem DOIS padrões
prontos em `lib/organizacao.ts` — (a) `ArvoreUnidadesOrganizacionais`, uma
árvore `<ul>/<li>` recursiva só de leitura, e (b) um `<select>` plano
indentado via `achatarArvore(construirArvoreUnidades(...))`, usado tanto
por `ModalUnidadeOrganizacional` (unidade pai) quanto por `ModalEquipe`
(unidade da equipe). Como `equipeResponsavelId` é uma **equipe**, não uma
unidade — e equipes já não são hierárquicas entre si, só a unidade acima
delas é — não existe (nem existia antes) um "seletor de equipe em árvore"
para reaproveitar; o padrão real e único já usado para "escolher uma equipe"
em toda a Administração (`filtroEquipeUsuarioAdmin`, `equipeExportar`) é um
`<select>` plano sobre a lista de equipes, com o caminho organizacional só
como rótulo (`trechoFinalCaminho()`). `ModalGrupoPlantao` segue esse mesmo
padrão: `<select>` de equipes, rótulo `"{nome} — {trechoFinalCaminho(...)}"`.
Construir uma árvore-seletora nova e exclusiva para Plantão teria sido
exatamente a "segunda implementação independente da árvore" que a fase
proíbe — a decisão certa foi reaproveitar o padrão já estabelecido, não
inventar um mais sofisticado que o resto do produto não tem.

`equipesConsulta` é um multi-select de checkboxes (`.checkbox-inline`,
mesmo padrão já usado por "Unidades permitidas"/"Equipes permitidas" no
formulário de usuário) sobre a mesma lista de equipes. A equipe responsável
aparece sempre marcada e **desabilitada** — nunca outra equipe vem
pré-marcada — porque a Rule exige `equipeResponsavelId in equipesConsulta`
em toda escrita (`equipesConsultaEfetivas()` do contrato resolve isso antes
de chamar `onSalvar`, então mesmo se o checkbox desabilitado fosse burlado
no DOM, o valor final salvo sempre inclui a responsável).

### 21.3 Participantes e contatos

Dentro de cada card de Grupo, "Ver participantes" carrega
`listarParticipantesPlantao(grupoId)` sob demanda (lazy, só quando expandido
— evita N leituras ao abrir a tela com muitos grupos). Adicionar um
participante busca por nome/login (`buscarUsuariosPlantao()`, já existente
desde a PLANTÃO-2) sobre `todosUsuariosAdmin` (ADMIN_SISTEMA) ou `usuarios`
(GESTOR_EQUIPE — o mesmo conjunto já escopado pela Rule de leitura de
`usuarios`, nunca uma lista mais ampla que a Rule permitiria ler). **Nunca
inventa login**: só usuários já retornados por essas listas aparecem como
resultado de busca, e a Rule (`exists()`) recusa qualquer login que não
corresponda a um documento real de `usuarios`.

"Desativar participante" sempre chama `desativarParticipantePlantao()`
(`ativo: false`) atrás de uma confirmação de texto (`ModalConfirmarComTexto`,
digitar o login) — nunca exclusão física, mesmo princípio de
`equipes`/`unidadesOrganizacionais`.

`ModalContatosParticipante` edita de 0 a `MAXIMO_CONTATOS_PLANTONISTA` (3)
contatos por linha (rótulo/número/ativo), reaproveitando
`validarContatosPlantonista()`/`normalizarContatosPlantonista()` do
contrato — a mesma validação que `firestore.rules` já aplicava, nunca uma
cópia divergente client-side.

### 21.4 Salvar rascunho a partir da prévia validada

Depois de "Validar prévia" (PLANTÃO-2), aparece um painel "Salvar como
rascunho": escolher um Grupo já administrado pelo usuário (ou criar um novo,
via §21.2), confirmar/ajustar competência (AAAA-MM) e período — sugeridos
automaticamente por `sugerirCompetenciaPlantao()` (novo,
`lib/montagemRascunhoPlantao.ts`, escolhe o mês com mais atribuições e
calcula o último dia real do mês, inclusive fevereiro bissexto) — e clicar
"Salvar rascunho".

`lib/montagemRascunhoPlantao.ts` é o módulo puro que faz a ponte entre a
prévia em memória e o modelo persistente:

- `montarParticipantesPlantaoParaSalvar()` — deduplica logins repetidos,
  ignora vínculos sem login, e **preserva `contatos`/`ordem` de quem já era
  participante** (reimportar a mesma planilha nunca apaga um contato já
  cadastrado).
- `montarCompetenciaPlantaoRascunho()` / `montarAtribuicoesPlantaoRascunho()`
  — montam `CompetenciaPlantao`/`AtribuicaoPlantaoPersistida[]`,
  preservando `criadoEm`/`criadoPorLogin` de uma competência já existente
  (regravação idempotente) e recusando montar qualquer atribuição sem
  `loginVinculado` (só deve ser chamado depois de `previaPlantaoValidavel()`).
- `montarGrupoPlantaoParaSalvar()` — mesma lógica de preservar
  `criadoEm`/`criadoPorLogin` para o Grupo.

O handler (`salvarRascunhoPlantaoAcao`) então chama, nesta ordem,
`salvarParticipantePlantao()` (um por login), `salvarCompetenciaPlantaoRascunho()`
e `salvarAtribuicoesPlantaoRascunho()` — todas do
`plantaoWriteRepository.ts` já existente desde a PLANTÃO-3A, sem nenhuma
função nova de escrita.

### 21.5 Idempotência

Todos os IDs envolvidos são determinísticos (`grupoId` escolhido pelo
gestor, `competenciaId = grupoId_competencia`, `atribuicaoId` sequencial,
`participante` por login) — reimportar a MESMA planilha para o MESMO
Grupo/competência sobrescreve os mesmos documentos via `setDoc`, nunca
duplica. Verificado tanto em unidade (`lib/montagemRascunhoPlantao.test.ts`)
quanto no emulador (`tests/firebase/firestore.rules.test.ts`, "regravar o
mesmo Grupo/participante/atribuição...").

### 21.6 Novo repositório de leitura: `listarTodosGruposPlantao()`

`listarGruposPlantaoPermitidos(equipeId)` (PLANTÃO-3A) só retorna grupos
onde a equipe informada está em `equipesConsulta` — correto para
GESTOR_EQUIPE, mas insuficiente para ADMIN_SISTEMA enxergar TODOS os
grupos (inclusive os que a própria equipe do admin não consulta).
`listarTodosGruposPlantao()` (nova, `plantaoReadRepository.ts`) faz a
mesma query sem `where` — só ADMIN_SISTEMA consegue de fato, porque a Rule
de leitura de `gruposPlantao` dispensa o filtro de `equipesConsulta` só
para `souAdminSistema()`; qualquer outro perfil que chamar isso recebe
`permission-denied` do próprio Firestore.

### 21.7 Autorização client-side — `lib/sessao.ts`

Duas funções novas, espelhando 1:1 as Rules (mesma disciplina de
`podeGerenciarUnidade`/`podeGerenciarEquipe`):

```ts
export function souGestorDePlantao(usuario: Usuario): boolean {
  return ehAdminSistema(usuario) || perfilEfetivo(usuario) === 'GESTOR_EQUIPE';
}

export function podeGerenciarGrupoPlantao(usuario: Usuario, equipeResponsavelId: string): boolean {
  if (!souGestorDePlantao(usuario)) return false;
  return ehAdminSistema(usuario) || equipesPermitidasEfetivas(usuario).includes(equipeResponsavelId);
}
```

Nunca usa `podeOperarNaEquipe()`/pertencimento sozinho — a mesma composição
"é gestor E opera a equipe" que o bug real da PLANTÃO-3A (§20.1) provou ser
obrigatória. É só a fronteira de UX (mostrar/esconder botão); a Rule
continua sendo a fronteira de segurança real.

### 21.8 Achado desta fase: `list` sem `where` em `.../atribuicoes` é frágil no emulador para não-admin

Ao escrever um teste de Rules exercitando exatamente a mesma chamada de
`listarAtribuicoesPlantaoRascunho()` (`getDocs` sem `where` na subcoleção
`rascunhosCompetenciasPlantao/{id}/atribuicoes`), o emulador acusou
`"Property grupoId is undefined on object"` quando autenticado como
GESTOR_EQUIPE — a mesma chamada **funciona normalmente para ADMIN_SISTEMA**.
A causa aparente: a Rule desta subcoleção depende de `resource.data.grupoId`
(não de uma variável de path, diferente de `participantes`, cuja Rule usa
`grupoId` do próprio caminho) — algo que o motor de regras do emulador não
avalia de forma confiável para `list` fora do atalho de admin.
`listarAtribuicoesPlantaoRascunho()` não é chamada por nenhum código desta
fase (o Dashboard nunca lista atribuições fora do fluxo de salvar), então
isso não bloqueia a PLANTÃO-3B — mas é uma limitação pré-existente
(PLANTÃO-3A) que vale investigar/registrar antes de qualquer fase futura
passar a chamar essa função para um gestor comum. `firestore.rules` fica
congelado nesta fase (fora de escopo mudar), então o achado só foi
documentado, não corrigido.

### 21.9 Testes

30 testes novos de unidade (20 em `lib/montagemRascunhoPlantao.test.ts`, 8
em `lib/sessao.test.ts` para `souGestorDePlantao`/`podeGerenciarGrupoPlantao`,
2 em `lib/firebase/plantaoReadRepository.test.ts` para
`listarTodosGruposPlantao`), 12 testes novos de fronteira
(`tests/plantao-dashboard-administracao-boundaries.test.mjs`, mais a
atualização de 2 testes cujo enunciado a própria fase inverteu de
propósito — ver nota abaixo) e 9 testes novos no emulador Firestore
(`tests/firebase/firestore.rules.test.ts`, describe "Fase PLANTÃO-3B —
administração via Dashboard").

**Dois testes de fronteira herdados da PLANTÃO-3A/2 tiveram o enunciado
invertido, de propósito**: "o Dashboard (PLANTÃO-2) ainda não chama os
repositories de Plantão" e "o Dashboard não grava Plantão" descreviam a
ausência da integração — exatamente o que esta fase constrói. Os dois
foram reescritos para afirmar o oposto (a integração existe) mantendo a
única invariante permanente: nenhuma função de publicação aparece. Nenhum
teste foi removido, nenhuma contagem caiu.

### 21.10 O que esta fase explicitamente NÃO faz

- Nenhum fluxo de publicação (`publicarPlantao()`, transição RASCUNHO →
  PUBLICADA) — continua PLANTÃO-3C.
- Nenhuma "Central de Plantões" (App do colaborador) — `apps/app/` com
  diff zero nesta fase.
- Nenhuma notificação push de Plantão.
- Nenhuma adaptação de Trocas para Plantão.
- Nenhum gerador de escala de Plantão.
- Nenhuma auto-criação de próxima competência.
- Reatribuir `equipeResponsavelId` de um Grupo existente continua
  impossível (campo imutável na Rule, decisão da PLANTÃO-3A mantida).

## 22. UI-ORG-1 — árvore organizacional moderna + `OrganizationTeamPicker`

Fase de UI/UX pura (sem mudança de schema/Rules/repositórios/payload):
substitui a árvore de Unidades da Administração (cards grandes, uma linha
por card) por `components/organizacao/OrganizationTree.tsx` — linhas
compactas, expand/collapse, busca, navegação por teclado, `role="tree"` —
e introduz `OrganizationTeamPicker` (modo `single`/`multiple`) como o
seletor de equipe reutilizável, usado por `ModalGrupoPlantao` (PLANTÃO-3B)
no lugar do `<select>` plano original.

Fundação única em `lib/organizacao.ts`: `construirArvoreOrganizacional()`
monta uma árvore mista Unidades+Equipes reaproveitando
`construirArvoreUnidades()` (nunca uma segunda travessia de `parentId`) e
enxertando Equipes como folhas da unidade correspondente;
`buscarNaArvoreOrganizacional()`, `nosVisiveisNaArvoreOrganizacional()` e
`raizesComEquipesSemUnidade()` completam a mesma fundação. Tanto a
Administração (`OrganizationTree` com todo nó — Unidade e Equipe —
navegável, só Unidade editável ali) quanto o picker (`ehNoSelecionavel = (no)
=> no.tipo === 'equipe'`, só Equipe é marcável) consomem exatamente as
mesmas funções — nenhuma árvore paralela.

`GrupoPlantao.equipeResponsavelId`/`equipesConsulta` continuam exatamente
os mesmos campos persistidos (nenhuma mudança de payload/Rules) — o picker
só troca COMO o gestor escolhe o valor, nunca O QUE é salvo. A equipe
responsável continua sempre incluída e travada (não removível) em
`equipesConsulta`, resolvido por `equipesConsultaEfetivas()` do contrato
antes de qualquer `onSalvar`, como já era desde a PLANTÃO-3B.

Ver `CHECKPOINT-FASE-UI-ORG-1-ARVORE-PICKER.md` para o detalhamento
completo (decisões de design, acessibilidade, testes, limitação conhecida
de cobertura de testes de componente).

## 23. PLANTÃO-3B.1 — conferência contábil da fonte (três camadas de verdade)

A contabilidade de uma planilha de Plantão tem **três camadas de verdade
independentes**, e as três podem divergir entre si na mesma planilha real
— nenhuma delas é "a correta":

1. **Bruto** (`TotalBrutoPlantao`, `calcularDuracaoBrutaDosIntervalos()`)
   — soma literal dos INTERVALOS lidos (`atribuicoes[]`). Fixture real:
   **32 intervalos, 504h**.
2. **Contabilidade por plantonista, somada** (`SomaContabilidadeInformada`,
   `somarContabilidadeInformada()`, nova nesta fase) — soma das LINHAS
   INDIVIDUAIS da seção "Contabilidade dos Plantões no mês"
   (`contabilidadeInformada[]`). CALCULADA pelo sistema a partir das
   linhas, nunca lida de uma célula de total. Fixture real: **31
   plantões, 480h**.
3. **Total declarado na fonte** (`TotaisInformadosPlantao`,
   já existente desde a PLANTÃO-1) — a linha de total que a própria
   planilha declara (`totaisInformados`). Fixture real: **31 plantões,
   468h**. `null` quando a planilha não tem essa linha — nunca `0`
   inventado.

`ConferenciaContabilPlantao`/`conferirContabilidadePlantao()`
(`packages/contrato/src/parserPlantao.ts`, novos) juntam as três camadas e
comparam duas a duas, produzindo `DivergenciaPlantao[]` — cada uma só
aparece quando as DUAS pontas da comparação existem na fonte (nunca gera
divergência falsa comparando contra zero por ausência):

| Divergência | Compara | Fixture real |
| --- | --- | --- |
| `INTERVALOS_VS_CONTABILIDADE_QUANTIDADE` | bruto.quantidade vs. soma individual.quantidade | 32 vs. 31 — **divergente** |
| `INTERVALOS_VS_CONTABILIDADE_MINUTOS` | bruto.minutos vs. soma individual.minutos | 504h vs. 480h — **divergente** |
| `CONTABILIDADE_VS_DECLARADO_QUANTIDADE` | soma individual.quantidade vs. declarado.totalPlantoesInformado | 31 vs. 31 — **sem divergência** |
| `CONTABILIDADE_VS_DECLARADO_MINUTOS` | soma individual.minutos vs. declarado.totalMinutosInformado | 480h vs. 468h — **divergente** |

Nenhuma reconciliação automática existe nem existirá nesta fase: `504 →
480`, `480 → 468` ou `504 → 468` nunca são aplicados; nenhuma linha é
descartada para a soma "fechar"; nenhuma duração é alterada. A UI (ver
§ 23.2) só **relata**, nunca "corrige".

### 23.1 Causa raiz corrigida: `totaisInformados` chegava `null` mesmo com total declarado

Bug real observado no Dashboard staging: os cards de "Plantões informados
no relatório"/"Horas informadas no relatório" mostravam `—` mesmo com a
planilha real tendo uma linha de total. Causa raiz: `extrairContabilidadeInformada()`
identificava a linha de total por **igualdade exata** —
`normalizarChaveEstrutural(nome) === 'TOTAL'`. A fixture sanitizada usa
literalmente "Total" (por isso os testes desta fixture nunca detectaram o
problema), mas qualquer rótulo real diferente — "Total Geral", "Total:",
"TOTAL DO MÊS" — falha nessa comparação; a linha então virava um
plantonista FALSO dentro de `contabilidadeInformada`, e `totaisInformados`
nunca era preenchido. Corrigido para `ehLinhaTotalPlantao()` (`startsWith`
em vez de igualdade exata) — mesmo princípio de detecção estrutural, não
por texto absoluto frágil, já usado para `MARCADOR_CONTABILIDADE`
("Contabilidade..."). Testado com "Total Geral"/"Total:"/"TOTAL DO MÊS"/
"Total" (compatibilidade).

### 23.2 Dashboard — conferência clara, nunca ambígua

O card de resumo (`plantao-resumo-panel`) mostra as três camadas lado a
lado, com nomenclatura neutra ("Contabilidade por plantonista", "Total
declarado na planilha" — nunca "correto"/"real"), e "Não informada/o na
fonte" (nunca `0`) quando uma camada não existe na planilha. O painel de
divergências (`conferencia.divergencias`) mostra uma "Divergências
encontradas na fonte" com uma linha por comparação divergente, ou
"Conferência consistente" quando todas as comparáveis coincidem — nunca
esconde os números, nunca culpa o usuário, nunca afirma que a planilha
está errada. A aba "Contabilidade" ganhou um rodapé com "Soma das linhas"
(nova) separado de "Total declarado na planilha" (já existente) — os dois
nunca no mesmo campo.

**"Validar prévia" continua não bloqueada por divergência contábil** —
só por vínculo pendente (`previaPlantaoValidavel()`, inalterado). Se um
bloqueio antes de publicação vier a ser necessário, é decisão da
PLANTÃO-3C — não desta fase, que é só importação/contrato/preview/
diagnóstico.

### 23.3 O que esta fase explicitamente NÃO faz

- Nenhuma publicação (`publicarPlantao()` continua inexistente).
- Nenhuma mudança de Firestore Rules/índices.
- Nenhuma mudança no schema persistente (`GrupoPlantao`/
  `CompetenciaPlantao`/`AtribuicaoPlantaoPersistida` inalterados — as três
  camadas de verdade são conceito de IMPORTAÇÃO/preview, não de
  persistência).
- Nenhuma mudança na árvore organizacional (`OrganizationTree`/
  `OrganizationTeamPicker`/`lib/organizacao.ts`, fechadas na UI-ORG-1A).
- Nenhuma regra de negócio inventada para transformar 504h/480h/468h num
  único valor.

Ver `CHECKPOINT-FASE-PLANTAO-3B1-CONFERENCIA-CONTABIL.md` para o
detalhamento completo.

## 24. ESCALAS-UX-1A — Editor visual de Plantão importado

Até esta fase, a prévia de Plantão (PLANTÃO-2/3B/3B.1) era uma tela
"só-leitura + tabela": importar mostrava os dados, e a única ação
possível era vincular participantes e salvar como rascunho — nenhuma
correção de horário/data era possível sem editar a planilha original e
reimportar. Esta fase corrige isso com um **princípio permanente**, que
vale para qualquer fluxo de escala futuro (Plantão ou 6x1):

> **Importação nunca é um destino. Importação é apenas uma forma de
> preencher o Editor de Escala.**

O fluxo principal de qualquer escala passa a ser:

> **IMPORTAR → CONFERIR → EDITAR → SALVAR RASCUNHO → PUBLICAR FUTURAMENTE**

Ou seja: **importação é entrada do Editor, não uma tela final.** Depois
de `parsePlanilhaPlantao()`, o resultado nunca é consumido diretamente
pela UI de edição — ele primeiro vira uma **working copy** editável
(`AtribuicaoPlantaoEditavel[]`, `lib/editorPlantao.ts`), e é essa cópia,
não o resultado bruto do parser, que a Lista, o Calendário e o payload de
"Salvar rascunho" consultam a partir daí.

Ver `docs/spec/EDITOR_ESCALAS.md` para a definição completa da working
copy, do rascunho, da conferência e do princípio de simplicidade do
Editor — este documento (PLANTÕES.md) permanece o dono do domínio de
Plantão em si (parser/conciliação/modelo persistente); `EDITOR_ESCALAS.md`
é o dono do conceito de Editor compartilhado entre Plantão e 6x1.

### 24.1 A working copy nunca substitui a "Conferência da fonte"

`resultadoPlantao` (o retorno bruto do parser) continua **congelado**
depois da importação — nunca mutado por uma edição no calendário/lista.
Ele é a única fonte da "Conferência da fonte" (as três camadas de
verdade da PLANTÃO-3B.1: 32 intervalos/504h bruto, 31/480h soma
individual, 31/468h declarado — ver § 23), com uma nota explícita na UI:
"Estes valores representam o arquivo importado original."

A working copy tem sua **própria conferência**, separada — "Conferência
da escala editada" (`conferirEscalaAtualPlantao()`): quantidade atual de
atribuições/pessoas, horas atuais, lacunas, sobreposições e durações
atípicas, recalculados a cada edição. As duas conferências nunca são
comparadas automaticamente uma com a outra — cada uma só relata o que é
seu.

### 24.2 Competência 26→25 — janela real, nunca mês calendário

A competência operacional do Escala ICI vai do dia 26 de um mês até o
dia 25 do mês seguinte (rótulo `AAAA-MM` igual ao mês em que termina —
mesmo princípio de `COMPETENCIA_ATUAL`/`competenciaOperacional()`, agora
também usado por `sugerirCompetenciaPlantao()`). Um dia fora dessa janela
("dia de contexto" — o 25 antes do início, o 26 depois do fim) nunca é
usado para redefinir a competência nem para "renormalizar" nenhuma
duração — inclusive as bordas reais da fixture (43h/5h) continuam
mostradas como estão, com aviso, nunca corrigidas.

### 24.3 O calendário

`components/plantao/PlantaoCalendario.tsx` é a visão PRIMÁRIA da prévia
de Plantão (aba "Calendário", padrão logo após importar). Grade própria
(`.plantao-grid`, terceira família paralela a `.calendar-grid`/
`.lembretes-grid` — mesmo raciocínio de colisão de CSS documentado para
Lembretes) cobrindo a janela inteira da competência (26→25) mais os dias
necessários para completar semanas — esses dias extras são reais (dias
de contexto), nunca células em branco, porque a fixture real já tem
atribuições que começam/terminam exatamente neles.

Cada célula mostra o número do dia e um cartão por atribuição (nome
curto + horário, "24h" para plantão de 24h, "⚠ Nh" para duração
atípica) — identidade visual por plantonista é um índice de cor estável
(hash do nome, nunca posição no array, nunca escolhido pelo usuário).
Clicar num cartão abre o modal de edição; um botão "+ Adicionar" sempre
presente em cada célula abre o mesmo modal em modo de criação, sem
nenhum horário padrão pré-preenchido (nunca hardcoda 19:00→07:00 ou
qualquer outro horário específico de COSI).

### 24.4 O modal de edição

`components/plantao/ModalEditarAtribuicaoPlantao.tsx` — um único modal
para criar OU editar uma atribuição da working copy. Campos:
Plantonista (select sobre os participantes já conhecidos desta
competência — nunca texto livre, para nunca introduzir um nome que a
conciliação de vínculos desconhece), Data/Hora iniciais, Data/Hora
finais, duração calculada ao vivo. Bloqueia só os quatro erros
objetivos: plantonista vazio, data inicial vazia, data final vazia, fim
&le; início. Duração atípica é só um aviso não bloqueante. "Excluir"
(só em modo edição) e "Salvar" nunca tocam o Firestore diretamente — só
atualizam a working copy em memória; a persistência real continua
exclusivamente pelo fluxo "Salvar rascunho" já existente.

### 24.5 Vínculos pendentes nunca bloqueiam a visualização

Um participante sem login vinculado nunca impede ver ou editar o
calendário — só impede "Salvar rascunho", com um aviso claro ("N
usuário(s) precisam ser vinculados" + atalho para a aba Vínculos). Como
o Plantonista do modal é sempre um dos participantes já conhecidos
(nunca um nome novo digitado), a lista de vínculos pendentes nunca
precisa ser recalculada por causa de uma edição no calendário — só por
uma nova importação ou por confirmar/desfazer um vínculo (comportamento
inalterado desde a PLANTÃO-2).

### 24.6 O que esta fase explicitamente NÃO faz

- Nenhuma publicação (`publicarPlantao()` continua inexistente); nenhuma
  mudança de Firestore Rules/índices; a coleção `competenciasPlantao`
  (publicada) continua sem nenhuma escrita a partir do Dashboard.
- Nenhum arrastar-e-soltar (drag-and-drop) — fase futura.
- Nenhum "+ Nova escala vazia" nem "Copiar período anterior" — adiados
  para ESCALAS-UX-1B.
- Nenhum gerador/distribuição automática/rotação/autocomplete de
  plantonista.
- Nenhuma mudança funcional na escala 6x1 (`ScheduleGrid`, parser 6x1 —
  diff zero).
- Nenhuma mudança em `OrganizationTree`/`OrganizationTeamPicker`/
  `lib/organizacao.ts` (fechadas na UI-ORG-1A).
- Nenhuma mudança no modelo de timezone (`grupo.timezone`,
  `converterMomentoParaInstanteUtc()` inalterados) — o calendário exibe
  sempre em horário civil (igual à Lista, já existente), só a conversão
  para o instante UTC persistido no "Salvar rascunho" usa o timezone do
  grupo, como já acontecia antes desta fase.
- `@testing-library/react`/jsdom continuam não adicionados (decisão da
  UI-ORG-1A, mantida).

### 24.7 Auditoria de NOC (documentada, não corrigida)

Por instrução explícita desta fase, uma equipe/unidade real encontrada
faltando ou quebrada durante a auditoria deve ser **documentada, nunca
corrigida silenciosamente**. Achado: `EQ_NOC` (NOC) existe apenas em
`scripts/seed-organizacao.mjs` (dado de seed, nunca confirmado como
efetivamente executado num ambiente real) e em fixtures de teste
(`tests/firebase/firestore.rules.test.ts`, `lib/organizacao.test.ts`,
`lib/sessao.test.ts`, `lib/importUsers.test.ts`,
`packages/contrato/test/modeloPlantaoPersistente.test.ts`,
`lib/firebase/shared.test.ts`) — nenhum código de produção (`lib/organizacao.ts`,
`components/organizacao/*`, `DashboardApp.tsx`) trata NOC como um caso
especial, e não há confirmação de que a equipe `EQ_NOC` exista de fato
no Firestore de nenhum ambiente. Nada foi alterado a respeito nesta
fase — permanece como estava antes, só registrado aqui para uma decisão
futura.

Ver `CHECKPOINT-FASE-ESCALAS-UX-1A-EDITOR-PLANTAO.md` para o
detalhamento completo desta fase.

## 25. ESCALAS-UX-1B — "+ Nova escala" e Plantão criado vazio

A ESCALAS-UX-1A resolveu "importação não é um destino" — o coordenador
edita a working copy depois de importar. Esta fase resolve a outra
metade do fluxo descrito em § 12 ("Nova escala — visão futura"): criar
uma escala de Plantão **sem** nenhuma planilha, usando o MESMO Editor.

Fluxo implementado:

```
+ Nova escala (botão na tela "Escalas")
       |
       v
 O que você quer criar?
   Escala de jornada  |  Plantão
       |                    |
       v                    v
 (rotaciona para      Novo Plantão:
  "Importar" —          Grupo de Plantão (só os que o usuário administra)
  fluxo 6x1 já          Competência (AAAA-MM, janela 26→25)
  existente, sem        Como começar?
  código novo)            Criar escala vazia  |  Importar planilha
                              |                     |
                              v                     v
                    working copy = []      (mesmo roteamento p/ "Importar")
                              |
                              v
                     MESMO Editor de Plantão
                     (calendário/lista/contabilidade/vínculos)
```

Nenhuma segunda tela de "montagem manual" foi criada — "Criar escala
vazia" só popula `atribuicoesEditaveisPlantao` com `[]` e abre a MESMA
`PreviewPlantao`/`PlantaoCalendario`/`ModalEditarAtribuicaoPlantao` já
usadas pelo caminho importado, com `origem: 'MANUAL'`.

### 25.1 Origem MANUAL — contrato já suportava, só não era usado

`OrigemPlantao` (`packages/contrato/src/modeloPlantaoPersistente.ts`)
já incluía `'MANUAL'` desde a PLANTÃO-3A — nunca foi um valor novo. O
que faltava era `montarCompetenciaPlantaoRascunho()`/
`montarAtribuicoesPlantaoRascunho()` (`lib/montagemRascunhoPlantao.ts`)
pararem de hardcodar `origem: 'IMPORTADO'` e passarem a receber a
origem como parâmetro — corrigido nesta fase, com os 11 pontos de
chamada existentes (todos do caminho `IMPORTADO`, em testes)
atualizados para passar `origem: 'IMPORTADO'` explicitamente.

### 25.2 Participantes e vínculos de uma escala MANUAL

Sem planilha, não existe nome de plantonista a conciliar — os
candidatos são os participantes **ativos** do Grupo escolhido,
identificados por `login` desde o início. Duas funções novas em
`lib/conciliacaoPlantoes.ts` resolvem isso sem introduzir nenhum
conceito paralelo:

- `consolidarParticipantesGrupoPlantao(participantesAtivos, usuarios, atribuicoes)`
  — equivalente a `consolidarParticipantesPlantao()`, mas a partir do
  Grupo, não da planilha; um participante sem nenhuma atribuição ainda
  aparece como "0 plantões · 0h" (mesmo princípio da PLANTÃO-2/
  ESCALAS-UX-1A — nunca descartado por falta de atribuição).
- `vinculosDeParticipantesGrupoPlantao(participantesAtivos, usuarios)`
  — todo participante ativo do Grupo nasce `VINCULADO` (nunca
  `PENDENTE`), porque não há nome de planilha nenhum a resolver.
  `previaPlantaoValidavel()` (inalterada) já retorna `true` para essa
  lista sem nenhuma mudança de lógica.

O campo "Plantonista" do modal de edição, para QUALQUER origem, é
sempre um `<select>` sobre os participantes já conhecidos da
competência (decisão já tomada na ESCALAS-UX-1A) — nunca texto livre.
Isso significa que uma escala MANUAL nunca pode introduzir um nome que
a conciliação de vínculos desconhece: adicionar uma pessoa nova ao
Plantão continua sendo responsabilidade da tela "Plantões" →
"Gerenciar participantes" (PLANTÃO-3B, inalterada), nunca do Editor.

### 25.3 Duplicata: nunca sobrescrever silenciosamente

Antes de criar a working copy vazia, `criarPlantaoEmBrancoAcao()`
verifica `obterCompetenciaPlantaoRascunho(grupoId, competencia)` (já
existente desde a PLANTÃO-3B, usada também para a idempotência do
"Salvar rascunho"). Se já existir um rascunho para o mesmo
Grupo+competência, a criação é bloqueada e a UI mostra "Já existe um
rascunho para este Plantão e competência" com a ação "Abrir rascunho
existente" — que leva à tela "Plantões" com o grupo expandido (ver
limitação § 25.5). Nunca cria um segundo documento, nunca sobrescreve.

### 25.4 "Escala de jornada" — só roteamento, nenhum código 6x1 novo

A opção "Escala de jornada" na primeira etapa de "+ Nova escala"
apenas leva à tela "Importar" (`setTela('importar')`) — o fluxo 6x1 já
existente. Nenhum parser novo, nenhuma mudança na Grade, nenhuma
mudança no modelo 6x1. O mesmo vale para "Importar planilha" dentro da
etapa "Plantão": também roteia para "Importar", reaproveitando o
importador/preview já existentes (`processarArquivoImportado`,
`PreviewPlantao`) — não haveria ganho em replicar o upload dentro do
modal só para eliminar uma navegação extra.

### 25.5 O que esta fase explicitamente NÃO faz

- Nenhuma publicação (`publicarPlantao()` continua inexistente);
  nenhuma mudança de Firestore Rules — `test:firestore-rules` permanece
  em 153/153, diff zero em `firestore.rules`.
- Nenhum histórico de publicação, nenhuma revisão oficial — tudo
  permanece `RASCUNHO`.
- Nenhum gerador determinístico/automático (`origem: 'GERADO'`
  permanece reservado, não implementado).
- Nenhuma regra de cobertura COSI (19→07/24h/12h por dia da semana)
  foi transplantada do dashboard antigo.
- **"Abrir rascunho existente" não reabre o rascunho DENTRO do
  calendário para continuar editando** — leva à tela "Plantões" com o
  grupo expandido (onde o rascunho já é visível). Reidratar a working
  copy a partir de `AtribuicaoPlantaoPersistida[]` exigiria uma
  conversão inversa de instante UTC para horário civil (nenhuma função
  desse tipo existe hoje — `converterMomentoParaInstanteUtc()` só vai
  num sentido) e uma reconciliação cuidadosa de IDs para a idempotência
  do resave continuar valendo. Decisão deliberada de não construir isso
  agora (nenhuma refatoração ampla só para fechar este caso) — registrado
  como próximo passo explícito, não implementado.
- "Copiar escala anterior" (`origem: 'COPIADO'`, mencionada em § 12)
  continua adiada para ESCALAS-UX-1B/1C — só registrada em
  `docs/spec/EDITOR_ESCALAS.md` § 8 como origem futura.
- Nenhuma mudança em `OrganizationTree`/`OrganizationTeamPicker`/
  `lib/organizacao.ts`/`equipes`/`unidadesOrganizacionais`.
- Nenhum hardcode/correção silenciosa de NOC — reconfirmado: `EQ_NOC`
  continua só em seed/fixtures, nenhum código de produção trata NOC
  como caso especial (mesmo achado da ESCALAS-UX-1A § 24.7).
- Nenhuma simplificação do formulário de Grupo de Plantão (timezone/
  ACL/"equipe responsável sempre incluída") — ideias válidas, fora de
  escopo para não misturar configuração rara do Grupo com criação
  mensal de escala.

Ver `CHECKPOINT-FASE-ESCALAS-UX-1B-NOVA-ESCALA-VAZIA.md` para o
detalhamento completo desta fase.

## 26. ESCALAS-UX-1B.1 — reabrir rascunho de Plantão no mesmo Editor

A ESCALAS-UX-1B fechou "criar/importar → editar → salvar", mas registrou
explicitamente (§ 25.5) que "Abrir rascunho existente" ainda não
reidratava o calendário — faltava a conversão inversa de instante UTC
persistido para momento civil. Esta fase fecha esse ciclo:

> **Criar/importar → editar → salvar → fechar → reabrir → continuar
> editando → salvar de novo.**

Sem reimportar XLS, sem recriar a escala, sem perder edições, sem
alterar horários por causa de timezone, sem duplicar atribuições.

### 26.1 A conversão inversa

`converterInstanteUtcParaMomento()` (novo,
`packages/contrato/src/modeloPlantaoPersistente.ts`) é o inverso exato
de `converterMomentoParaInstanteUtc()` (PLANTÃO-3A) — instante UTC
persistido + timezone do Grupo → `MomentoPlantao` civil. Mais simples
que a direção direta: um `Date` já representa um instante inequívoco,
então basta formatá-lo com `Intl.DateTimeFormat({timeZone})` — nenhuma
estimativa em duas passadas é necessária (essa técnica só existe na
direção direta porque ali o offset ainda é desconhecido no início do
cálculo). Determinístico, nunca depende da timezone da máquina que roda
o código; rejeita timezone inválida ou instante malformado, nunca cai
silenciosamente na timezone local. Testado com round-trip completo
(civil → UTC → civil resulta no momento original) para várias
timezones/horas, incluindo as bordas reais de 43h/5h da fixture — nunca
normalizadas.

### 26.2 Reidratação — persistido vira working copy

`reidratarRascunhoPlantao()` (novo, `lib/montagemRascunhoPlantao.ts`)
converte `CompetenciaPlantao` + `AtribuicaoPlantaoPersistida[]` +
`GrupoPlantao` de volta na MESMA working copy do Editor
(`AtribuicaoPlantaoEditavel[]`, `lib/editorPlantao.ts`) — nunca um
segundo tipo, nunca um segundo Editor. Preserva a `origem` exatamente
como persistida (`IMPORTADO` continua `IMPORTADO`, `MANUAL` continua
`MANUAL` — nunca "tudo vira MANUAL por ter sido reaberto"). `idLocal` é
derivado do `atribuicaoId` real (`rehidratado-${atribuicaoId}`, nunca
posicional) — estável entre reaberturas.

**Limitação registrada, não uma omissão silenciosa**: para um rascunho
`IMPORTADO`, a "Conferência da fonte" (32 intervalos/504h bruto, 31/480h
soma individual, 31/468h declarado — PLANTÃO-3B.1) NÃO é reconstruída ao
reabrir. O modelo persistido (`CompetenciaPlantao.totalBruto`/
`.totaisInformadosOrigem`) só guarda dois agregados da competência,
nunca a contabilidade por plantonista declarada linha a linha na
planilha original — esse dado nunca foi persistido (só existe em
`ResultadoParsePlantao.contabilidadeInformada`, output do parser, nunca
gravado no Firestore). Por isso `resultadoPlantao` permanece `null` ao
reabrir, **mesmo para origem `IMPORTADO`** — exatamente como já
acontecia para `MANUAL`. A PLANTÃO-3C poderá decidir se vale persistir
mais evidência da importação antes da publicação; esta fase não
aumentou o schema para isso.

Participante inativo referenciado por uma atribuição persistida nunca
desaparece: `reidratarRascunhoPlantao()` resolve o nome de QUALQUER
participante do Grupo (ativo ou não); só os vínculos (o que autoriza
"Salvar rascunho") e o `<select>` de novas atribuições consideram
participantes ativos.

### 26.3 Limitação de leitura pré-existente (PLANTÃO-3A), corrigida no repository

A Rule de `rascunhosCompetenciasPlantao/{id}` e de
`.../atribuicoes/{atribuicaoId}` depende de `resource.data.grupoId` (um
campo do documento, não uma variável de path) — o Firestore não valida
um `list` sem filtro contra essa regra para ninguém além de
ADMIN_SISTEMA (achado da PLANTÃO-3A § 21.8, confirmado no emulador com
"Property grupoId is undefined on object" para GESTOR_EQUIPE). Como o
coordenador que precisa reabrir um rascunho é quase sempre um
GESTOR_EQUIPE, não um ADMIN_SISTEMA, essa limitação bloqueava
diretamente o fluxo desta fase.

**Corrigido no nível responsável — o repository, nunca a Rule**:
`listarAtribuicoesPlantaoRascunho()` e a nova
`listarCompetenciasPlantaoRascunho()` (`lib/firebase/plantaoReadRepository.ts`)
passaram a incluir `where('grupoId', '==', grupoId)` na consulta. O
`where` não é um filtro de negócio (todo documento já pertence a esse
`grupoId` pelo próprio caminho) — é o que permite ao Firestore validar
o `list` sem precisar avaliar a regra contra a coleção inteira.
Confirmado empiricamente no emulador (`tests/firebase/firestore.rules.test.ts`):
a mesma consulta, com o `where`, passa a funcionar para o GESTOR_EQUIPE
autorizado e continua falhando para um gestor de outro grupo —
**`firestore.rules` permanece com diff zero**, nenhuma permissão foi
ampliada, nenhuma atribuição ficou pública.

O mesmo princípio vale para a busca de uma competência específica. Não se
deve usar `getDoc()` no ID determinístico de
`rascunhosCompetenciasPlantao`/`competenciasPlantao` antes de saber se o
documento existe: na ausência, `resource.data` é nulo e a Rule não consegue
extrair `grupoId`, convertendo o estado vazio em `permission-denied`. As funções
`obterCompetenciaPlantaoRascunho()` e `obterCompetenciaPlantaoPublicada()`
consultam por `grupoId + competencia`; o primeiro Plantão retorna `null`
normalmente, sem faixa vermelha, e o mesmo caminho permite salvar o primeiro
rascunho.

### 26.4 Sincronização exata ao salvar de novo — documentos órfãos

`idAtribuicaoPlantao(indice)` é posicional (0001, 0002, ... pela ordem
do array), nunca baseado numa identidade estável por atribuição. Isso
significa que reabrir um rascunho, excluir uma atribuição no meio da
lista e salvar de novo reindexa as atribuições restantes — sem nenhuma
limpeza, o documento que tinha o ID mais alto antes nunca seria
sobrescrito nem apagado, ficando órfão no Firestore para sempre. Esse
bug já existia em teoria desde a PLANTÃO-3A (`salvarAtribuicoesPlantaoRascunho()`
sempre foi só upsert), mas nunca era alcançável na prática — nenhum
fluxo anterior editava-e-resalvava um rascunho JÁ persistido. Reabrir
rascunho torna esse caminho real.

**Corrigido em `salvarAtribuicoesPlantaoRascunho()`**: a função agora lê
os `atribuicaoId` já persistidos desta competência (mesmo `where('grupoId',
...)` do § 26.3), calcula quais não estão mais na lista nova, e inclui
um `batch.delete()` para cada um — no MESMO lote de escrita das
atualizações, nunca uma chamada separada que poderia deixar o Firestore
num estado misto se falhasse sozinha. `grupoId` passou a ser parâmetro
explícito da função (nunca derivado de `atribuicoes[0]`, porque excluir
TODAS as atribuições produz um array vazio, que não indicaria de quem
são os documentos a limpar). Testado explicitamente: excluir 1 de 3 e
salvar limpa exatamente o órfão; excluir todas e salvar limpa tudo;
salvar de novo sem alterações não exclui nem duplica nada; adicionar
uma atribuição nova nunca exclui as anteriores.

### 26.5 "Abrir rascunho" — onde vive na UI

Na tela "Plantões", cada Grupo expandido agora mostra uma seção
"Rascunhos" (competência, período 26→25, status RASCUNHO, botão "Abrir
rascunho" — só para quem administra o grupo). Dentro de "+ Nova escala",
quando já existe um rascunho para o Grupo/competência escolhidos, o
botão "Abrir rascunho existente" chama o MESMO fluxo diretamente — não
exige mais navegação indireta pela tela "Plantões" (limitação registrada
na ESCALAS-UX-1B). As duas entradas chamam a mesma ação
(`abrirRascunhoNoEditorAcao`), que nunca navega para o Editor antes da
leitura terminar (estados distintos de carregando/erro/não encontrado —
erro de permissão nunca é mascarado como "não encontrado").

### 26.6 Dirty state

Corrigido de passagem: `salvarRascunhoPlantaoAcao()` não zerava o
indicador de "Alterações não salvas" depois de um salvamento
bem-sucedido — o indicador continuava aceso mesmo com o rascunho já
salvo. Agora zera, junto com a atualização da lista de rascunhos
carregada na tela "Plantões" (para o rascunho recém-salvo aparecer ali
sem precisar recarregar a página).

### 26.7 O que esta fase explicitamente NÃO faz

- Nenhuma publicação (`publicarPlantao()` continua inexistente);
  nenhuma mudança de Firestore Rules — `test:firestore-rules` permanece
  em 153/153 + 1 teste novo (154), diff zero em `firestore.rules`.
- Nenhum "Copiar período anterior" (`origem: 'COPIADO'` continua
  registrada como futura, não implementada).
- Nenhum drag-and-drop.
- Nenhum gerador/distribuição automática.
- Nenhuma mudança funcional na escala 6x1, em `OrganizationTree`/
  `OrganizationTeamPicker`/`lib/organizacao.ts`, ou hardcode de NOC
  (reconfirmado: `EQ_NOC` continua só em seed/fixtures).
- **Reidratar a "Conferência da fonte" de um rascunho `IMPORTADO`
  reaberto** — limitação registrada em § 26.2, não implementada (o
  modelo persistido não guarda o dado necessário).
- **Marcar visualmente "(Inativo)" no `<select>` de plantonista** para
  um participante desativado referenciado por uma atribuição existente
  — a atribuição em si nunca desaparece (§ 26.2), mas o rótulo visual
  distintivo foi deixado de fora desta fase (item explicitamente opcional
  no pedido original — "pode marcar"); registrado como possível
  refinamento futuro, não uma omissão de comportamento.
- Nenhuma mudança em `ParticipanteConsolidadoPlantao` nem em nenhum
  outro tipo já existente do Editor — a limpeza de órfãos e a
  reidratação coube inteiramente em funções novas ou parâmetros novos
  em funções já existentes.

Ver `CHECKPOINT-FASE-ESCALAS-UX-1B1-REABRIR-RASCUNHO.md` para o
detalhamento completo desta fase.

## 27. ESCALAS-UX-1C — "Usar período anterior" + distribuição rápida de plantões

Terceira e última forma de começar uma competência prevista em § 12
("Nova escala — visão futura"): "Copiar período anterior" (`origem:
'COPIADO'`, adiada desde a ESCALAS-UX-1B/1B.1). Junto com isso, reduz o
esforço de montar uma escala manualmente sem criar um segundo modo de
trabalho: seleção de plantonista + clique no dia vazio. Ver
`docs/spec/EDITOR_ESCALAS.md` § 11 para o detalhamento técnico completo
(tradução de datas, tamanhos de competência diferentes, vínculos,
drag-and-drop) — esta seção registra o fluxo e as decisões de produto.

```
+ Nova escala → Plantão → Grupo + competência → Como começar?
   Importar planilha | Criar escala vazia | Usar período anterior
                                                    |
                                                    v
                                     competência EXATAMENTE anterior
                                     já tem rascunho persistido?
                                          não -> "Não existe uma escala
                                                  anterior para este
                                                  Plantão." (oferece as
                                                  outras duas opções)
                                          sim -> copiarAtribuicoesParaNovaCompetencia()
                                                 + vinculosDeCopiaAnterior()
                                                    |
                                                    v
                                         MESMO Editor de Plantão
                                         (origem: 'COPIADO')
```

### 27.1 A competência anterior nunca é alterada

"Usar período anterior" só LÊ a competência anterior
(`listarAtribuicoesPlantaoRascunho`, leitura pura) — nunca a reidrata
como working copy, nunca grava nela, nunca cria vínculo retroativo. A
nova working copy é sempre independente (novas referências de
array/objeto, nunca reaproveitadas) — editar a competência nova nunca
altera semanticamente a anterior. "Salvar rascunho" grava sempre na
competência NOVA (`competenciaRascunho`/`idCompetenciaPlantao(grupoId,
competencia)`), nunca em um identificador da anterior — garantido
estruturalmente porque `salvarRascunhoPlantaoAcao()` nunca referencia a
competência anterior em nenhum ponto (testes 31/32 de
`tests/plantao-editor-boundaries.test.mjs`).

### 27.2 Não é um gerador, não rotaciona

Copiar a estrutura da competência anterior preserva os MESMOS
plantonistas nas MESMAS posições relativas — nunca "Ana→Bruno→Carlos"
nem qualquer outra rotação. O coordenador decide se quer mudar algo
depois, usando o Editor normalmente (incluindo a distribuição rápida
por clique desta mesma fase).

### 27.3 Distribuição rápida por clique — reduz esforço, não cria um segundo modo

O painel "Resumo por pessoa" (já existente desde a ESCALAS-UX-1A) ganhou
um estado de seleção puramente de UI: tocar uma pessoa a marca como
"ativa" (`aria-pressed`, nunca grava nada); tocar depois um dia vazio no
calendário abre o MESMO modal de criação já com "Plantonista"
preenchido. Início/fim continuam sempre vazios — nunca um horário
inventado. Sem seleção, o comportamento do calendário é idêntico ao de
antes desta fase. Nenhum modo de edição novo, nenhum componente de
calendário novo.

### 27.4 Origem COPIADO e a decisão sobre firestore.rules

Diferente de todas as fases anteriores desta série, que mantiveram
`firestore.rules` com diff zero, esta fase adicionou `'COPIADO'` à
lista de origens aceitas em 4 ocorrências de `origem in [...]` (mesmo
bloco `rascunhosCompetenciasPlantao/{id}` de sempre) — avaliada como
mudança mecânica e não-significativa (nenhuma condição de autorização
nova, nenhum campo/coleção nova, simétrica ao padrão já usado para os 3
valores anteriores). Verificada empiricamente no emulador
(`test:firestore-rules`: 154/154 preservados + 1 teste novo = 155/155).
Ver `docs/spec/EDITOR_ESCALAS.md` § 11.7 para o raciocínio completo da
decisão.

### 27.5 O que esta fase explicitamente NÃO faz

- Nenhuma publicação (`publicarPlantao()` continua inexistente).
- Nenhum gerador/distribuição automática/rotação/autocomplete de
  plantonista — copiar é uma cópia estrutural, nunca um gerador.
- Nenhuma regra de cobertura COSI/NOC hardcoded.
- **Drag-and-drop** — avaliado e deliberadamente não implementado (sem
  precedente de arrastar-elemento no código, sem biblioteca instalada,
  sem equivalente acessível-por-teclado já estabelecido para copiar).
  "Distribuição por clique está completa. Drag-and-drop continua
  melhoria opcional futura."
- **"Repetir último horário"** — avaliado e não implementado; o ganho é
  pequeno frente ao risco de criar uma segunda forma de preencher
  horário.
- Nenhuma customização de cor, nenhum modo de calendário novo, nenhum
  wizard complexo — só um terceiro botão em "Como começar?" e um painel
  de seleção reaproveitando o "Resumo por pessoa" já existente.
- Nenhuma mudança funcional na escala 6x1, em `OrganizationTree`/
  `OrganizationTeamPicker`/`lib/organizacao.ts`, ou hardcode de NOC.
- O risco de timezone do Grupo mudar depois de um rascunho salvo (§ 26.7
  da ESCALAS-UX-1B.1) permanece registrado, não resolvido nesta fase.
- A limitação de "Conferência da fonte" não reconstruível para um
  rascunho `IMPORTADO` reaberto (§ 26.2) não é afetada por esta fase —
  `COPIADO` nunca teve uma "fonte XLS" para começar.

Ver `CHECKPOINT-FASE-ESCALAS-UX-1C-FACILIDADES-DISTRIBUICAO.md` para o
detalhamento completo desta fase.

## 28. PLANTAO-PADRAO-1 — padrão semanal configurável por Grupo

Entrega a FONTE DE VERDADE para "horários normalmente usados por este
Grupo, por dia da semana" — nenhuma aplicação/consumo automático ainda
(isso é ESCALAS-UX-2B). Motivação de negócio: um Grupo de Plantão pode ter
horários recorrentes diferentes conforme o dia (ex.: um padrão de
domingo–quinta e outro de sexta–sábado) — mas isso NUNCA pode virar regra
hardcoded (`if COSI`, `if sexta`); é configuração real do Grupo,
totalmente livre.

### 28.1 Modelo — `GrupoPlantao.padraoHorarioSemanal`

```ts
type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo (mesmo Date#getUTCDay(), já usado internamente pelo parser)

interface PadraoHorarioPlantaoDia {
  diaSemana: DiaSemana;
  horaInicio: string;  // "HH:mm", 24h
  horaFim: string;     // "HH:mm", 24h
  fimDiaOffset: 0 | 1; // 1 = termina no dia seguinte — NUNCA inferido comparando horaFim < horaInicio
}

interface GrupoPlantao {
  // ...campos existentes (seção 20.3), inalterados
  padraoHorarioSemanal?: PadraoHorarioPlantaoDia[]; // OPCIONAL — ausência = nenhum padrão configurado
}
```

Array tipado (uma entrada por dia configurado), não um objeto com 7
propriedades fixas por nome de dia — mais fácil de validar/ordenar/
detectar duplicidade, e independente de idioma na persistência. Ausência
de entrada para um dia é "sem horário padrão configurado", nunca uma
entrada artificial `00:00 → 00:00`. Um turno de 24h é representável
(`horaInicio == horaFim` com `fimDiaOffset = 1`); o mesmo par com
`fimDiaOffset = 0` é inválido (duração zero).

### 28.2 Backward compatibility

O campo é 100% opcional — todo `GrupoPlantao` persistido antes desta fase
continua válido sem nenhuma migração. Nenhum script de migração foi
criado; nenhum documento existente foi tocado.

### 28.3 Helpers puros (`packages/contrato`)

- `horarioPlantaoValido(horario)` — `HH:mm`, 24h, 00–23/00–59.
- `duracaoMinutosPadraoHorarioPlantaoDia(entrada)` — minutos desde
  meia-noite + `fimDiaOffset * 1440`, sem `Date`, imune ao timezone da
  máquina que roda o código.
- `ordenarPadraoHorarioSemanal(padrao)` — sempre Domingo→Sábado.
- `obterPadraoHorarioParaDia(padraoHorarioSemanal, diaSemana)` — `null` =
  nenhum padrão para aquele dia.
- `diaSemanaCivil(dataCivil)` — dia da semana de uma data `AAAA-MM-DD`,
  determinístico via `Date.UTC` sobre os componentes extraídos por regex
  (nunca `new Date("AAAA-MM-DD")`, sujeito a interpretação inconsistente).
- `obterPadraoHorarioGrupoParaData(grupo, dataCivil)` — combinação das
  duas anteriores; o ponto de entrada real para ESCALAS-UX-2B consumir.
- `validarPadraoHorarioSemanal(padrao)` — dia 0..6 sem duplicidade,
  horários válidos, offset 0/1, duração > 0; array vazio é válido.

Nenhum destes helpers acopla a React ou Firebase.

### 28.4 Timezone

O padrão representa horário CIVIL do Grupo, no MESMO `timezone` que o
Grupo já possuía (campo inalterado). "Domingo 19:00" significa 19:00 no
fuso do Grupo — a conversão para instante UTC ao aplicar o padrão numa
atribuição real fica para ESCALAS-UX-2B, reaproveitando
`converterMomentoParaInstanteUtc()` já existente (seção 20.8), nunca uma
segunda função de conversão.

### 28.5 Nenhuma normalização de dados existentes

O padrão é puramente sugestivo para NOVAS atribuições futuras — configurar
ou alterar um padrão semanal NUNCA recalcula/altera rascunhos já
existentes, atribuições já salvas, escalas importadas, ou qualquer
intervalo atípico (ex.: 43h/5h de uma planilha real). `montarAtribuicoesPlantaoRascunho()`/
`copiarAtribuicoesParaNovaCompetencia()` (seção 21) não conhecem o padrão
semanal — confirmado por boundary test.

### 28.6 Administração (Dashboard)

Nova seção "Padrão de horário" dentro de `ModalGrupoPlantao` (criar/editar
Grupo) — `components/plantao/PadraoHorarioSemanalCampo.tsx`, componente de
apresentação puro. Um card por dia da semana (nunca uma tabela horizontal
— mobile-friendly), cada um com toggle habilitar/desabilitar + horário de
início/fim (`<input type="time">`) + "Termina no dia seguinte" +
resumo humano (ex.: "19:00 → 07:00 (+1 dia) · 12h" — nunca expõe
`fimDiaOffset` cru). Desabilitar um dia remove a entrada por completo
(nunca um dado residual `ativo: false` guardado à parte). Grupo novo pode
ser criado sem nenhum dia configurado; Grupo antigo sem o campo mostra a
seção vazia, pronta para o gestor preencher.

Autorização: a mesma de sempre (`podeGerenciarGrupoPlantao()`/
`podeGerenciarEsteGrupoPlantao()`) — nenhuma permissão nova, nenhuma
ampliação de acesso.

### 28.7 Firestore Rules

`gruposPlantao/{grupoId}` (create/update) passa a aceitar o campo
opcional na allowlist de chaves e valida sua estrutura quando presente
(`padraoHorarioSemanalValido()`/`padraoHorarioPlantaoDiaValido()`, mesmo
nível de validação estrutural das demais Rules deste arquivo — tipos/
faixas, não recálculo de negócio). Ausência do campo continua válida
(retrocompatibilidade). Duplicidade de `diaSemana` entre elementos NÃO é
validada pela Rule (exigiria comparação par-a-par de até 7 posições,
avaliado como desproporcional frente à defesa real já existente
client-side, `validarPadraoHorarioSemanal()`, que roda antes de qualquer
escrita) — limitação documentada, não uma omissão silenciosa. Regra de
LEITURA inalterada.

### 28.8 O que esta fase explicitamente NÃO faz

- Nenhum consumo pelo Editor (clicar no calendário → preencher horário,
  drag pessoa → criar atribuição) — isso é ESCALAS-UX-2B (implementada,
  ver seção 29 abaixo e `CHECKPOINT-FASE-ESCALAS-UX-2B-ROSTER-DRAG.md`).
- Nenhuma normalização/recálculo de atribuições existentes.
- Nenhuma publicação de Plantão (`publicarPlantao()` continua
  inexistente — PLANTÃO-3C).
- Nenhuma mudança em `ContextoEscalaAtivo`/`ScheduleContextSwitcher`/
  `ScheduleCompetenceControl`/`ScheduleStatusBadge` (ESCALAS-UX-2A.1) nem
  nos dirty guards (`jornadaPossuiAlteracoesNaoSalvas`/
  `plantaoPossuiAlteracoesNaoSalvas`, ESCALAS-UX-2A.1-FIX).
- Nenhuma regra de cobertura hardcoded por sigla de equipe/grupo
  (COSI/SOC/NOC/CODB) ou por dia da semana em prosa.

Ver `CHECKPOINT-FASE-PLANTAO-PADRAO-1.md` para o detalhamento completo
desta fase.

## 29. ESCALAS-UX-2B — consumo do padrão semanal pelo Editor

Primeiro consumo real de `padraoHorarioSemanal` — um roster lateral
(`PlantaoRoster`) substitui o antigo "Resumo por pessoa"; selecionar uma
pessoa e clicar um dia (ou arrastar a pessoa até o dia, no desktop) chama
`solicitarNovaAtribuicaoPlantao()`, que consulta
`obterPadraoHorarioGrupoParaData()` e, se existir padrão, abre um
popover de confirmação (`QuickAddPlantaoPopover`, reaproveitando
`previewPadraoHorarioPlantaoDia()` já existente) antes de gravar
qualquer coisa na working copy — nunca automático, nunca no drop em si.
Sem padrão, cai direto no editor completo de sempre. Detalhamento
completo em `docs/spec/EDITOR_ESCALAS.md` seção 12 e
`CHECKPOINT-FASE-ESCALAS-UX-2B-ROSTER-DRAG.md`.

**Correção ESCALAS-UX-2B.1**: uma NOVA atribuição só pode iniciar dentro
do período real da competência (`periodoInicio <= dataInicial <=
periodoFim`, via `dataPertenceCompetencia()`) — dias de contexto visual
(fora da janela 26→25) nunca aceitam criação por click/drag/
"+ Adicionar"/quick-add. O TÉRMINO pode ultrapassar o período livremente
(um plantão de 25/08 19:00 até 26/08 07:00 continua válido). Atribuições
já existentes/importadas nunca são afetadas — a regra vale só para
criação nova pela UI. Ver `docs/spec/EDITOR_ESCALAS.md` §12.10 e
`CHECKPOINT-FASE-ESCALAS-UX-2B1-LIMITES-COMPETENCIA.md`.

## 30. ESCOPO-OPERACIONAL-MATRIZ-2 — publicação por grupo

As limitações históricas de fases anteriores que registravam Plantão “sem
publicação” foram superadas por esta fase. A publicação agora é uma ação
explícita do Dashboard, implementada por `publicarCompetenciaPlantao()`.

- a chave mensal é `grupoId`, nunca `equipeResponsavelId` ou nome visual;
- somente `ADMIN_SISTEMA` ou responsável em matriz operacional ativa pode
  salvar/publicar;
- `equipesConsulta` lê e monitora, mas não escreve;
- o read model consulta rascunho e publicação para distinguir os três estados;
- competências e atribuições publicadas continuam sem delete físico.

## 31. Importação recuperável com Rules de staging atrasadas

Selecionar e interpretar uma planilha de Plantão cria apenas uma working copy
local; não é escrita no Firestore. Portanto, `permission-denied` em uma
checagem auxiliar de rascunho não pode impedir a abertura do editor. Salvar e
publicar continuam passando obrigatoriamente pelos repositories e pelas Rules.

O Wizard apresenta dentro do próprio modal qualquer falha de extensão,
leitura, estrutura ambígua, tipo divergente ou parser. A tentativa sempre
finaliza `processando`, inclusive quando `File.arrayBuffer()`, XLSX ou o parser
lançam exceção. Erro de importação nunca pode ficar escondido atrás do modal
nem deixar o botão carregando indefinidamente.

Se as Rules publicadas não permitirem confirmar a inexistência de rascunho, a
criação manual pode abrir a working copy local com aviso explícito de que
salvar/publicar depende da publicação das Rules. Uma resposta legítima com
rascunho existente continua bloqueando duplicidade e oferece abrir o rascunho.
O mesmo vale para a leitura auxiliar dos participantes: se ela for recusada, o
editor abre com roster vazio e diagnóstico, sem inventar participantes nem
associar pessoas ao usuário autenticado. Uma falha que não seja
`permission-denied` continua sendo tratada como erro recuperável e não é
silenciada.

## 32. Revisão compacta da importação de Plantão

A revisão da importação prioriza a conferência operacional. O painel principal
com o **Calendário** é o primeiro card visível; **Planilha de Plantão
detectada**, conferência consistente e **Divergências encontradas na fonte**
ficam depois do calendário como diagnóstico da origem. O seletor de arquivo é
uma faixa compacta depois que o tipo Plantão foi identificado, mantendo
seleção por clique e arrastar/soltar sem ocupar a altura de um card de conteúdo.

As abas normativas da revisão são **Calendário**, **Contabilidade** e
**Vínculos**. As antigas abas **Resumo** e **Lista** foram removidas: erros e
avisos estruturais já aparecem nos diagnósticos da fonte, enquanto a grade
mensal é a visualização primária das atribuições. Não deve ser criada uma
segunda lista ou outra fonte de verdade; calendário, contabilidade atual e
payload salvo derivam da mesma working copy.

No calendário de uma importação, cada cartão exibe as iniciais em destaque e
o horário ao lado, no formato compacto `19h–07h` quando os minutos são `00`.
Minutos significativos continuam visíveis. O nome e o intervalo completos são
preservados no `title` e no rótulo acessível, portanto a compactação é apenas
visual e nunca altera datas, duração ou contabilidade.

### 32.1 Criação durante a resolução de vínculos

Quando um nome da planilha não possui usuário, **Criar e vincular** abre o
mesmo modal de cadastro dentro da revisão. Nome e alias vêm preenchidos com a
grafia original; e-mail, login, cargo e período padrão continuam sendo uma
decisão explícita. Após uma gravação bem-sucedida, o usuário é acrescentado à
lista local e o vínculo daquela pessoa é confirmado automaticamente.

O cadastro contextual pertence estritamente à `equipeResponsavelId` do
`GrupoPlantao`. Ausência do grupo/equipe bloqueia a abertura com diagnóstico;
jamais há fallback para a equipe do responsável autenticado e `gestorUid` não
é preenchido com a identidade de quem realizou a importação. Perfil, escopo e
campos organizacionais administrativos também não são inferidos nesse fluxo.
A gravação continua usando `salvarUsuario()` e as Firestore Rules existentes:
o modal não amplia autorização, não contorna `permission-denied` e mantém o
erro recuperável visível sem confirmar um vínculo falso.
