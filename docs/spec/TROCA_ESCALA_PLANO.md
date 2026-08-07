# Plano técnico — Troca de escala entre colaboradores

Fase atual: **planejamento + protótipo visual navegável, sem escrita real no
Firebase**. Nada neste documento foi implementado como escrita; o que existe
hoje em código são módulos puros (funções sem SDK do Firestore) e o protótipo
de tela descrito na seção 8.

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
