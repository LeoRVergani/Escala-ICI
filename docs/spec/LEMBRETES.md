# Especificação — Lembretes

Documento de estado real, escrito a partir do código, do domínio puro e das
Firestore Rules atuais (branch `feature/lembretes-consulta-dia-hoje`). Cada
afirmação aponta para a evidência que a sustenta — este documento não supõe
comportamento que não esteja implementado.

**Estado atual (pós-Fase 5.1):** domínio puro, repositories, Firestore Rules
(com hardening da Fase 4.1: sem delete físico de atribuído) e UI do App do
colaborador (`apps/app/src/lembretes/`, `components/lembretes/`) existem e
têm cobertura de teste real (unitária + Emulator). O Dashboard (Fase 5)
permite ao gestor atribuir/editar/cancelar lembretes de um colaborador do
seu escopo, direto na tela Usuários (`DashboardApp.tsx`) — reaproveita o
mesmo domínio/repository e nunca importa leitura/escrita de lembretes
pessoais (ver teste de fronteira em `tests/app-boundaries.test.mjs`). A Fase
5.1 corrigiu um `permission-denied` real em staging: a consulta
administrativa precisava filtrar também por `destinatarioEquipeId` para a
Firestore Rule aprovar o `list` (ver seção "Correção Fase 5.1" abaixo) — a
Rule em si não mudou, e o índice composto novo ainda precisa ser implantado
em staging antes do teste end-to-end funcionar sem erro de índice ausente.
Validação realtime formal (sem F5) do fluxo gestor → colaborador fica para
a Fase 6. **Não há Push** agendado — os campos de alerta são só dado (ver
seção "Alertas futuros").
Qualquer alteração visual nos componentes de Lembretes deve primeiro ler
[`UI_CASCADE_E_HERANCA.md`](UI_CASCADE_E_HERANCA.md) — os três casos reais
de bug de cascade documentados ali (botão "Hoje", chip de "Próximos
lembretes", padding herdado de `.selected-day-card`) aconteceram todos
neste módulo.

## Objetivo

Permitir que um colaborador crie lembretes pessoais (cursos, estudos,
compromissos) para qualquer data/horário, e que um gestor atribua um
lembrete a um colaborador do seu escopo organizacional (ex.: uma
capacitação obrigatória). Nome deliberado — nunca "Evento"/"EventoUsuario":
o projeto já usa `EventoEscala`/`eventosEscala` (`lib/modelos.ts`) para
publicações de escala, algo semanticamente diferente de uma anotação
pessoal ou de uma atribuição administrativa pontual.

## Domínio puro (`lib/lembretes.ts`, Fase 2)

Sem dependência de React/DOM/Firebase. Dois tipos, um conteúdo comum:

```ts
type TipoLembrete = 'PESSOAL' | 'ATRIBUIDO';
type StatusLembreteAtribuido = 'ATIVO' | 'CANCELADO';

interface HorarioLembrete {
  diaInteiro: boolean;
  horaInicio: string | null;
  horaFim: string | null;
  viraDia: boolean;
}

interface ConteudoLembrete {
  titulo: string;
  descricao: string | null;
  data: string;               // YYYY-MM-DD, civil
  horario: HorarioLembrete;
  serieId: string | null;
  alertasAntecedenciaMin: number[];
}

interface LembretePessoal extends ConteudoLembrete { tipo: 'PESSOAL'; schemaVersion: 1; }
interface LembreteAtribuido extends ConteudoLembrete {
  tipo: 'ATRIBUIDO'; schemaVersion: 1;
  destinatarioLogin: string;
  destinatarioEquipeId: string;
  criadoPorLogin: string;
  criadoPorNome: string;
  status: StatusLembreteAtribuido;
}
```

Regras de negócio relevantes (todas testadas em `lib/lembretes.test.ts`):

- **Data civil real**: `validarDataCivil()` confere calendário de verdade
  (dia existe no mês, ano bissexto) — mais rigoroso que
  `packages/contrato/src/jornada.ts` (`partesData`), que só valida o
  formato via regex.
- **Horário `HH:mm`** estrito (`validarHorario()`); dia inteiro exige
  `horaInicio`/`horaFim` nulos; sem dia inteiro, `horaInicio` é obrigatório
  e `horaFim` é opcional (lembrete pontual).
- **Vira dia**: diferente do turno de escala (onde `fim <= inicio` sempre
  significa virada, porque turno tem duração garantida positiva), um
  lembrete rejeita `horaFim === horaInicio` na validação (janela zero não
  faz sentido); `viraDia` só é `true` quando `horaFim` é estritamente menor
  que `horaInicio` (ex.: 22:00–01:00).
- **Série simples**: `criarOcorrenciasSerie()` gera uma ocorrência
  normalizada por data (deduplicadas e ordenadas), todas com o mesmo
  `serieId` — sem RRULE, sem recorrência infinita.
- **Não depende de competência 26→25**: nenhuma função do domínio chama
  `competenciaOperacional()` — um lembrete pode existir para qualquer data
  civil, independente do período operacional carregado pela Agenda.
- Título 1–120 caracteres (`LIMITE_TITULO_LEMBRETE`), descrição até 1000
  (`LIMITE_DESCRICAO_LEMBRETE`), até 5 alertas sem duplicata
  (`LIMITE_ALERTAS_LEMBRETE`).

## Coleções Firestore

```
usuarios/{login}/lembretes/{lembreteId}      — pessoal (subcoleção)
lembretesAtribuidos/{lembreteId}             — atribuído (top-level)
```

Pessoal é **subcoleção**, não um campo dentro de `usuarios/{login}`: a Rule
da subcoleção é totalmente independente da Rule do documento pai — afrouxar
uma não afrouxa a outra (`firestore.rules`, blocos separados). Atribuído é
**top-level** porque o gestor legitimamente precisa ler/gerenciar um item
que não é dele — pessoal nunca teria essa necessidade.

`lembreteId` é gerado por `gerarUuid()` (`lib/uuid.ts`), nunca a partir de
`titulo + data` nem de qualquer dado pessoal. Nenhum dos dois schemas
inclui `login`/`login do dono` no corpo do documento pessoal — o
proprietário já está determinado pelo path.

### DTO pessoal (persistido, `LembretePessoalPersistido`)

```ts
{
  lembreteId, tipo: 'PESSOAL', schemaVersion: 1,
  titulo, descricao, data, horario, serieId, alertasAntecedenciaMin,
  criadoEm, atualizadoEm,   // string ISO, nunca Timestamp/serverTimestamp()
}
```

### DTO atribuído (persistido, `LembreteAtribuidoPersistido`)

```ts
{
  lembreteId, tipo: 'ATRIBUIDO', schemaVersion: 1,
  destinatarioLogin, destinatarioEquipeId,
  titulo, descricao, data, horario, serieId, alertasAntecedenciaMin,
  criadoPorLogin, criadoPorNome,
  status: 'ATIVO' | 'CANCELADO',
  criadoEm, atualizadoEm,
  canceladoEm: string | null, canceladoPorLogin: string | null,
}
```

Timestamps seguem o padrão real do projeto (`trocasRepository.ts`,
`pushDeviceRepository.ts`): string ISO via `new Date().toISOString()`.
`canceladoEm`/`canceladoPorLogin` sempre presentes (nulos até o
cancelamento) — mesma convenção de `SolicitacaoTrocaReal.respondidoEm`/
`aprovadoEm`/`publicadoEm`.

## Privacidade e autorização

Identidade é sempre o **login corporativo derivado do e-mail autenticado**
(`loginDoAuth()`, `firestore.rules`) — nunca `request.auth.uid`, nunca
custom claims. Escopo do gestor reutiliza os helpers reais existentes:
`souGestor()`, `podeOperarNaEquipe()`, `minhasEquipesPermitidas()`
(espelham `perfilEfetivo()`/`equipesPermitidasEfetivas()` de
`lib/sessao.ts`) — nada foi inventado ou ampliado.

### Lembretes pessoais (`usuarios/{login}/lembretes/{lembreteId}`)

| Ação | Próprio dono | Outro colaborador | Gestor | ADMIN_SISTEMA |
|---|---|---|---|---|
| read/list | ✅ | ❌ | ❌ | ❌ |
| create | ✅ | ❌ | ❌ | ❌ |
| update | ✅ | ❌ | ❌ | ❌ |
| delete | ✅ | ❌ | ❌ | ❌ |

A condição de acesso é `loginDoAuth() == login` — o segmento do **path**,
nunca um campo de `resource.data`. Isso torna um `list` sem filtro
inerentemente seguro: a consulta só pode enumerar a subcoleção de UM login
por vez; não existe uma consulta "todos os lembretes pessoais de todos os
usuários" via client SDK comum. Nem `souGestor()` nem `souAdminSistema()`
têm qualquer exceção nesta coleção — administrar usuários não implica
acesso a conteúdo pessoal. Exclusão é definitiva (o usuário pode apagar o
próprio lembrete de verdade); não há histórico administrativo de lembrete
pessoal, e o gestor nunca sabe que ele existiu.

### Lembretes atribuídos (`lembretesAtribuidos/{lembreteId}`)

| Ação | Destinatário | Outro colaborador | Gestor no escopo | Gestor fora do escopo | ADMIN_SISTEMA |
|---|---|---|---|---|---|
| read/list (próprio filtro) | ✅ | ❌ | ✅ | ❌ | ❌* |
| create | ❌ | ❌ | ✅ | ❌ | ❌* |
| update | ❌ | ❌ | ✅ | ❌ | ❌* |
| delete físico | ❌ | ❌ | ❌ | ❌ | ❌ |

`*` ADMIN_SISTEMA não tem um bypass geral de escopo nesta coleção (só
`souGestor()`, que inclui `souAdminSistema()`, herda o mesmo
`podeOperarNaEquipe()` — na prática ADMIN_SISTEMA sempre passa por ser
admin, não por uma regra dedicada). **Delete físico é negado para todos,
inclusive ADMIN_SISTEMA** (revisão de hardening, Fase 4) — diferente do
precedente de `trocasEscala`/`notificacoesTroca` (que permitem delete admin
para limpeza seletiva ao excluir um usuário), aqui deliberadamente nem essa
exceção existe: atribuído é registro administrativo, o cancelamento
(`ATIVO -> CANCELADO`) já preserva histórico, e a UI nunca precisa apagar.
A pendência de retenção/limpeza ao excluir um usuário continua em aberto
(ver Riscos) — resolvê-la não pode passar por dar a gestor/admin acesso aos
lembretes pessoais.

**Validação do destinatário real** (`firestore.rules`, função
`usuarioPorLogin()`): a Rule de `create` nunca confia isoladamente em
`destinatarioEquipeId` do payload — sempre confere contra o `equipeId` real
do documento `usuarios/{destinatarioLogin}` antes de checar
`podeOperarNaEquipe()`. Isso fecha o ataque de enviar o login de alguém de
uma equipe junto com o `destinatarioEquipeId` de outra equipe (a que o
gestor administra), coberto pelo teste "ataque: equipe falsificada"
(`tests/firebase/firestore.rules.test.ts`).

**Campos imutáveis após criação**: `tipo`, `schemaVersion`,
`destinatarioLogin`, `destinatarioEquipeId`, `criadoPorLogin`,
`criadoPorNome`, `criadoEm`. `status` só anda `ATIVO -> CANCELADO`
(unidirecional — reativar exige criar um novo lembrete). `criadoPorLogin`/
`criadoPorNome` são checados contra o usuário autenticado real
(`loginDoAuth()`/`eu().nome`) na criação — nunca aceitos como dado confiável
do payload (testes "ataque: autoria falsificada").

**GESTOR_UNIDADE não pode criar/gerenciar lembretes atribuídos** — mesma
fronteira operacional que já existe para `turnosMes`/`trocasEscala`/
`eventosEscala` (todos gated por `souGestor()`, que não inclui
GESTOR_UNIDADE). Ampliar isso seria dar ao GESTOR_UNIDADE uma capacidade
operacional nova que ele não tem em nenhuma outra coleção — deliberadamente
não implementado (ver o pedido explícito de não ampliar escopo
silenciosamente).

## Correção Fase 5.1 — autorização/query administrativa

**Sintoma:** ao abrir "Lembretes atribuídos" no Dashboard contra o Firebase
de staging real (não Emulator), o Firestore retornava `permission-denied`
mesmo para um gestor com escopo genuíno sobre o colaborador selecionado. O
bloqueio de escrita administrativa (`.env.staging.dashboard`,
`escritaAdministrativaHabilitada`) já havia sido descartado separadamente
como causa antes desta investigação.

**Causa raiz confirmada** (não hipótese — reproduzida com o Firestore Rules
Emulator, `tests/firebase/firestore.rules.test.ts`, describe "lembretesAtribuidos
— query administrativa real (Fase 5.1)"): o Firestore não trata Security
Rules como um filtro aplicado depois de buscar os documentos. Para um
`list` (query), cada `where(...)` do lado do cliente precisa, sozinho,
provar a condição da Rule para **qualquer** documento que a query possa
retornar — o Firestore nunca avalia "documento por documento" como faz para
um `get()`. A Rule de leitura de `lembretesAtribuidos` é:

```
allow read: if autenticado() && (
  resource.data.destinatarioLogin == loginDoAuth()
  || (souGestor() && podeOperarNaEquipe(resource.data.destinatarioEquipeId))
);
```

A consulta antiga (compartilhada entre colaborador e Dashboard) só filtrava
`destinatarioLogin`. Para o colaborador lendo os próprios, isso basta: o
valor do filtro já é comparável a `loginDoAuth()` sem precisar de dado de
documento. Para o gestor, porém, o segundo ramo do OR depende de
`resource.data.destinatarioEquipeId` — um campo que a consulta nunca
restringia. Sem uma equalidade sobre esse campo, o Firestore não consegue
provar o ramo do gestor para nenhum documento possível e recusa o `list`
inteiro — mesmo que os documentos reais tivessem exatamente a equipe que o
gestor administra. O comentário anterior no código ("a mesma consulta serve
os dois casos") descrevia uma suposição plausível, mas errada para `list`
(seria correta se cada leitura fosse um `get()` por ID).

**Identidade (`loginDoAuth` vs `usuarioReal.login`):** auditados
`firestore.rules` (`loginDoAuth() = request.auth.token.email.lower()
.split('@')[0]`) e `lib/firebase/authRepository.ts`
(`loginDoEmail(email) = email.split('@')[0].toLowerCase().trim()`, usado
para resolver `usuarios/{login}` a partir do e-mail autenticado). As duas
fórmulas são equivalentes — **nenhuma divergência encontrada**, nenhuma
alteração em `loginDoAuth()` foi necessária ou feita.

**Correção aplicada** (`lib/firebase/lembretesRepository.ts`): duas funções
novas, só para o Dashboard/gestor — `listarLembretesAtribuidosDoGestor()` e
`observarLembretesAtribuidosDoGestor()` — que acrescentam
`where('destinatarioEquipeId', '==', destinatarioEquipeId)` à consulta.
`listarLembretesAtribuidosDoUsuario()`/`observarLembretesAtribuidosDoUsuario()`
continuam intocadas e exclusivas do colaborador (App, `useLembretes.ts`). O
Dashboard (`DashboardApp.tsx`) passa a chamar a variante do gestor, com
`colaboradorLembretes.equipeId` (o `equipeId` real do `Usuario` já
carregado, nunca um valor digitável). A Firestore Rule em si **não mudou** —
o campo já era exigido pela Rule, só a consulta não o fornecia.
`destinatarioEquipeId` na query não é um mecanismo de segurança por si
(o cliente poderia mandar qualquer valor); a Rule continua validando
`podeOperarNaEquipe()` do lado do servidor para cada documento retornado —
o filtro só existe para tornar a query aprovável como `list`.

**Índice novo** (`firestore.indexes.json`, não implantado): composto de 3
campos `destinatarioLogin + destinatarioEquipeId + data`, necessário em
produção/staging para a nova consulta do gestor (o Emulator não recusa por
falta de índice, então os 122 testes de Rules passam independente disso —
mas staging real vai exigir o índice depois do deploy).

**Pendência de deploy:** o índice novo precisa ser publicado em staging
(`firebase deploy --only firestore:indexes`, mesmo runbook de
`docs/spec/LEMBRETES.md`/`scripts/firebase-staging.mjs`) antes do teste real
end-to-end funcionar sem erro de índice ausente — **não executado nesta
fase**, só preparado localmente, conforme instrução de não fazer deploy sem
autorização explícita.

## Queries e índices

Lembretes **não ficam presos à competência operacional 26→25** — nenhuma
query do repository chama `competenciaOperacional()`. O intervalo é sempre
civil (`YYYY-MM-DD`), passado explicitamente pelo caller (a UI decidirá o
intervalo na Fase 4).

- **Pessoal**: `where('data', '>=', inicio).where('data', '<=', fim)`,
  filtro de **um único campo** — coberto pelo índice automático de campo
  único do Firestore, **nenhum índice composto necessário**.
- **Atribuído, colaborador** (`listarLembretesAtribuidosDoUsuario`/
  `observarLembretesAtribuidosDoUsuario`): `where('destinatarioLogin', '==',
  próprioLogin).where('data', '>=', inicio).where('data', '<=', fim)` —
  equalidade num campo + intervalo em outro campo **exige** índice composto:
  ```json
  { "collectionGroup": "lembretesAtribuidos", "fields": [
    { "fieldPath": "destinatarioLogin", "order": "ASCENDING" },
    { "fieldPath": "data", "order": "ASCENDING" }
  ]}
  ```
- **Atribuído, gestor/Dashboard** (`listarLembretesAtribuidosDoGestor`/
  `observarLembretesAtribuidosDoGestor`, Fase 5.1): mesma coisa, **mais**
  `where('destinatarioEquipeId', '==', equipeIdReal)` — exige um segundo
  índice composto de 3 campos:
  ```json
  { "collectionGroup": "lembretesAtribuidos", "fields": [
    { "fieldPath": "destinatarioLogin", "order": "ASCENDING" },
    { "fieldPath": "destinatarioEquipeId", "order": "ASCENDING" },
    { "fieldPath": "data", "order": "ASCENDING" }
  ]}
  ```
  Duas funções de repository diferentes, uma para cada caso — ver "Correção
  Fase 5.1" abaixo para o porquê de terem deixado de compartilhar a mesma
  consulta.
- **Status filtrado em memória**: a consulta atribuída não inclui
  `where('status', ...)` — cancelados são filtrados no cliente
  (`lembretesAtribuidosAtivos()`, `lib/lembretes.ts`, ou um filtro
  equivalente na UI). Evita um índice composto de 3 campos
  (`destinatarioLogin+status+data`) para um volume esperado baixo por
  colaborador.

## Realtime

`observarLembretesPessoais()`/`observarLembretesAtribuidosDoUsuario()`
(`lib/firebase/lembretesRepository.ts`) existem e têm cobertura de teste,
mas **não estão conectados a `EmployeeApp.tsx` ainda** — isso é Fase 4.
Quando conectados, devem seguir a mesma regra já aplicada ao resto do App:
listeners só depois de sessão + usuário + carga inicial resolvidos
(`podeIniciarListeners()`, `lib/sessao.ts`), para não recriar a race
condition de um `get()` antigo sobrescrevendo um snapshot mais recente.

## Séries

`criarSerieLembretesPessoais()`/`criarSerieLembretesAtribuidos()` gravam
**um documento por ocorrência** (nunca `datas: [...]` dentro de um único
documento), todos compartilhando `serieId`, num único `writeBatch` —
atômico: ou grava tudo, ou nada. Cenário de aceitação validado em teste
(`lib/lembretes.test.ts`, `lib/firebase/lembretesRepository.test.ts`):

```
Capacitação COBIT
17/08/2026, 18/08/2026, 19/08/2026, 20/08/2026 — 18:30–22:30

(segunda série, atravessando competências 26→25 diferentes)
21/08/2026, 28/08/2026, 10/09/2026, 17/09/2026 — 13:00–17:30
```

## Cancelamento

`cancelarLembreteAtribuido()` nunca chama `deleteDoc()` — só transiciona
`status: ATIVO -> CANCELADO` e grava `canceladoEm`/`canceladoPorLogin`,
preservando histórico administrativo. A Rule nega explicitamente
`CANCELADO -> ATIVO` (reativação exige um lembrete novo). Lembrete pessoal
é o oposto: exclusão é definitiva, sem histórico — é conteúdo do próprio
colaborador.

## Alertas futuros

`alertasAntecedenciaMin: number[]` já existe no domínio e é persistido
(minutos de antecedência, ex.: `[0, 10, 30, 60, 1440]`), mas é **só dado**
nesta fase — validado (`>= 0`, sem duplicata, máximo 5, ordenado), nunca
lido por um scheduler. **Não existe** `cron`/`setTimeout`/Cloud Function/
Push agendado para lembretes. O `push-worker` atual continua exclusivamente
sobre `notificacoesTroca` — nenhuma coleção nova de dispositivos, nenhum
segundo worker.

Extensão futura planejada (não implementada):

```
lembrete (com alertasAntecedenciaMin)
  ↓
scheduler seguro (a definir — Cloud Function agendada ou polling do worker)
  ↓
push-worker existente (apps/push-worker)
  ↓
FCM/FID existente (lib/firebase/pushDeviceRepository.ts, dispositivosPush)
  ↓
PWA / futuro React Native
```

Nunca criar outro Push Worker, outra coleção de dispositivos, ou prometer
ao usuário um alerta automático que ainda não dispara.

## Riscos / pendências conhecidas

- `excluirUsuario()` (`lib/firebase/adminRepository.ts`) ainda não limpa
  `lembretesAtribuidos` nem a subcoleção `lembretes` de um usuário
  excluído. Diferente de `trocasEscala`/`notificacoesTroca`, a Fase 4
  removeu deliberadamente o delete administrativo de `lembretesAtribuidos`
  (ver acima) — uma futura limpeza/retenção para usuário excluído precisará
  de um mecanismo próprio (ex.: Cloud Function com Admin SDK, que ignora
  Rules), nunca reabrir `delete` para o client SDK nem dar a gestor/admin
  acesso à subcoleção pessoal.
- ~~Nenhuma UI consome este repository ainda~~ — Fase 4 conectou a UI do App
  (`apps/app/src/lembretes/`, `components/lembretes/`). Fase 5 (Dashboard)
  continua pendente.
- Nenhum mecanismo de alerta/Push para lembretes existe — só o dado está
  preparado.

## Bloqueio de ambiente conhecido (Fase 4.1) — Rules ainda não publicadas

Teste real (Firebase real, não Emulator) reproduziu `permission-denied`
("Missing or insufficient permissions.") ao criar um Lembrete pessoal.
**Causa confirmada:** esta branch nunca rodou um deploy de Rules — nenhum
commit desta feature chamou `firebase deploy` nem
`npm run firebase:staging:deploy`. O projeto Firebase real contra o qual o
teste rodou ainda serve as Rules de antes da Fase 3, que não têm nenhum
bloco `match` para `usuarios/{login}/lembretes/{lembreteId}` nem para
`lembretesAtribuidos/{lembreteId}` — path sem regra correspondente é negado
por padrão pelo Firestore, exatamente o erro observado (tanto no `create`
quanto no listener realtime, os dois caem no mesmo `permission-denied`).
As 117 Firestore Rules deste projeto só passam no **Emulator local**
(`npm run test:firestore-rules`), que sempre carrega `firestore.rules` do
disco — nunca foram publicadas em nenhum ambiente remoto.

**Comando para publicar (requer autorização explícita, não execute sem
confirmar antes — ver `scripts/firebase-staging.mjs`):**

```bash
npm run firebase:staging:deploy -- --confirm=DEPLOY_STAGING
```

Requer `.env.staging.dashboard` configurado e a CLI do `firebase-tools`
autenticada. Até que isso seja feito com autorização, o CRUD real de
Lembretes (fora do Emulator/Demo) permanecerá bloqueado por
`permission-denied` — comportamento esperado, não um bug de código.

Correção separada (Fase 4.1, `lib/firebase/errors.ts`): a mensagem de erro
mostrada ao usuário mencionava "permissão de gestor" mesmo numa ação de
autoatendimento (criar um lembrete pessoal). `mensagemErroFirebase()` ganhou
um parâmetro `contexto: 'gestor' | 'autoatendimento'` (padrão `'gestor'`,
sem mudar nenhum chamador existente); os listeners e escritas de Lembretes
pessoais/atribuídos do App agora passam `'autoatendimento'` e nunca mais
mencionam gestor.
