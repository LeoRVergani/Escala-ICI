# Hub de Escalas (Fase DASH-SIMPLES-1B)

## Status

✅ Implementada. Este documento é normativo (não só design) — descreve o
que foi de fato construído, complementando `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`
(que continua sendo a referência conceitual de "workspace único" e do
plano de microfases mais amplo).

## 1. Objetivo

Transformar "Escalas" no HUB único de trabalho com escalas: ao entrar na
tela, o coordenador vê imediatamente **todas** as operações (Jornada 6x1 e
Plantão) que lhe dizem respeito — as que ele **administra** e as que ele
apenas **acompanha** — com status, competência e a ação correta para cada
uma. Antes desta fase, "Escalas" só mostrava a UMA operação que era o
`contextoEscalaAtivo` no momento; qualquer outra operação administrável
ficava invisível até o usuário trocar de contexto pelo seletor do header.

**Hub ≠ Editor.** O Hub é só o índice — a lista de operações e o ponto de
entrada para cada uma. Abrir uma operação continua levando ao MESMO
workspace/editor que já existia antes desta fase (Grade para Jornada,
calendário/`PlantaoCalendario` para Plantão) — nenhum editor novo foi
criado.

## 2. Fonte dos dados — zero ACL nova

O Hub não resolve autorização por conta própria. Ele consome
integralmente `operacoesDashboard: OperacaoDashboard[]`
(`apps/dashboard/src/DashboardApp.tsx`), já calculada por
`resolverOperacoesDashboard()` (`lib/operacoesDashboard.ts`) a partir de
`resolverEscoposOperacionais()` (`lib/escoposOperacionais.ts`) — a MESMA
lista que já alimentava o `ScheduleContextSwitcher` (seletor superior) e
os cards da Visão geral desde `PATCH-DASHBOARD-OPERACOES-SIMPLES-1`.
`resolverOperacoesDashboard()` só é chamada uma vez no arquivo inteiro
(garantido por teste de boundary) — o Hub nunca é uma segunda fonte.

Cada `OperacaoDashboard` já carrega:

- `tipo: 'JORNADA' | 'PLANTAO'`;
- `alvoId` — `Equipe.id` (Jornada) ou `GrupoPlantao.grupoId` (Plantão), a
  identidade real, nunca o nome;
- `nome` — sempre o nome real da Equipe/Grupo, nunca um rótulo genérico;
- `status: StatusOperacaoDashboard` (`sem-escala | rascunho | publicada |
  publicada-com-rascunho-pendente`);
- `ativa` — `true` só para a operação que é exatamente o `contextoEscalaAtivo` agora;
- `consulta` — `true` quando o usuário só consulta (nunca administra).

## 3. "Minhas escalas" vs "Acompanhamento" — agrupamento

Novo módulo puro `lib/hubEscalas.ts`:

```ts
export function agruparOperacoesParaHub(operacoes: readonly OperacaoDashboard[]): {
  minhasEscalas: OperacaoDashboard[]; // consulta === false
  acompanhamento: OperacaoDashboard[]; // consulta === true
};
export function rotuloAcaoOperacaoHub(operacao: OperacaoDashboard): string; // 'Abrir escala' | 'Visualizar'
export function possuiOperacaoAdministravelHub(operacoes: readonly OperacaoDashboard[]): boolean;
```

Regra permanente: as duas listas nunca se misturam visualmente, e uma
operação de "Acompanhamento" nunca ganha um rótulo/ação administrativa
(Editar/Publicar/Importar/Salvar/Excluir/Cancelar publicação) — só
"Visualizar". Testado em `lib/hubEscalas.test.ts` (agrupamento) e
`tests/dashboard-hub-escalas-boundaries.test.mjs` (garantia de que o
componente nunca renderiza um verbo administrativo para consulta).

Hoje só Plantão pode ter `consulta: true` (`equipesConsulta` do
`GrupoPlantao`) — Jornada 6x1 não tem conceito de consulta ainda, então
"Acompanhamento" nunca lista uma Jornada nesta fase. Isso é um reflexo
direto do domínio atual, não uma decisão do Hub.

## 4. Não depender do contexto ativo para montar o Hub

Crítico: a lista do Hub é `operacoesDashboard` inteira, nunca filtrada
pelo `contextoEscalaAtivo`. Trocar de contexto (Jornada → Plantão ou
vice-versa) NUNCA remove a outra operação do Hub — ela só deixa de estar
com o destaque visual de "ativa agora" (`operacao.ativa`). Coberto por
`lib/hubEscalas.test.ts` (testes B/C do pedido).

## 5. Competência exibida

