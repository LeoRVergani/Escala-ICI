# Especificação e estado atual — Troca de escala entre colaboradores

## Nota de estado atual

Este documento nasceu como um plano técnico de design (seção "Anexo histórico"
abaixo, preservada sem alteração de conteúdo). O modelo então proposto — 8
status, com uma etapa `APROVADA_AGUARDANDO_PUBLICACAO` distinta da publicação
— **não é o modelo implementado**. A funcionalidade evoluiu para um MVP real,
com escrita de verdade no Firestore, e o modelo final ficou mais simples: o
gestor aprova e publica no mesmo passo, resultando em **7 status**, não 8.

A partir daqui, este documento passa a ser a especificação do estado real
implementado. A seção "Anexo histórico" ao final permanece como registro da
decisão de design original — não deve ser lida como descrição do comportamento
atual.

**Fonte canônica**: `lib/trocasEscala.ts` (modelo de domínio — tipos, estados,
transições, validação, snapshot). Não confundir com:
- `lib/trocaEscala.ts` (singular) — contrato histórico de 5 estados da Fase
  3K-D1/D2, **não usado por nenhuma tela** hoje. Mantido só por seus próprios
  testes (`lib/trocaEscala.test.ts`), sem relação com o fluxo real.
- `lib/trocaEscalaMock.ts` — protótipo visual em memória (8 status, incluindo
  `APROVADA_AGUARDANDO_PUBLICACAO`) da fase de design deste mesmo documento.
  Isolado, só de apresentação, não lê nem escreve Firestore.

Persistência real: `lib/firebase/trocasRepository.ts`. Regras reais:
`firestore.rules` (blocos `trocasEscala` e `notificacoesTroca`). App
(`apps/app/src/EmployeeApp.tsx`) e Dashboard
(`apps/dashboard/src/DashboardApp.tsx`) têm fluxo real e completo sobre esses
módulos — nenhuma tela usa mock ou dado em memória para Trocas.

### Modelo real de estados (7)

```
PENDENTE_USUARIO
RECUSADA_USUARIO
CANCELADA_SOLICITANTE
PENDENTE_GESTOR
RECUSADA_GESTOR
APROVADA_PUBLICADA
EXPIRADA
```

Definidos em `lib/trocasEscala.ts` (`StatusTroca`). Diferença central em
relação ao plano original: **não existe `APROVADA_AGUARDANDO_PUBLICACAO`** —
aprovação e aplicação/publicação da troca ocorrem no mesmo evento
(`gestorAprovarEPublicarTroca`, que grava `aprovadoEm` e `publicadoEm` com o
mesmo timestamp). `EXPIRADA` existe no tipo e nas tabelas de rótulo/severidade,
mas hoje **não há nenhuma transição real que leve a esse estado** — não existe
expiração automática implementada (nem cron, nem checagem client-side); é uma
Fase 6 ainda não construída.

Transições reais (`TRANSICOES_TROCA_REAL`, `lib/trocasEscala.ts`):

```
PENDENTE_USUARIO → RECUSADA_USUARIO | PENDENTE_GESTOR | CANCELADA_SOLICITANTE
PENDENTE_GESTOR  → RECUSADA_GESTOR | APROVADA_PUBLICADA
```

Todos os demais estados são terminais.

### Atores e fluxo

1. **Colaborador A (solicitante)** solicita a troca de um dia com o
   colaborador B, pelo App. `criarSolicitacaoTroca`
   (`lib/firebase/trocasRepository.ts`) valida via
   `validarNovaSolicitacaoTroca` (mesmo dia, os dois usuários ativos, os dois
   turnos definidos e diferentes entre si) e grava `PENDENTE_USUARIO`,
   registrando `snapshotValidacao` (código do turno original de cada um) e
   criando a notificação `TROCA_SOLICITADA` no mesmo `writeBatch`.
2. **Colaborador B (destinatário)** aceita ou recusa pelo App
   (`responderSolicitacaoTroca`). Aceitar → `PENDENTE_GESTOR`; recusar →
   `RECUSADA_USUARIO`. Gera notificação (`TROCA_ACEITA_AGUARDANDO_GESTOR` ou
   `TROCA_RECUSADA_USUARIO`).
