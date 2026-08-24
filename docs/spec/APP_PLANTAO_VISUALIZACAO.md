# App/PWA — visão "Plantão" (FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1)

Spec normativa da primeira versão funcional da aba "Plantão" no App do
colaborador (`apps/app/src/EmployeeApp.tsx`). Complementa
`docs/spec/PLANTOES.md` § 33 (contexto completo da fase, incluindo o lado
Dashboard) e `docs/spec/EDITOR_ESCALAS.md` § 19.

## 1. O que esta fase implementa

Uma nova aba "Plantão" no App, entre "Trocas" e "Equipe", visível para
qualquer usuário com um `GrupoPlantao` no escopo da própria equipe
(`equipesConsulta`) — não só para plantonistas. A aba mostra:

- **Quem está de plantão agora**: nome, iniciais, horário civil (no
  timezone do Grupo), se o turno cruza a meia-noite, contatos ativos.
- **Próximo plantonista**: nome e horário da próxima atribuição.
- **"Meus próximos plantões"** (só quando o usuário logado é, ele mesmo, um
  participante ativo do Grupo): lista cronológica das próprias atribuições
  futuras na competência publicada.
- **"Solicitar troca de plantão"** (só para plantonistas): fluxo real desde
  FASE-TROCAS-PLANTAO-1 — ver seção 5.

A aba "Perfil" ganha um card **"Meus contatos de plantão"** (só para quem é
participante ativo), permitindo autoatualizar os próprios contatos sem
depender do gestor — ver seção 4.

## 2. Fonte de dados — sempre a competência publicada

Toda a aba lê exclusivamente:

- `listarGruposPlantaoPermitidos(equipeId)` — Grupo de Plantão no escopo da
  equipe do usuário (o primeiro resultado, mesmo critério de
  `mensagemAusenciaEscalaAcao`, fase PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1).
- `obterCompetenciaPlantaoPublicada(grupoId, competencia)` +
  `listarAtribuicoesPlantaoPublicada(grupoId, competencia)` — a competência
  **publicada** da competência operacional atual (`competenciaOperacional(dataHoje)`).
- `listarParticipantesPlantao(grupoId)` — participantes ativos (para nomes,
  contatos e para checar se o usuário logado é plantonista).

**Nunca** lê `rascunhosCompetenciasPlantao`/atribuições de rascunho — o App
só existe para consulta, nunca para edição de escala. **Nunca** usa
`localStorage` como fonte de escala/atribuições — `localStorage` no App
continua reservado a preferências de UI (ex.: notificações lidas), no mesmo
princípio já usado pelo toggle Compacta/Edição do Dashboard
(`CHAVE_MODO_VISUALIZACAO_PLANTAO`, que guarda só a preferência visual).

Carregamento único por sessão: `carregarPlantaoApp()` é disparado a partir
de um `useEffect` quando a tela ativa é `'plantao'` ou `'perfil'` (as duas
telas que precisam do mesmo dado), guardado por um `ref`
(`carregouPlantaoAppRef`) para nunca recarregar a cada troca de aba nem
pesar o login de quem nunca abre essas telas.

## 3. Lógica pura — `apps/app/src/plantaoApp.ts`

Toda a matemática de "quem está de plantão agora/depois" vive num módulo
puro, sem Firestore/React (mesmo princípio de `hojeConsulta.ts`):

- `resolverPlantaoAgora(atribuicoes, agoraIso)` — atual (intervalo
  `[inicio, fim)`, início inclusivo/fim exclusivo) e próximo (primeiro
  `inicio` estritamente depois de `agoraIso`). Comparação por string ISO
  8601 (largura fixa), nunca `Date`, para não herdar o timezone da máquina.
- `nomeExibicaoPlantonista`/`obterIniciaisParticipantePlantao` — nome de
  exibição (cai no próprio login se o usuário não for encontrado) e
  iniciais de **primeiro nome + último sobrenome significativo**
  (conectivos "de/da/do/dos/das/e" nunca viram a inicial), com fallback por
  login e por 1 palavra — ver FASE-TROCAS-PLANTAO-1 (substitui a antiga
  `inicialPlantonista`, que usava as duas primeiras palavras).