Nesta fase, o Hub mostra a MESMA competência global (`competenciaDashboard`,
já usada por todo o resto do Dashboard) para todas as operações — não há,
ainda, competências independentes por card no índice. Isso é consistente
com o resto do produto hoje (um único seletor de competência no header) e
evita introduzir um segundo conceito de "competência por card" nesta fase.
Abrir uma operação continua podendo trocar a competência normalmente
dentro do workspace (`ScheduleCompetenceControl`, inalterado).

## 6. Status, pessoas e alertas — nunca fabricar

- **Status**: sempre `rotuloStatusOperacaoDashboard(operacao.status)` —
  os mesmos 4 rótulos já usados em todo o Dashboard (Sem escala / Rascunho
  / Publicada / Publicada (rascunho pendente)). Nunca uma quinta
  variação textual.
- **Pessoas** (`colaboradores`/`participantes`): lidas dos snapshots já
  carregados para TODAS as operações administráveis
  (`resumosJornadaDashboard`/`resumosPlantaoDashboard`, os mesmos efeitos
  que já alimentavam o card único da Visão geral, agora generalizados por
  operação) — nenhuma nova chamada de rede. Quando o dado ainda não
  carregou, o card simplesmente omite a linha de pessoas (nunca mostra 0
  fabricado).
- **Alertas**:
  - **Jornada**: computados a partir do MESMO snapshot persistido
    (`resumosJornadaDashboard[...].documentos`) com a MESMA função já
    usada para o card único da Visão geral
    (`gerarAlertasEscala`/`montarAlertasVisiveis`) — apenas generalizada
    para cada Jornada administrável, não só "a" Jornada em destaque. Se a
    operação é o contexto ativo com o editor carregado, usa os alertas ao
    vivo (`alertasVisiveis`) em vez do snapshot, para nunca divergir do
    que o editor mostra.
  - **Plantão**: alertas completos (erros/avisos/pendências de vínculo)
    só existem dentro do editor ao vivo (`resultadoPlantao`), exatamente
    como já documentado para o card único da Visão geral
    (`HOTFIX-PLANTAO-PUBLICADO-APP-E-VISAO-GERAL-1`). Fora do editor, o
    Hub mostra **"Abra para conferir"** — nunca "0 alertas" — exceto
    quando `operacao.status === 'sem-escala'`, caso em que 0 é uma
    verdade conhecida (não existe nada para gerar alerta). Esta é a MESMA
    regra de honestidade de `docs/spec/VISAO_GERAL_OPERACIONAL_SOC_PLANTAO.md`
    aplicada por card, não só ao card único de antes.
  - Acompanhamento (consulta) nunca mostra contagem de alertas — a
    operação nunca é editável por este usuário, então o card só mostra
    nome, tipo, competência, status e "Somente consulta".

## 7. Abrir uma operação

O clique em qualquer card (administrável ou consulta) chama:

```ts
onAbrir={(operacao) => solicitarTrocaContexto(contextoOpcaoOperacao(operacao))}
```

`contextoOpcaoOperacao()` é a MESMA função já usada pelo
`ScheduleContextSwitcher` para resolver o `ContextoEscalaAtivo` de uma
`OperacaoDashboard` (reaproveita a competência do contexto ativo quando é
a mesma operação, ou a competência corrente nas demais). `solicitarTrocaContexto()`
é o único ponto de entrada de troca de contexto do Dashboard — passa pela
guarda de alterações não salvas (`UnsavedChangesDialog`) automaticamente
quando existe edição pendente na operação atual, exatamente como o
seletor do header já fazia. Nenhum caminho paralelo foi criado.

A partir daí, o comportamento de navegação é o que já existia (inalterado
nesta fase):

- **Jornada** → `aplicarTrocaContexto` carrega a Jornada e, se a tela
  atual é uma das dependentes de contexto (`escalas`/`grade`/`importar`),
  navega para `tela === 'grade'` (Grade/`ScheduleGrid`).
- **Plantão com rascunho existente** → `abrirRascunhoNoEditorAcao()`
  carrega o rascunho e navega para `tela === 'importar'`
  (`PlantaoCalendario`, dentro de `PreviewPlantao`).
- **Plantão só publicado (sem rascunho) ou sem nenhuma escala** →
  permanece em `tela === 'escalas'`, mostrando o painel de detalhe da
  operação (rótulo, período, status, histórico/revisão) que já existia
  nesta tela antes desta fase — o botão "Abrir editor"/"Abrir consulta"
  dentro desse painel continua abrindo o editor quando aplicável.
- **Operação consulta** → mesmo caminho; `contextoPlantaoSomenteConsulta`
  (inalterado) continua sendo o gate único que esconde toda ação de
  escrita dentro do workspace aberto.

## 8. CTAs "Nova escala"/"Importar escala"