3. **Gestor** decide pelo Dashboard: `gestorRecusarTroca` (→
   `RECUSADA_GESTOR`) ou `gestorAprovarEPublicarTroca` (→
   `APROVADA_PUBLICADA`, dentro de uma `runTransaction` — o único ponto do
   projeto que usa transação Firestore para Trocas). A aprovação **não** passa
   pelo pipeline geral de `publicarEscalas`/revisão — grava diretamente nos
   dois documentos `turnosMes` afetados, dentro da mesma transação. Decisão de
   MVP: sem revisão/rollback dedicado para trocas, só o `historico` do próprio
   documento da troca.
4. **Solicitante** pode cancelar a própria solicitação
   (`cancelarSolicitacaoTroca`) enquanto ainda estiver `PENDENTE_USUARIO` → `CANCELADA_SOLICITANTE`.

### Elegibilidade e restrições

- Restrita ao **mesmo dia** — o modelo real usa um único campo `data` (não há
  `dataSolicitante`/`dataDestinatario` distintos como no plano original); a
  troca sempre inverte os dois turnos do mesmo dia entre as duas pessoas
  (`aplicarTrocaNosDias`).
- Restrita à **mesma equipe e mesma competência** — garantida pelas Firestore
  Rules (`equipeId == minhaEquipe()` no `create`) e pela revalidação de
  `equipeId`/`competencia` dos dois `turnosMes` dentro da transação de
  aprovação. `validarNovaSolicitacaoTroca` em si não recebe `equipeId` como
  parâmetro — a garantia de equipe vem das Rules e da lista de colegas exibida
  pelo App, não de uma checagem explícita na função de validação.
- Os dois usuários precisam estar `ativo`.
- Os dois turnos do dia precisam existir e ser diferentes entre si.

### Revalidação de snapshot

`SnapshotValidacaoTroca` grava o código do turno original de cada colaborador
no momento da criação. Na aprovação, dentro da `runTransaction`,
`trocaDesatualizada()` compara o código atual do turno contra o snapshot; se a
escala mudou desde a solicitação, a aprovação é rejeitada com erro explícito
("A escala mudou desde que a troca foi solicitada..."). A mesma transação
revalida `equipeId`/`competencia` dos `turnosMes` e o campo `ativo` dos dois
usuários.

### Aplicação transacional

Só `gestorAprovarEPublicarTroca` usa `runTransaction` (as demais operações
usam `writeBatch`, atômico mas sem releitura consistente). A transação relê
`trocasEscala` + os dois `turnosMes` + os dois `usuarios` no momento da
aprovação antes de gravar, para proteger contra concorrência (escala mudou,
usuário desativado, etc., entre a solicitação e a decisão do gestor).

### Histórico

Campo `historico: EventoHistoricoTroca[]` embutido no documento da troca —
cada evento tem `tipo`, `porLogin`, `porNome`, `porPerfil`
(`SOLICITANTE`/`DESTINATARIO`/`GESTOR`/`SISTEMA`), `em`, `descricao`. As
Firestore Rules exigem que o array só cresça (`historico.size()` maior que o
anterior a cada `update`), nunca é reescrito por trás.

### Notificações (`notificacoesTroca`)

Documento por notificação: `destinatarioLogin`, `equipeId`, `tipo`
(`TROCA_SOLICITADA`, `TROCA_RECUSADA_USUARIO`,
`TROCA_ACEITA_AGUARDANDO_GESTOR`, `TROCA_RECUSADA_GESTOR`,
`TROCA_APROVADA_PUBLICADA`, `TROCA_CANCELADA`), `titulo`, `mensagem`,
`trocaId`, `criadoPorLogin`, `criadoEm`, `lidaEm` (server-side, não mais
`localStorage` como no plano original), `acao` (hoje só `'ABRIR_TROCA'`).
Autonotificação é evitada deliberadamente (`criadoPorLogin === destinatarioLogin`
não gera notificação). O push-worker (`apps/push-worker`) apenas observa esta
coleção e retransmite como push as notificações elegíveis — nunca decide regra
de domínio, só transporta (ver `docs/operacao/PUSH-FCM-OPERACAO.md`).

### Consultas e índices