- `contatosAtivosDoPlantonista` — só contatos `ativo: true`.
- `proximosPlantoesDoUsuario(login, atribuicoes, agoraIso, limite)` — só do
  próprio login, ordenado, nunca inclui um plantão já encerrado.
- `intervaloPlantaoCivil(atribuicao, timezone)` — horário e data civis de
  início/fim no timezone do Grupo (`converterInstanteUtcParaMomento`, de
  `@escala-ici/contrato`), quantos dias de diferença e se cruza o dia
  seguinte; nunca lança (documento corrompido cai num `valido: false`
  seguro). `formatarIntervaloPlantaoCivil` (forma neutra, nunca diz
  "hoje"), `formatarIntervaloPlantaoRelativoAHoje` (só diz "hoje/amanhã"
  quando o plantão realmente começa hoje) e `rotuloFimPlantao` substituem a
  antiga `rotuloHorarioPlantaoExibicao`/o sufixo cru `(+1 dia)` — ver
  FASE-TROCAS-PLANTAO-1, Parte 9.

## 4. Contatos do plantonista

`ParticipantePlantao.contatos: ContatoPlantonista[]` já existia (usado até
esta fase só pelo modal administrativo `ModalContatosParticipante` no
Dashboard) — reaproveitado aqui, sem criar um segundo modelo de contato em
`Usuario`.

- `atualizarContatosPlantonista(grupoId, login, contatos)`
  (`lib/firebase/plantaoWriteRepository.ts`) grava só
  `{contatos, atualizadoEm}` via `updateDoc`. Usa `exigirFirebase()` — o
  mesmo gate de `criarSolicitacaoTroca()` — **nunca**
  `exigirEscritaAdministrativaHabilitada()`: é uma ação pessoal do próprio
  usuário sobre o próprio registro, não uma escrita de administração de
  escala.
- Firestore Rules (`gruposPlantao/{grupoId}/participantes/{login}`, `allow
  update`): o ramo administrativo existente
  (`podeAdministrarEscalaPlantao(grupoId)`) continua igual; um ramo novo
  autoriza `loginDoAuth() == login &&
  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['contatos',
  'atualizadoEm']) && contatosPlantonistaValidos(request.resource.data.contatos)`.
  O plantonista nunca altera `ativo`, `ordem`, `criadoPorLogin`/`criadoEm`,
  nem os contatos de outro participante.
- No App, o card "Meus contatos de plantão" (aba Perfil) reaproveita os
  mesmos limites/validação do modal do Dashboard
  (`validarContatosPlantonista`, `MAXIMO_CONTATOS_PLANTONISTA = 3`) e as
  mesmas classes visuais (`.contato-plantonista-lista`/
  `.contato-plantonista-linha`). Só aparece quando o usuário é participante
  ativo do Grupo já carregado pela aba "Plantão".

Um usuário pode ser gestor de um Grupo (administra via
`podeAdministrarEscalaPlantao`) e também participante dele (edita os
próprios contatos via o ramo pessoal) ao mesmo tempo — os dois caminhos de
escrita coexistem sobre o mesmo documento, sem conflito.

## 5. Trocas de Plantão (FASE-TROCAS-PLANTAO-1)

Implementado a partir desta fase, em coleção e domínio PRÓPRIOS — nunca
reaproveita `lib/trocasEscala.ts`/`lib/firebase/trocasRepository.ts`
(Jornada 6x1), que são inteiramente modelados por **dia** (`TipoTurno`) e
mutam `TurnosMes` via `aplicarTrocaNosDias`. Plantão não tem "dia" nem
"turno de catálogo" — tem atribuições de duração variável (`inicio`/`fim`
como instantes UTC, podendo cruzar a meia-noite) — por isso o domínio vive
em `lib/trocasPlantao.ts` (tipos, máquina de status, validação pura) e
`lib/firebase/trocasPlantaoRepository.ts` (coleções `trocasPlantao` e
`notificacoesTrocaPlantao`). Detalhe completo: `docs/spec/PLANTOES.md` § 34.

