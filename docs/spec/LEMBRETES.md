# Especificação — Lembretes

Documento de estado real, escrito a partir do código, do domínio puro e das
Firestore Rules atuais (branch `feature/lembretes-consulta-dia-hoje`). Cada
afirmação aponta para a evidência que a sustenta — este documento não supõe
comportamento que não esteja implementado.

**Estado desta fase (Fase 3 — persistência e Rules):** domínio puro,
repositories e Firestore Rules existem e têm cobertura de teste real
(unitária + Emulator). **Não há UI** — nada em `EmployeeApp.tsx`/
`DashboardApp.tsx` chama este repository ainda (Fase 4/5). **Não há Push**
agendado — os campos de alerta são só dado (ver seção "Alertas futuros").

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

## Queries e índices

Lembretes **não ficam presos à competência operacional 26→25** — nenhuma
query do repository chama `competenciaOperacional()`. O intervalo é sempre
civil (`YYYY-MM-DD`), passado explicitamente pelo caller (a UI decidirá o
intervalo na Fase 4).

- **Pessoal**: `where('data', '>=', inicio).where('data', '<=', fim)`,
  filtro de **um único campo** — coberto pelo índice automático de campo
  único do Firestore, **nenhum índice composto necessário**.
- **Atribuído**: `where('destinatarioLogin', '==', X).where('data', '>=',
  inicio).where('data', '<=', fim)` — equalidade num campo + intervalo em
  outro campo **exige** índice composto (`firestore.indexes.json`):
  ```json
  { "collectionGroup": "lembretesAtribuidos", "fields": [
    { "fieldPath": "destinatarioLogin", "order": "ASCENDING" },
    { "fieldPath": "data", "order": "ASCENDING" }
  ]}
  ```
  A mesma consulta serve o colaborador (próprio login) e o Dashboard/gestor
  (login do colaborador selecionado, Fase 5) — quem autoriza cada caso é a
  Firestore Rule, não uma função de repository diferente.
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
- Nenhuma UI consome este repository ainda — Fase 4 (App) e Fase 5
  (Dashboard).
- Nenhum mecanismo de alerta/Push para lembretes existe — só o dado está
  preparado.