`lib/firebase/trocasRepository.ts` expõe observadores em tempo real:
`observarTrocasDoUsuario` (uma query por papel — solicitante e destinatário —
mescladas em memória, evitando `or()`), `observarTrocasDoGestor` (toda a
competência da equipe, filtro de aba no cliente),
`observarNotificacoesTroca` (por `destinatarioLogin`, campo único, sem índice
composto). Índices compostos declarados para `trocasEscala`: `equipeId +
competencia + status`, `equipeId + competencia + solicitanteLogin`, `equipeId
+ competencia + destinatarioLogin`.

### Regras reais (resumo)

`trocasEscala`: `get` exige ser gestor da equipe, solicitante ou destinatário;
`list` exige só pertencer à equipe (efeito colateral aceito e documentado no
próprio `firestore.rules` — qualquer colega da equipe pode listar todas as
trocas da equipe, não só as próprias, mesmo nível de exposição de
`turnosMes`); `create` só o próprio solicitante, status inicial obrigatório
`PENDENTE_USUARIO`; `update` só nas transições exatas da tabela acima, por
quem tem o papel certo, com histórico sempre crescente; `delete` só
`ADMIN_SISTEMA` (usado ao excluir conta de usuário). `notificacoesTroca`:
leitura só do próprio destinatário (ou admin); `update` só pode alterar
`lidaEm`.

### Comportamento no App e no Dashboard

**App**: aba "Trocas" na navegação, sino de notificações de troca
(`TrocaNotificationBell`), ação contextual "Solicitar troca deste dia" no
detalhe do dia, assistente de nova solicitação, modal de resposta do
destinatário, modal de detalhe com histórico (cancelamento só disponível ao
solicitante enquanto `PENDENTE_USUARIO`), deep-link `?trocaId=...` integrado
ao clique de notificação push.

**Dashboard**: item lateral "Trocas" com contadores por status e filtros
(pendentes/aprovadas/recusadas/histórico), card "Trocas pendentes" na Visão
geral, modal de detalhe do gestor com comparação lado a lado dos dois turnos e
simulação dos alertas de 6x1/descanso mínimo (`lib/alertasEscala.ts`) sobre o
resultado hipotético da troca antes de aprovar. Ações do gestor sobre trocas
em modo simulação são auditadas (`auditoriaAdmin`).

### Riscos e limitações do MVP

- `EXPIRADA` não tem mecanismo de expiração automática implementado.
- Checagem de duplicidade de solicitação ativa para o mesmo dia é
  best-effort, comentada como tal no próprio repositório — as Firestore Rules
  não conseguem, sozinhas, impedir uma segunda solicitação concorrente.
- `validarNovaSolicitacaoTroca` não valida explicitamente "mesma equipe" entre
  solicitante e destinatário — depende das Rules e da lista de colegas exibida
  pela UI.
- `list` de `trocasEscala` expõe todas as trocas da equipe a qualquer membro
  dela, não só as próprias — decisão aceita, mesma classe de exposição já
  existente em `turnosMes`.
- Não existe notificação de gestor sobre troca pendente de aprovação como
  push (o domínio nunca cria `notificacoesTroca` com destinatário gestor) —
  pendência de domínio, não de transporte.
- Aprovação de troca não gera revisão/rollback dedicado como
  `publicarEscalas` gera para publicações normais.

### Evolução futura (não implementada)

- Expiração automática de solicitações antigas (`EXPIRADA`).
- Notificação de gestor sobre fila de trocas pendentes.
- Revisão/rollback dedicado para trocas aplicadas.

---

## Anexo histórico — plano original de design (preservado sem alteração)

As seções abaixo são o documento original, escrito na fase de planejamento
(2026-08-05), quando a funcionalidade era só um protótipo visual em memória.
Preservado para registro da decisão de design e do raciocínio que levou ao
modelo real (que divergiu, sobretudo na fusão de aprovação+publicação e na
redução de 8 para 7 status). Não descreve o comportamento atual — ver seção
acima.

Fase na época: **planejamento + protótipo visual navegável, sem escrita real
no Firebase**. Nada neste anexo foi implementado como escrita; o que existia
em código eram módulos puros (funções sem SDK do Firestore) e o protótipo de
tela descrito na seção 8 abaixo.