**Decisão estrutural mais importante**: esta fase NÃO aplica a troca na
escala publicada. `APROVADA` é um status terminal que só registra a decisão
do gestor — as Rules de `competenciasPlantao/*/atribuicoes` exigem
republicação inteira da competência com `revisao` crescente, e o modelo
BASE→OVERRIDE→EFETIVA que permitiria uma troca cirúrgica está reservado mas
não implementado (PLANTÃO-6). O ajuste real na escala publicada continua
sendo edição manual do coordenador no Dashboard; a UI do App deixa isso
explícito sempre que mostra uma troca `APROVADA` ou aguardando aprovação.

Fluxo: colaborador escolhe um dos próprios plantões futuros → escolhe um
plantão futuro de outro participante ativo do mesmo Grupo → confirma
(`PENDENTE_USUARIO`) → colega aceita (`PENDENTE_GESTOR`) ou recusa
(`RECUSADA_USUARIO`) → quem administra o Grupo (Matriz operacional
`PLANTAO`) aprova (`APROVADA`) ou recusa (`RECUSADA_GESTOR`) — a decisão
acontece no próprio App (bloco "Aprovações de Plantão" na tela Trocas),
não no Dashboard: a escrita de aprovação não muda a escala publicada, só o
documento da troca, então não depende do modo de escrita administrativa do
ambiente. Só participante ATIVO do Grupo pode solicitar/receber troca —
quem só consulta o Grupo (`equipesConsulta`) nunca aparece como
solicitante/destinatário nem lista trocas de terceiros.

Regras de negócio validadas nesta fase (`validarNovaSolicitacaoTrocaPlantao`,
`lib/trocasPlantao.ts`): ambos os plantões são futuros; mesmo Grupo de
Plantão; solicitante e destinatário participantes ativos; não é possível
trocar consigo mesmo; não há troca ativa duplicada para nenhum dos dois
plantões. Deliberadamente NÃO valida (fica para fases futuras, se algum dia
forem necessárias): descanso mínimo, conflito com Jornada, limite de horas,
regra 6x1, sobreposição complexa de intervalos.

Notificação ao gestor usa só a Matriz operacional
(`escoposOperacionais/PLANTAO_{grupoId}`) — nunca hardcoda nome/cargo. Sem
Matriz configurada para o Grupo, ninguém recebe notificação dirigida, mas a
troca continua visível a quem abrir a fila de aprovação.

## 6. O que esta fase explicitamente NÃO faz

- Não altera o modelo persistente de Plantão
  (`packages/contrato/src/modeloPlantaoPersistente.ts`), exceto pela
  reutilização do campo `contatos` já existente.
- Não aplica a troca de Plantão na escala publicada — `APROVADA` é
  decisão registrada, não efetivação (ver seção 5).
- Não dá ao App nenhuma escrita administrativa de Plantão (grupo,
  participante, publicação, rascunho) — só leitura da competência publicada,
  a escrita pessoal de contatos, e agora a criação/resposta/decisão de
  trocas de Plantão (coleção própria, sem tocar em escala publicada).
- Não usa `localStorage` como fonte de escala.
- Não altera a Jornada SOC, a tela "Hoje" nem o fluxo de Trocas de Jornada
  6x1 existente.
- Não estende o push (FCM) para notificações de troca de Plantão nesta
  fase — o sino in-app (Firestore em tempo real) cobre os 4 eventos
  pedidos; push fica para uma fase seguinte.

## 7. FASE-APP-OPERACOES-UNIVERSAIS-1 — App universal por operação

As seções acima descrevem a PRIMEIRA versão da aba "Plantão" — nesse ponto,
um usuário sem Jornada 6x1 publicada, mas com Plantão de verdade
(participante ou com consulta liberada), ainda via o alerta vermelho
GLOBAL "Nenhuma jornada 6x1 encontrada para este período." no topo do App:
tecnicamente verdadeiro, mas ruim para UX, e a aba "Equipe" continuava
mostrando só a equipe da Jornada (aparecendo vazia para quem só tinha
Plantão).

