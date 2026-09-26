# Checkpoint — Fase PWA-COMPETENCIAS-MULTIPERIODOS-1

## Objetivo

Corrigir o PWA do Escala ICI (App do colaborador) para trabalhar
corretamente com duas competências de escala sobrepostas no calendário
operacional (regra 26–25), sem depender de limpar cookies ou reinstalar o
PWA, e sem perder o período anterior assim que a competência seguinte é
publicada.

## Regra de negócio (26–25)

Cada escala começa no dia 26 e termina no dia 25 do mês seguinte
(`competenciaOperacional()`, `packages/contrato/src/jornada.ts`, já
existente e inalterada). Exemplo usado como cenário de regressão:

- competência anterior: `2026-09` → `26/08/2026` a `25/09/2026`;
- competência seguinte: `2026-10` → `26/09/2026` a `25/10/2026`;
- `25/09/2026` deve usar a competência anterior;
- `26/09/2026` deve usar a competência seguinte;
- nenhuma das duas pode desaparecer da visualização por causa da outra.

## Causa raiz comprovada

O App carregava e observava em tempo real **uma única competência por
vez** (`competenciaAtiva`, estado de `EmployeeApp.tsx`):

- `observarEscalasEquipe(equipeId, competenciaAtiva, setDocumentos, …)`
  (`lib/firebase/readRepository.ts`) assinava exatamente UMA competência e
  **substituía inteiramente** o estado `documentos` a cada emissão;
- assim que uma nova competência era publicada e o App recalculava
  `competenciaAtiva` para o novo valor, o `useEffect` cancelava a
  assinatura antiga (da competência anterior) e abria uma nova assinatura
  só da competência seguinte — **descartando fisicamente do estado** os
  documentos da competência anterior, mesmo que ela ainda estivesse dentro
  do seu período de vigência (até o dia 25);
- o calendário/agenda da Jornada 6x1 usavam `datas =
  Object.keys(minhaEscala?.dias ?? {})` — as datas de UM ÚNICO documento —
  então mesmo quando os dois documentos estavam carregados momentaneamente,
  o calendário não conseguia exibir os dois períodos ao mesmo tempo.

`selecionarEscalaPorData()` (contrato) já escolhia corretamente por
intervalo real (`periodoInicio <= data <= periodoFim`) — o problema nunca
foi essa função, e sim a camada de carregamento/observação nunca entregar
mais de uma competência para ela escolher.

O lado Plantão (`lib/firebase/plantaoReadRepository.ts`,
`obterCompetenciaPlantaoPublicadaNaData`) já tinha sido corrigido no commit
anterior desta branch (`98ea3cd`) e **não precisou de nenhuma mudança**
nesta fase — já consulta todas as competências do Grupo e filtra por
período real, sem depender de uma competência ativa única.

## Correção

### 1. Observação em janela de competências (não mais uma só)

`lib/firebase/readRepository.ts` ganhou
`observarEscalasEquipeMultiplasCompetencias(equipeId, competencias,
aoAtualizar, aoFalhar)`: mantém uma assinatura `onSnapshot`
(`observarEscalasEquipe`, reaproveitada sem alteração) por competência da
janela informada, cada uma com seu próprio "balde" de documentos; funde os
baldes a cada atualização. Uma publicação nova numa competência nunca
apaga o balde de outra — cada assinatura é independente.

`apps/app/src/EmployeeApp.tsx` calcula a janela com
`competenciasCandidatas(dataHoje)` (helper já existente em
`packages/contrato`, hoje devolve operacional + mês-calendário + ±1 mês),
memoizada (`janelaCompetenciasApp`, `useMemo` por `dataHoje`) para não
reabrir as assinaturas a cada render, e observa essa janela em vez de
`competenciaAtiva` sozinha.

Compatível com as Rules atuais: cada assinatura é a MESMA consulta que já
existia (`equipeId == … && competencia == … && status == 'PUBLICADA'`),
só repetida uma vez por competência da janela — nenhuma mudança em
`firestore.rules`.

### 2. Calendário/agenda mesclam as competências carregadas

`packages/contrato/src/jornada.ts` ganhou `mesclarDiasEscalas(escalas)`:
funde os `dias` de todos os documentos do usuário na janela carregada num
único mapa (datas nunca colidem entre competências reais — cada dia civil
pertence a, no máximo, um período 26–25).

Em `EmployeeApp.tsx`, `escalaVisivelApp` combina os campos de rótulo de
`minhaEscala` (a competência que cobre `dataHoje` — usada para totais,
"turno de hoje" e rótulos "Competência X") com os `dias` mesclados de
TODAS as competências carregadas do usuário. `datas`,
`CalendarioEscala`/`AgendaEscala`/`DetalheDia`/`ResumoSemana`/
`LembretesView`/`ProximosDias` passam a usar `escalaVisivelApp` — o
calendário pode navegar e exibir os dois períodos, e "Próximos dias"/
"Próximo turno" enxergam turnos da competência seguinte antes da virada do
dia 26, em vez de ficar vazios ao fim da competência atual.

### 3. Calendário civil sem deslocamento de fuso

`diaSemanaEscalaCivil()` (já existente desde o commit anterior desta
branch) continua sendo a única forma de calcular dia da semana/espaços em
branco do calendário — ancorada em meio-dia UTC, nunca `new
Date('YYYY-MM-DD')` puro nem o fuso da máquina. Cobertura nova em
`packages/contrato/test/jornada.test.ts`: `19/10/2026` é segunda (1),
`19/09/2026` é sábado (6), início em domingo gera 0 espaços, início em
segunda gera 1 espaço, e um teste geral que a saída é sempre um inteiro
0–6 independente do TZ do processo.