## 1. Achado principal — isto não parte do zero

Antes de desenhar qualquer coisa nova, vale registrar o que **já existe e não
estava mencionado no pedido**: a Fase 3K-D1/3K-D2 já deixou um contrato e um
módulo de validação prontos, propositalmente não implementados, para esta
mesma funcionalidade:

- `lib/modelos.ts:106-157` — `StatusSolicitacaoTroca`, `AtorSolicitacaoTroca`,
  `DiaSolicitacaoTroca`, `NovaSolicitacaoTroca`, `SolicitacaoTroca`.
- `lib/trocaEscala.ts` (223 linhas) — módulo puro: `validarSolicitacaoTroca`,
  `montarSolicitacaoTroca`, `validarElegibilidadeTroca`,
  `solicitacaoDesatualizada`, tabela de transições `TRANSICOES_SOLICITACAO_TROCA`,
  `transicaoPermitidaNoApp`.
- `lib/trocaEscala.test.ts` (241 linhas, 72 casos) — já cobre esse módulo.
- `CHECKPOINT-FASE-3K-D1.md` (seção "Desenho inicial da troca de escala") e
  `CHECKPOINT-FASE-3K-D2.md` (seção "Base da troca de escala") — decisões já
  registradas, inclusive um esboço de Firestore Rules (não aplicado).

**Consequência prática**: este plano não é um desenho novo — é uma revisão do
desenho existente à luz dos requisitos desta rodada, apontando exatamente onde
ele precisa evoluir e onde já está pronto para reaproveitar.

## 2. Decisão necessária — modelo de status

O desenho antigo usa 5 status e **não modela uma etapa distinta de aceite do
destinatário**:

```
PENDENTE → CANCELADA (colaborador)
PENDENTE → RECUSADA | APROVADA (gestor)
APROVADA → APLICADA | RECUSADA (gestor)
```

`ATOR_POR_STATUS` do módulo atual atribui `RECUSADA` e `APROVADA` sempre ao
`GESTOR` — ou seja, no desenho de 2026-08-05, era o **gestor** quem "aceitava"
a troca, sem um passo separado para o colaborador B confirmar antes.

O fluxo desta rodada pede explicitamente uma etapa a mais: o colaborador B
aceita ou recusa **antes** de a solicitação chegar ao gestor. Isso não cabe no
modelo de 5 status sem sobrecarregar `PENDENTE` com dois significados
diferentes (aguardando B vs. aguardando gestor).

**Proposta**: adotar o modelo de 8 status já sugerido no pedido, como evolução
explícita do desenho de 3K-D1/3K-D2 — não uma substituição por outro projeto,
mas o mesmo desenho ganhando o estágio que faltava:

| Status | Ator que decide o próximo passo | Equivalente no desenho antigo |
| --- | --- | --- |
| `PENDENTE_USUARIO` | Colaborador B | `PENDENTE` (parcial — faltava este recorte) |
| `RECUSADA_USUARIO` | — (terminal) | não existia |
| `CANCELADA_SOLICITANTE` | — (terminal) | `CANCELADA` |
| `PENDENTE_GESTOR` | Gestor | `PENDENTE` (parcial) |
| `RECUSADA_GESTOR` | — (terminal) | `RECUSADA` |
| `APROVADA_AGUARDANDO_PUBLICACAO` | Gestor | `APROVADA` |
| `APROVADA_PUBLICADA` | — (terminal) | `APLICADA` |
| `EXPIRADA` | — (terminal) | não existia |

Nova tabela de transições proposta:

```
—                                  → PENDENTE_USUARIO        (solicitante, App)
PENDENTE_USUARIO                   → CANCELADA_SOLICITANTE   (solicitante, App)
PENDENTE_USUARIO                   → RECUSADA_USUARIO        (destinatário, App)
PENDENTE_USUARIO                   → PENDENTE_GESTOR         (destinatário, App)
PENDENTE_USUARIO                   → EXPIRADA                (sistema, prazo)
PENDENTE_GESTOR                     → RECUSADA_GESTOR         (gestor, Dashboard)
PENDENTE_GESTOR                     → APROVADA_AGUARDANDO_PUBLICACAO (gestor, Dashboard)
APROVADA_AGUARDANDO_PUBLICACAO      → APROVADA_PUBLICADA      (gestor, Dashboard)
```