Esta fase introduziu `apps/app/src/operacoesApp.ts` — módulo puro (sem
DOM/React/Firebase, mesmo princípio de `plantaoApp.ts`/`hojeConsulta.ts`)
que resolve, para um usuário e uma competência, quais **operações**
(`JORNADA`, `PLANTAO`) existem e estão `publicada`/`sem-escala`:
`resolverOperacoesApp`, `derivarEstadoGlobalApp`, `temJornadaPublicada`,
`temPlantaoPublicado`, `operacaoPrincipalHoje`. Nenhuma tela decide mais
sozinha, a partir de uma string de erro solta, se deve tratar a ausência
de Jornada como problema.

Mudanças de comportamento no `EmployeeApp`:

- **Carga eager do Plantão** — `carregarPlantaoApp()` deixou de rodar só
  na primeira vez que a aba "Plantão"/"Perfil" abre e passou a rodar assim
  que o login termina (`useEffect` disparado por `usuario`, não mais por
  `tela`). É o que permite Hoje/Agenda/Equipe/Trocas saberem se existe
  Plantão publicado ANTES de o usuário abrir a aba Plantão.
- **`mensagemAusenciaEscalaAcao()` foi removida** — a ausência de Jornada
  deixou de setar o alerta vermelho global (`erro`). Cada tela decide,
  via `operacoesApp.ts`, o que mostrar quando falta uma das duas operações
  — nunca um erro global só por isso. O alerta vermelho global continua
  existindo, mas só para erro real de Firestore/Auth (`mensagemErroFirebase`).
- **Hoje** — mostra o card de Jornada e/ou o card de Plantão (`PlantaoHojeCard`,
  reaproveitando `resolverPlantaoAgora` de `plantaoApp.ts`) conforme o que
  está publicado; um aviso contextual (`alert warning`, não vermelho)
  quando só falta a Jornada; e um estado vazio amigável quando não há
  nenhuma das duas.
- **Agenda ("minha")** — com as duas operações publicadas, um seletor
  "Jornada 6x1" / "Plantão" decide o que mostrar (reaproveitando
  `CalendarioPlantaoApp` para o lado Plantão); com só uma, ela aparece
  direto, sem seletor; o subtítulo do cabeçalho reflete o que existe.
- **Equipe** — mostra "Participantes do Plantão" (nome + contatos ativos)
  quando o contexto é Plantão, com o mesmo seletor quando as duas
  operações existem — nunca mais "0 colaboradores" para quem só tem
  Plantão.
- **Trocas** — sem Jornada publicada, mostra a limitação dentro do bloco
  "Trocas de Jornada 6x1" ("...não estão disponíveis..."), nunca o alerta
  global; o bloco "Trocas de Plantão" é independente e mostra seu próprio
  fluxo real desde FASE-TROCAS-PLANTAO-1 (ver § 5) — nenhum dos dois blocos
  desliga o outro nem a tela inteira.
- **Messaging** — `assinarMensagensEmPrimeiroPlano()` (que pode lançar
  síncrono em ambientes sem suporte a `getMessaging()`) passou a rodar
  dentro de um `try/catch` com `console.warn` — o App nunca fica em branco
  por causa de Push indisponível.

Nada muda em Firestore Rules, seed/staging, Dashboard ou no modelo de
Plantão — ver `apps/app/src/operacoesApp.test.ts` e
`tests/app-plantao-visualizacao-boundaries.test.mjs` (testes 14–20) para a
cobertura desta fase.

## 8. Clique no dia do calendário (FASE-TROCAS-PLANTAO-1)

Clicar num dia do calendário mensal de Plantão (`CalendarioPlantaoApp`)
abre `DetalheDiaPlantao` — um modal (bottom sheet no mobile, via
`.modal-backdrop-sheet`) com data, plantonista (nome + iniciais + login),
horário civil (`formatarIntervaloPlantaoCivil` — nunca finge que um dia
diferente é "hoje"), contatos ativos, badge "Você" quando é o próprio
usuário, e "Nenhum plantão neste dia." quando vazio. Nunca usa `alert()`.
Se o dia clicado tem um plantão futuro do próprio usuário, um botão
"Solicitar troca deste plantão" abre o assistente de troca já no passo 2.