Antes desta fase, o gate desses botões na tela Escalas era
`!contextoPlantaoSomenteConsulta` — dependia de qual operação estava
ativa no MOMENTO, não da capacidade real do usuário. Um usuário com
operações administráveis mas cujo contexto ativo por acaso fosse uma
consulta via os botões escondidos incorretamente; um usuário
exclusivamente consulta cujo contexto ativo (por alguma razão) não fosse
a operação de consulta poderia, em tese, vê-los.

Corrigido nesta fase: o gate agora é `possuiOperacaoAdministravelHub(operacoesDashboard)`
— `true` sempre que existe ao menos uma Jornada ou Plantão administrável
no escopo do usuário, independentemente de qual operação está com o
contexto ativo agora. Um usuário exclusivamente consulta nunca vê esses
CTAs.

## 9. Escala sem competência / sem publicação

Uma operação sem nenhuma escala ainda (`status === 'sem-escala'`)
continua aparecendo normalmente no Hub — nunca é escondida. O
comportamento de "nunca criar rascunho automaticamente ao trocar de
contexto" (`contextoSemEscala`, ESCALAS-UX-2A.1) é preservado
integralmente: abrir essa operação mostra o estado "Nenhuma escala
criada para {competência}" já existente, com a ação "Nova escala"
disponível no cabeçalho.

## 10. Histórico

O histórico de publicações (Jornada) / revisão publicada (Plantão)
continua existindo exatamente como antes desta fase — mas só é mostrado
para a operação que é o `contextoEscalaAtivo` agora (o painel abaixo do
Hub), nunca um card de histórico por operação dentro do próprio índice.
O Hub é índice; histórico pertence ao workspace da operação escolhida.

## 11. Cancelamento de publicação / duplicidade de Grupo homônimo

Sem alteração nesta fase — comportamentos preservados integralmente:

- Uma competência `CANCELADA` nunca aparece como ativa no Hub (o status
  vem de `derivarStatusOperacaoDashboard`, que não muda); a ação
  "Cancelar publicação" continua só dentro do painel de detalhe/workspace,
  nunca no card do Hub.
- Grupos de Plantão homônimos continuam desambiguados pela identidade
  real (`grupoId`) — o Hub nunca agrupa/deduplica por nome; cada
  `OperacaoDashboard` já chega com seu `alvoId` próprio
  (`lib/hubEscalas.test.ts`, teste G).

## 12. Contexto no header

Mantido: o `ScheduleContextSwitcher`/`ScheduleCompetenceControl`/`ScheduleStatusBadge`
continuam aparecendo no header sempre que `tela !== 'visao'` — incluindo,
portanto, dentro de "Escalas". Avaliar remover o seletor especificamente
da raiz do Hub (§ 10 do pedido que originou esta fase) foi considerado e
descartado por risco/benefício: os cards do próprio Hub já cobrem a
função de "escolher escala" de forma mais rica, mas separar
"Hub sem seletor" de "workspace com seletor" exigiria introduzir um novo
estado de navegação dentro da tela Escalas (ex.: "workspace aberto" vs
"índice"), o que esta fase deliberadamente evitou para não arriscar
estabilidade. **Registrado como débito técnico / follow-up**, não como
comportamento final.

## 13. Fora de escopo desta fase (preservado)

- `firestore.rules` — inalterado.
- Nenhuma ACL nova, nenhum campo novo em `Usuario`.
- `ScheduleStartWizard` (`+ Nova escala`/`Importar escala`) — inalterado,
  handlers `abrirNovaEscala`/`abrirImportarEscala` preservados.
- `Tela = 'grade' | 'importar'` — ambos preservados fisicamente; o Hub só
  decide QUANDO navegar para eles, nunca os remove.
- Publicação Jornada/Plantão — inalterada.
- Domínio de Plantão (`lib/`) — inalterado.

## 14. Testes

- `lib/hubEscalas.test.ts` — agrupamento puro (testes A-I do pedido:
  Jornada+Plantão juntas em Minhas escalas, contexto ativo não filtra a
  lista, consulta nunca mistura com administrável, rótulo de ação nunca
  administrativo para consulta, sem-escala continua na lista, Grupo
  homônimo desambiguado).
- `tests/dashboard-hub-escalas-boundaries.test.mjs` — integração real:
  Hub consome `operacoesDashboard` (nunca uma segunda resolução), abrir
  usa `contextoOpcaoOperacao`/`solicitarTrocaContexto` (nunca um caminho
  paralelo — testes J/K), CTAs gateados por `possuiOperacaoAdministravelHub`,
  nenhum verbo administrativo em cartão de consulta (testes E/F), alertas
  de Plantão nunca "0" fabricado fora de `sem-escala` (teste H), nenhuma
  seção vazia renderizada, nenhum nome/sigla real hardcoded.
- `lib/operacoesDashboard.test.ts` — inalterado, continua cobrindo a
  matriz completa de autorização/status que o Hub só consome.