Todos os demais estados são terminais (sem transições de saída) — mesmo
princípio do desenho atual (`CANCELADA`/`RECUSADA`/`APLICADA` já eram
terminais).

**Custo desta mudança** (não pago nesta fase, ver seção 9): `lib/modelos.ts` e
`lib/trocaEscala.ts` precisam ser atualizados para os 8 status, e os 72 testes
de `lib/trocaEscala.test.ts` precisam ser reescritos para o novo vocabulário.
Nesta fase, o protótipo usa um tipo local só de apresentação (seção 8) —
**não** importa nem altera `lib/trocaEscala.ts`, exatamente para não quebrar
os 72 testes existentes antes de decidirmos migrar de fato.

## 3. O que já existe e será reaproveitado (sem lógica nova)

| Necessidade | Onde já existe | Como reaproveitar |
| --- | --- | --- |
| Notificar usuário no App | `NotificationBell` + `EventoEscala` + `observarEventosEscala` (`apps/app/src/EmployeeApp.tsx:485-550`, `lib/firebase/readRepository.ts`) | Mesmo padrão visual (badge, popover, ícone Bell/BellRing); tipo de evento novo (`TROCA_SOLICITADA` etc.), não uma central nova |
| Notificar gestor no Dashboard | `AlertasOperacionaisBell` (`apps/dashboard/src/DashboardApp.tsx:263-339`) | Mesmo padrão visual; card fixo "Trocas pendentes" na Visão geral (como já existe "Alertas da escala") é mais visível que só o sino |
| Histórico com quem/quando | `PublicacaoEscala`/`EventoEscala`: timestamp + autor embutidos no próprio documento de negócio, sem coleção de auditoria genérica (`lib/modelos.ts:74-75,92-93`) | `historico[]` embutido no próprio doc de `trocasEscala` (ver seção 6) — mesmo princípio, adaptado: aqui a lista é curta e limitada a uma troca, não precisa de coleção separada como `eventosEscala` (que cresce por competência inteira) |
| Verificar 6x1 / descanso < 11h antes de aprovar | `lib/alertasEscala.ts`: `detectarSequencias6x1`, `temDescansoInsuficiente`, `calcularIntervaloDescansoHoras` | Chamar essas funções sobre a escala **hipotética pós-troca** (os dois `TurnosMes` com os dias trocados) na tela de detalhe do gestor — nenhuma função nova de cálculo |
| Decidir quem é gestor | `lib/sessao.ts`: `nivelPermiteDashboard`/`NIVEL_MAXIMO_GESTOR` | Reaproveitar em vez de repetir `<= 5` de novo (o projeto já tem essa duplicação entre `lib/sessao.ts` e `components/AppFrame.tsx:194/212` — não introduzir uma terceira) |
| Ícone de navegação "Trocas" | `components/AppFrame.tsx:4-37` (`ICONES`, união fechada `ItemNavegacao['icone']`) | Estender a união com `'trocas'` e mapear para `ArrowLeftRight` (lucide-react, já é dependência do projeto, só falta importar) |
| Modal de detalhe | `.modal-backdrop`/`.edit-modal`/`.panel-title`/`.rollback-actions` (`alertaSelecionado`, `revisaoParaRestaurar`, `publicacaoPendente` em `DashboardApp.tsx`) | Mesmo esqueleto CSS para o modal de resposta do usuário B e o detalhe do gestor |
| Comparar dois turnos lado a lado | **Não existe pronto.** O mais próximo é `.history-before`/`.history-after` com `ArrowUpRight` no meio (`DashboardApp.tsx:1694-1715`), usado para "antes → depois" de uma pessoa só | Desenhar duas colunas (`.troca-comparacao`) inspiradas nesse par de classes, mas para duas pessoas em paralelo — único componente visual genuinamente novo neste plano |
| Aplicar a troca na escala publicada | `lib/firebase/writeRepository.ts`: `publicarEscalas` (já monta diff via `lib/revisoes.ts` e cria revisão/eventos) | Fase futura de escrita: uma aprovação de troca gera um diff pontual (2 dias, 2 pessoas) e entra pelo mesmo `publicarEscalas`, preservando "uma única origem de escrita" — não criar um segundo caminho de gravação de `turnosMes` |

