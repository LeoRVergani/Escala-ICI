# Checkpoint — Fase 3K-D1

## Objetivo

Estabilizar a sessão do App do colaborador, fazer a atualização interna
(sininho e aviso de nova revisão) funcionar sem F5 e fixar o desenho inicial da
troca de escala, sem implementá-la.

## Causa raiz

### 1. Flicker de login no PWA instalado

O `LoginPanel` era o único responsável por observar o Firebase Auth. Como o App
renderizava `<LoginPanel />` sempre que `usuario === null`, a tela de login era
pintada por inteiro antes de o Firebase confirmar se existia sessão local. No
PWA instalado isso aparecia como um flash de login a cada abertura, mesmo com
sessão válida.

Além disso, o tema salvo só era aplicado no primeiro `requestAnimationFrame`,
provocando um segundo flash (claro → escuro) antes da montagem do React.

### 2. Sininho e escala que só atualizavam com F5

O efeito que criava os listeners dependia do objeto `usuario` e de
`competenciaAtiva`. Ele era disparado assim que `setUsuario()` acontecia, ou
seja, **antes** de `autenticar()` concluir as leituras iniciais. Consequências:

- assinatura de `turnosMes` com a competência anterior, seguida de nova
  assinatura quando `competenciaAtiva` era atualizada;
- o `setDocumentos()` da carga pontual sobrescrevia dados que já tinham chegado
  pelo `onSnapshot`, deixando a tela com a revisão antiga até um F5.

## Correção

### Restauração de sessão

- `lib/sessao.ts` (novo): contrato puro da sessão — estados
  `restaurando | ausente | ativa`, preferência "manter conectado" por produto,
  nível hierárquico do gestor e a regra de liberação dos listeners;
- `components/RestauracaoSessao.tsx` (novo): `useRestauracaoSessao()` observa o
  Auth uma única vez e só sai de `restaurando` **depois** que a carga inicial
  termina; `TelaRestaurandoSessao` é a tela "Restaurando sessão…";
- `components/LoginPanel.tsx`: deixa de observar a sessão por conta própria e
  passa a consumir o hook. Com `sessaoDelegada`, não cria um segundo
  observador. O comportamento do Dashboard permanece idêntico;
- `apps/app/src/EmployeeApp.tsx`: a tela de restauração tem prioridade sobre o
  login e sobre o conteúdo; com sessão válida o App abre direto em "Hoje";
- `apps/app/index.html`: placa inicial dentro de `#root` (o React limpa o
  container ao montar) e aplicação do tema salvo antes da primeira pintura.

### Atualização interna sem F5

- os listeners de `turnosMes` e `eventosEscala` só são criados quando a sessão
  está resolvida, o usuário do Firestore está carregado e a carga inicial
  terminou (`podeIniciarListeners`);
- o efeito passou a depender de valores primitivos (`usuarioUid`,
  `equipeUsuario`, `competenciaAtiva`, `listenersLiberados`), o que elimina a
  reassinatura dupla e a sobrescrita do snapshot pela leitura pontual;
- o aviso interno agora identifica a revisão e oferece "Ver atualizações", que
  abre a central e marca os eventos como lidos.

## Desenho inicial da troca de escala (não implementado)

Contrato fixado em `lib/modelos.ts` (`SolicitacaoTroca`, `NovaSolicitacaoTroca`,
`DiaSolicitacaoTroca`, `StatusSolicitacaoTroca`) e em `lib/trocaEscala.ts`
(módulo puro, sem SDK do Firestore e sem nenhuma mutação).

Fronteiras:

- a única coleção que o App poderá escrever no futuro é `solicitacoesTroca`;
- o App nunca escreve em `turnosMes`, `rascunhosTurnosMes`, `versoesEscala`,
  `publicacoesEscala` ou `eventosEscala`;
- o App só cria a solicitação (`PENDENTE`) e pode cancelar a própria;
- aprovar, recusar e aplicar são exclusividade do Dashboard/gestor;
- aplicar a troca reaproveita a publicação com revisão já existente, então a
  escala continua com uma única origem de escrita.

Ciclo de vida:

| De | Para | Ator |
| --- | --- | --- |
| — | `PENDENTE` | colaborador (App) |
| `PENDENTE` | `CANCELADA` | colaborador (App) |
| `PENDENTE` | `RECUSADA` / `APROVADA` | gestor (Dashboard) |
| `APROVADA` | `APLICADA` / `RECUSADA` | gestor (Dashboard) |

A solicitação guarda `revisaoBase` e a fotografia dos dois dias. Se a escala
receber nova revisão, `solicitacaoDesatualizada()` marca a pendência para
revalidação antes de aplicar.

Esboço das regras a avaliar **quando** a escrita for implementada (não
aplicado nesta fase):

```
match /solicitacoesTroca/{id} {
  allow read: if autenticado() && resource.data.equipeId == minhaEquipe()
    && (souGestor()
      || resource.data.solicitanteUid == request.auth.uid
      || resource.data.destinatarioUid == request.auth.uid);
  allow create: if autenticado()
    && request.resource.data.equipeId == minhaEquipe()
    && request.resource.data.solicitanteUid == request.auth.uid
    && request.resource.data.status == 'PENDENTE';
  allow update: if souGestor() || (cancelamento do próprio solicitante);
  allow delete: if false;
}
```

## Firestore Rules

**Não alteradas.** A escrita da troca não existe nesta fase, então
`solicitacoesTroca` continua fora de `firestore.rules` — um contrato de
fronteira garante isso. Nenhum índice novo foi necessário.

## Validação automatizada

Executado em 4 de agosto de 2026:

- `npm run typecheck` — aprovado;
- `npm run typecheck:apps` — aprovado (Dashboard e App);
- `npm run test:unit` — 72 testes aprovados;
- `npm run test:boundaries` — 30 testes aprovados;
- `npm run lint` — sem apontamentos;
- `npm run build:app` / `npm run build:app:pages` — aprovados;
- `npm run firebase:staging:preflight` — aprovado, projeto `escala-ici-staging`,
  sem expor credenciais.

`npm run build:app:staging` não pôde ser executado nesta cópia de trabalho:
`.env.staging.app` não existe (o repositório só versiona o `.example`, e o
arquivo é ignorado pelo Git). O script falha na guarda de ambiente, antes de
compilar. Para executá-lo, criar `.env.staging.app` a partir de
`.env.staging.app.example` com os dados do Web App de homologação, mantendo
`VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false`.

## Teste manual de aceite

1. abrir o PWA instalado com sessão válida e confirmar que só aparece
   "Restaurando sessão…", nunca o login;
2. confirmar que a primeira tela é "Hoje", já com a escala carregada;
3. alternar para o tema escuro, fechar e reabrir o PWA: nenhum flash claro;
4. desmarcar "manter conectado", sair e reabrir: o login aparece sem espera;
5. com o App aberto, publicar nova revisão pelo Dashboard;
6. confirmar, sem F5: aviso interno com o número da revisão, badge do sininho e
   escala atualizada;
7. usar "Ver atualizações" e confirmar que o badge zera.

## Itens preservados

- importação XLS/XLSX;
- publicação, histórico e rollback pelo Dashboard;
- leitura da escala publicada no App;
- PWA instalado, service worker e manifesto na raiz;
- App somente leitura, sem qualquer caminho de escrita;
- bloqueio de escrita oficial por padrão;
- Firebase de produção intocado.