### 4. Férias e demais categorias preservadas

`resolverJornadaDia()` nunca filtrou por categoria — sempre devolveu o que
estivesse gravado em `dias[data]`, seja `TRABALHO`, `AUSENCIA`
(férias/atestado), `DESCANSO` (DSR/folga) ou ausente (`SEM_ESCALA`). O bug
relatado ("férias não aparecendo") era um sintoma da MESMA causa raiz: se a
data das férias pertencia à competência que tinha acabado de ser
descartada do estado, ela simplesmente não estava mais em `documentos`.
Corrigido pela mesma correção da causa raiz (item 1); teste dedicado em
`jornada.test.ts` confirma que um dia `X` (Férias) publicado na competência
anterior sobrevive à fusão e continua com `categoria: 'AUSENCIA'`
(`trabalha: false`, nunca "sem escala").

### 5. Aba Equipe não duplica colaborador

Como `documentos` agora pode conter dois documentos da MESMA pessoa
(competência anterior + seguinte, ambas publicadas), a grade da aba
"Equipe" (`ScheduleGrid`, componente compartilhado com o Dashboard — **não
alterado**) precisaria de uma linha por documento, duplicando cada colega
visualmente. `EmployeeApp.tsx` reduz para `documentosEquipeAtualApp`: um
documento por login, escolhido por `selecionarEscalaPorData(…, dataHoje)`
— o mesmo critério já usado para o próprio usuário — preservando o
comportamento anterior (uma linha por pessoa, sempre a competência vigente
agora). O contador "N colaboradores" usa a mesma lista deduplicada.

### 6. Service worker e card "Plantão de hoje"

Ambos já estavam corrigidos pelo commit inicial desta branch (`98ea3cd`) e
foram apenas **confirmados, não alterados**: `VERSION = 'fase-3k-c-v2'`,
`activate` remove caches `escala-ici-*` antigos e chama `clients.claim()`,
`skipWaiting` só via mensagem explícita, `fetch` recusa origem externa
(`url.origin !== self.location.origin`). Nenhuma chamada JSX de
`PlantaoHojeCard` existe na tela inicial (a função continua definida, mas
sem nenhum ponto de renderização) — coberto por teste estrutural novo.
`components/PwaProvider.tsx` (fora do escopo de arquivos permitidos desta
fase, não alterado) já cobre atualização segura ao voltar para a aba
(`visibilitychange` → `registro.update()`) e recarrega só depois que o
usuário confirma ("Atualizar"), sem loop de recarga automática.

## Testes executados

- `packages/contrato/test/jornada.test.ts` — 17 testes (11 novos: duas
  competências sobrepostas, `mesclarDiasEscalas`, `diaSemanaEscalaCivil`).
- `lib/firebase/readRepository.test.ts` — 14 testes (3 novos:
  `observarEscalasEquipeMultiplasCompetencias`).
- `tests/pwa-competencias-multiperiodos.test.mjs` (novo, adicionado ao
  script `test:boundaries`) — 8 testes estruturais cobrindo App, service
  worker e `readRepository`/`jornada` (mesmo estilo dos demais
  `tests/*-boundaries.test.mjs`: checagem textual, sem transpilar TS).
- `npm run test:unit` — 1489/1489 (77 arquivos).
- `npm run test:boundaries` — 507/509; as 2 falhas restantes já existiam
  ANTES desta fase (confirmado por `git stash` no commit inicial
  `98ea3cd`) e são assertões desatualizadas sobre um import do Plantão
  trocado em `98ea3cd` (`obterCompetenciaPlantaoPublicada` →
  `obterCompetenciaPlantaoPublicadaNaData`) — não relacionadas a
  competências múltiplas da Jornada 6x1 e fora do escopo desta fase.
- `npm run typecheck` e `npm run typecheck:apps` — OK.
- `npm run build:app:pages` — OK (inclui `validate-deployments.mjs
  --app-only`).
- `npm run validate:pwa` / `validate:artifact` / `validate:deployments` —
  OK.
- `git diff --check` — sem problemas de espaço em branco.

## Inspeção do artefato (`dist/apps/app/service-worker.js`)

- `VERSION = 'fase-3k-c-v2'` presente;
- prefixos de cache `escala-ici-shell-`/`escala-ici-runtime-` presentes;
- `chave.startsWith('escala-ici-')` no `activate` (remove caches antigos);
- `self.skipWaiting()` e `self.clients.claim()` presentes;
- nenhuma URL externa aceita pelo handler de `fetch` (`url.origin !==
  self.location.origin` recusa antes de responder); as três URLs
  `https://` encontradas no bundle (`fcmregistrations.googleapis.com`,
  `firebaseinstallations.googleapis.com`, `play.google.com`) são
  constantes internas do SDK do Firebase Messaging empacotado, não
  destinos aceitos pelo handler de `fetch` do service worker;
- nenhum `PlantaoHojeCard` no bundle;
- nenhum segredo (`AIza…`, chave privada) encontrado por varredura.

## Deploy

**Nenhum deploy foi realizado.** Nenhuma alteração em `firestore.rules`,
índices, projeto Firebase de produção ou dados reais. Trabalho isolado na
branch `fix/pwa-staging-correcoes`, ainda não publicada no GitHub.

## Necessidade de reteste real no staging

A correção foi validada inteiramente por testes automatizados (unitários,
estruturais, typecheck, build). **Falta o reteste manual real em
staging**, com uma escala publicada cobrindo 25/09 e 26/09 (e ao menos uma
entrada de férias), antes de considerar a fase aprovada — ver
procedimento no relatório final desta fase.