## 4. Divergência a corrigir no esboço antigo de regras

O esboço em `CHECKPOINT-FASE-3K-D1.md` (linhas 95-106) compara
`request.auth.uid` diretamente:

```
allow create: if autenticado()
  && request.resource.data.solicitanteUid == request.auth.uid
```

Isso **não bate** com o padrão atual de `firestore.rules`, que resolve a
identidade por `loginDoAuth()` (e-mail → login, sem depender de custom claim
nem de `usuarios/{uid}`):

```
function loginDoAuth() {
  return request.auth.token.email.lower().split('@')[0];
}
```

Esse esboço é de antes da fase que unificou o login como chave funcional. A
seção 7 já corrige isso: qualquer regra futura para `trocasEscala` deve
comparar contra `loginDoAuth()`, nunca `request.auth.uid` — mesmo idioma já
usado em `usuarios/{login}`, `turnosMes`, `eventosEscala`.

## 5. Escopo de escrita do App — a mudança arquitetural mais sensível

Hoje o App do colaborador é **somente leitura** na escala (confirmado em
README/checkpoints: nunca escreve `turnosMes`, `rascunhosTurnosMes`,
`versoesEscala`, `publicacoesEscala`, `eventosEscala`). A troca de escala é a
**primeira vez** que o App precisaria escrever algo no Firestore.

O desenho de 3K-D1 já limitava isso ao menor escopo possível — e este plano
mantém esse limite, só ajustando para os novos estágios:

- App pode criar `trocasEscala` (status inicial `PENDENTE_USUARIO`);
- App pode mover para `RECUSADA_USUARIO` ou `PENDENTE_GESTOR` (só o
  destinatário, só a própria solicitação);
- App pode mover para `CANCELADA_SOLICITANTE` (só o solicitante, só enquanto
  `PENDENTE_USUARIO`);
- App **nunca** aprova, recusa em nome do gestor, nem toca `turnosMes` direta
  ou indiretamente;
- Toda transição pro lado do gestor (`PENDENTE_GESTOR → *`) é exclusividade do
  Dashboard.

## 6. Modelo de dados proposto (Firestore) — documentação, não implementado

```
trocasEscala/{trocaId}
```

Campos (nomes exatamente como pedido, com a decisão de usar só login — sem
campos "Uid" redundantes, diferente do desenho antigo que tinha os dois):

```ts
interface SolicitacaoTrocaV2 {
  id: string;
  equipeId: string;
  competencia: string;
  revisaoBase: number;               // herdado do desenho antigo — detecta escala mudada

  solicitanteLogin: string;
  solicitanteNome: string;
  destinatarioLogin: string;
  destinatarioNome: string;

  dataSolicitante: string;
  turnoSolicitanteAntes: string | null;
  horarioSolicitanteAntes: string | null;

  dataDestinatario: string;
  turnoDestinatarioAntes: string | null;
  horarioDestinatarioAntes: string | null;

  status: StatusSolicitacaoTrocaV2;   // os 8 valores da seção 2
  mensagemSolicitante: string;

  criadoEm: string;
  atualizadoEm: string;
  respondidoEm: string | null;        // usuário B aceitou/recusou
  aprovadoEm: string | null;           // gestor decidiu
  publicadoEm: string | null;          // troca efetivamente publicada

  gestorLogin: string | null;
  gestorNome: string | null;
  motivoRecusa: string | null;

  historico: Array<{
    em: string;
    ator: 'SOLICITANTE' | 'DESTINATARIO' | 'GESTOR' | 'SISTEMA';
    atorLogin: string | null;
    acao: string;       // ex.: "Solicitação criada", "Aceite do destinatário"
    detalhe?: string;
  }>;
}
```

Por que `historico` é um array embutido (e não uma coleção separada, como
`eventosEscala`/`historicoPublicacoes`): uma troca tem um ciclo de vida curto
e limitado a poucos eventos (tipicamente 3 a 6). `eventosEscala` precisa ser
coleção separada porque cresce por competência inteira, com muitos
colaboradores e revisões — escala diferente de problema.

## 7. Esboço de Firestore Rules (documentação — não aplicado nesta fase)

```
match /trocasEscala/{id} {
  allow read: if autenticado()
    && resource.data.equipeId == minhaEquipe()
    && (
      souGestor()
      || resource.data.solicitanteLogin == loginDoAuth()
      || resource.data.destinatarioLogin == loginDoAuth()
    );

  allow create: if autenticado()
    && request.resource.data.equipeId == minhaEquipe()
    && request.resource.data.solicitanteLogin == loginDoAuth()
    && request.resource.data.destinatarioLogin != loginDoAuth()
    && request.resource.data.status == 'PENDENTE_USUARIO';

  allow update: if autenticado()
    && resource.data.equipeId == minhaEquipe()
    && (
      // destinatário responde a própria solicitação
      (
        resource.data.destinatarioLogin == loginDoAuth()
        && resource.data.status == 'PENDENTE_USUARIO'
        && request.resource.data.status in ['RECUSADA_USUARIO', 'PENDENTE_GESTOR']
      )
      // solicitante cancela a própria solicitação, só enquanto pendente de usuário
      || (
        resource.data.solicitanteLogin == loginDoAuth()
        && resource.data.status == 'PENDENTE_USUARIO'
        && request.resource.data.status == 'CANCELADA_SOLICITANTE'
      )
      // gestor decide, só a partir de PENDENTE_GESTOR ou APROVADA_AGUARDANDO_PUBLICACAO
      || (
        souGestor()
        && resource.data.status in ['PENDENTE_GESTOR', 'APROVADA_AGUARDANDO_PUBLICACAO']
        && request.resource.data.status in [
          'RECUSADA_GESTOR', 'APROVADA_AGUARDANDO_PUBLICACAO', 'APROVADA_PUBLICADA'
        ]
      )
    )
    // histórico só cresce, nunca é reescrito por trás
    && request.resource.data.historico.size() > resource.data.historico.size();

  allow delete: if false;
}
```

Pontos que precisam de teste de fronteira (`tests/firebase/firestore.rules.test.ts`)
quando esta fase for implementada: usuário comum não altera troca de outra
equipe; destinatário não aprova em nome do gestor; solicitante não pula
direto para `APROVADA_PUBLICADA`; transição fora da tabela da seção 2 é
recusada mesmo que o autor esteja certo (ex.: gestor tentando `PENDENTE_USUARIO
→ APROVADA_PUBLICADA` direto).

## 8. Protótipo visual entregue nesta fase

Sem nenhuma leitura/escrita no Firebase — dados 100% em memória
(`lib/trocaEscalaMock.ts`), usando o vocabulário de 8 status da seção 2.

**App (`apps/app/src/EmployeeApp.tsx`)**:
- Nova aba "Trocas" na navegação principal (ícone `ArrowLeftRight`), com 4
  sub-abas internas: Minhas solicitações, Para responder, Aguardando gestor,
  Histórico.
- Fluxo "Nova solicitação" em 3 passos (escolher meu dia → escolher
  colaborador → confirmar), navegando sobre a mesma escala mockada já usada
  pela Agenda.
- Ação contextual "Solicitar troca" no detalhe do dia (`DetalheDia`), que leva
  direto ao passo 2 do fluxo com o dia já preenchido.
- Modal de resposta do destinatário (aceitar/recusar), com aviso de que aceitar
  ainda depende do gestor.

**Dashboard (`apps/dashboard/src/DashboardApp.tsx`)**:
- Novo item lateral "Trocas".
- Novo card "Trocas pendentes" na Visão geral (mesmo padrão de
  `.content-grid.two-columns`/`.panel.grid-panel` já usado por "Alertas da
  escala"/"Carga por colaborador").
- Tela "Trocas": cards de contagem por status no topo, tabela com filtros
  (pendentes/aprovadas/recusadas/histórico), modal de detalhe com comparação
  lado a lado dos dois turnos e alertas de 6x1/descanso reais (calculados de
  verdade sobre os dados mockados, reaproveitando `lib/alertasEscala.ts` —
  não mockados).

Nenhuma tela chama `lib/firebase/*`; todo estado é local
(`useState`/`useMemo`) alimentado por `lib/trocaEscalaMock.ts`.

## 9. Riscos e decisões abertas

1. **Migração do modelo de status** (seção 2): `lib/trocaEscala.ts` e seus 72
   testes precisam ser reescritos antes de qualquer escrita real. Não é
   trabalho grande, mas é o primeiro passo obrigatório da próxima fase — feito
   antes de tocar em Firestore/rules.
2. **App deixa de ser só leitura** (seção 5): maior mudança arquitetural deste
   projeto até aqui. Mitigado propondo o menor escopo de escrita possível
   (uma coleção, três transições permitidas ao App) — mas precisa de revisão
   humana explícita antes da fase de escrita, não só dos testes.
3. **"Lido/não lido" hoje é só `localStorage`** (`NotificationBell`, chave
   `escala-ici-notificacoes-lidas-{login}`), não sincroniza entre
   dispositivos. Notificações de troca provavelmente precisam de estado
   server-side (o destinatário decidir num celular e ver refletido no
   desktop) — decisão a tomar na Fase 4, não nesta.
4. **Esboço de rules antigo usava `request.auth.uid`** (seção 4) — já
   corrigido no esboço da seção 7, mas é um lembrete de que desenhos antigos
   do repositório podem estar desatualizados frente ao padrão atual; vale
   reler antes de implementar, não só copiar.
5. **Descanso mínimo entre turnos não existia quando `trocaEscala.ts` foi
   escrito** (`CHECKPOINT-FASE-3K-D2.md` registra isso explicitamente); hoje
   existe (`lib/alertasEscala.ts`). `validarElegibilidadeTroca` pode ganhar
   essa checagem na próxima fase sem inventar cálculo novo.
6. **Concorrência**: duas solicitações podem disputar o mesmo dia/pessoa antes
   de o gestor decidir. `solicitacaoDesatualizada()` já cobre "a escala mudou
   depois da solicitação"; falta decidir a regra de "duplicar solicitação
   ativa para o mesmo dia" (pedida no enunciado) — proposta: `create` rejeitado
   se já existir doc com mesmo `solicitanteLogin` + `dataSolicitante` + status
   não terminal (checagem de unicidade só é possível com uma query antes do
   `create`, não dentro da regra — precisa ser validado na Function/client
   antes de escrever, e a regra é a segunda linha de defesa, não a primeira).

## 10. Fases seguintes propostas

- **Fase 2** — migrar `lib/modelos.ts`/`lib/trocaEscala.ts` para os 8 status;
  reescrever os 72 testes; nenhuma tela nova, nenhuma escrita.
- **Fase 3** — leitura real: Dashboard lê `trocasEscala` (coleção vazia em
  produção) via `readRepository`; App continua só com dados mockados.
  Adicionar `trocasEscala` a `firestore.rules` (só `read`), com testes de
  fronteira.
- **Fase 4** — escrita restrita: App cria solicitação e responde (aceita/
  recusa); regras de `create`/`update` da seção 7 aplicadas e testadas;
  notificação real ao destinatário (reaproveitando o padrão de
  `NotificationBell`, tipo de evento novo).
- **Fase 5** — decisão do gestor + aplicação: Dashboard aprova/recusa/publica;
  aprovação reaproveita `publicarEscalas`; notificações aos dois colaboradores;
  `historico[]` completo de ponta a ponta.
- **Fase 6** — expiração automática (`EXPIRADA`), métricas de uso, ajustes de
  UX a partir do uso real.

## 11. Confirmações desta fase

- Nenhuma escrita real no Firebase — protótipo 100% em memória.
- `firestore.rules` não foi alterado (esboço na seção 7 é só documentação).
- `lib/trocaEscala.ts` e `lib/trocaEscala.test.ts` não foram alterados — a
  migração de status (seção 2) é proposta para a Fase 2, não executada agora.
- Login corporativo é a chave usada em todo o desenho (`solicitanteLogin`/
  `destinatarioLogin`) — sem UID como identificador funcional.
- Login/parser/publicação/Dashboard/PWA existentes não foram tocados além da
  navegação nova (item de menu) e do card na Visão geral.
