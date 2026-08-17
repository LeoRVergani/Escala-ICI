# Redesign do Workspace de Escalas (Fase ESCALAS-UX-2)

## Por que este documento existe

Este é um documento de **design/arquitetura de UX, não de implementação**.
Nenhuma linha de código de produto foi alterada para produzi-lo — ele
propõe uma reestruturação da navegação e da experiência de "trabalhar
em uma escala" (jornada 6x1 e Plantão) antes que uma fase futura mexa de
novo no código. As fases ESCALAS-UX-1A/1B/1B.1/1C (ver
`CHECKPOINT-FASE-ESCALAS-UX-1A-EDITOR-PLANTAO.md`,
`CHECKPOINT-FASE-ESCALAS-UX-1B-NOVA-ESCALA-VAZIA.md`,
`CHECKPOINT-FASE-ESCALAS-UX-1B1-REABRIR-RASCUNHO.md`,
`CHECKPOINT-FASE-ESCALAS-UX-1C-FACILIDADES-DISTRIBUICAO.md`) foram bem
sucedidas *dentro* do Editor (working copy, round-trip, cópia de
período anterior, distribuição rápida) — mas todas herdaram, sem
questionar, uma estrutura de navegação de 2023-2024 que nunca foi
desenhada para as duas famílias de escala (jornada e Plantão)
coexistirem. Continuar acrescentando correções pontuais sobre essa
estrutura — mais um botão aqui, mais uma aba ali — é o que este
documento existe para interromper.

Este documento não substitui `docs/spec/EDITOR_ESCALAS.md` (que continua
sendo a fonte de verdade sobre a working copy, origens e o round-trip)
nem `docs/spec/PLANTOES.md` (domínio de Plantão) — ele é uma camada
acima dos dois: como o **produto** organiza o acesso a esses conceitos.
Onde este documento fala em "Editor", refere-se exatamente ao mesmo
Editor já descrito em `EDITOR_ESCALAS.md` — nenhum segundo Editor está
sendo proposto.

**Fontes lidas para este documento**: `docs/spec/EDITOR_ESCALAS.md`,
`docs/spec/PLANTOES.md`, `docs/spec/HIERARQUIA_ORGANIZACIONAL.md`,
`docs/spec/HIERARQUIA_ORGANIZACIONAL_REFERENCIA.md`,
`docs/spec/UI_CASCADE_E_HERANCA.md`,
`docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`, os 4 checkpoints acima, e
auditoria direta de `apps/dashboard/src/DashboardApp.tsx`,
`components/AppFrame.tsx`, `components/ScheduleGrid.tsx`,
`components/plantao/`, `components/organizacao/`, `lib/organizacao.ts`,
`lib/editorPlantao.ts`, `lib/montagemRascunhoPlantao.ts`,
`app/globals.css`.

---

## 1. Problemas encontrados na arquitetura atual

Fatos confirmados por leitura direta do código (não hipóteses):

1. **O Editor de Plantão vive dentro da tela "Importar escala", não
   dentro de "Plantões" nem de "Escalas".** `PlantaoCalendario` (o
   calendário/working-copy) é montado dentro de `PreviewPlantao`, que só
   é renderizado quando `tela === 'importar'`
   (`DashboardApp.tsx:5689-5714`, guardado por
   `tipoArquivoDetectado === 'PLANTAO' && origemPlantaoAtual !== null`).
   Um coordenador que queira revisar uma escala de Plantão que já existe
   — sem importar nada — precisa passar pela aba cujo nome é literalmente
   "Importar escala".
2. **A tela "Plantões" (`tela === 'plantoes'`) não é a experiência
   mensal de escala — é administração de Grupos.** CRUD de
   `GrupoPlantao`, participantes, contatos, ACL e a lista de rascunhos —
   nunca o calendário/lista/contabilidade da competência. Um usuário
   que clica "Plantões" esperando ver a escala do mês encontra uma tela
   de configuração.
3. **A tela "Escalas" só conhece a jornada 6x1.** Confirmado em
   `DashboardApp.tsx:6032-6079`: um único `<article className="panel
   scale-record">` com o rótulo fixo `"COSI > SOC"` e as ações
   "Revisar grade"/"Publicar" — nenhuma menção a Plantão, nenhuma lista
   de competências de Plantão, nenhuma indicação de que outro tipo de
   escala existe. Um Plantão publicado (quando existir, PLANTÃO-3C)
   não teria onde aparecer nesta tela sem uma reescrita.
4. **O seletor de "competência" no topo não é um seletor.**
   `AppFrame.tsx:181-184` renderiza `.competence-control` como um
   `<span>`/`<strong>` estático, alimentado por uma STRING FIXA
   (`competencia="Agosto 2026"`, `DashboardApp.tsx:5424`) — nunca reage a
   nenhum estado real, nunca aparece different para Plantão vs jornada.
   É decoração, não navegação.
5. **Não existe nenhum conceito de "contexto de escala ativo" no
   estado do Dashboard.** Jornada 6x1 (`documentos: TurnosMes[]`,
   ligada a uma Equipe implícita) e Plantão (`grupoRascunhoEscolhido`,
   `competenciaRascunho`) são dois blocos de estado paralelos e
   desconectados — não existe uma variável única "o que estou editando
   agora" que o resto da UI possa consultar. Trocar de um para o outro
   não é uma transição de estado — é literalmente navegar para uma
   tela (`tela`) diferente com uma variável de estado diferente.
6. **O sino de alertas só cobre 6x1.** `AlertasOperacionaisBell`
   (`DashboardApp.tsx:5430-5441`) opera sobre `AlertaEscala[]` (jornada)
   e navega para `tela='grade'` — não existe equivalente para
   pendências/alertas de Plantão (que hoje vivem só dentro da aba
   "Vínculos"/"Calendário" do Editor, invisíveis de qualquer outro
   lugar do produto).
7. **"+ Nova escala" existe só dentro de "Escalas"**
   (`DashboardApp.tsx:6037-6039`), mas o fluxo que ele abre
   (`ModalNovaEscala`) decide, na etapa 2, entre Grupo de Plantão e
   competência — dois conceitos que "Escalas" (tela 6x1) não modela em
   nenhum outro lugar. A entrada e o destino não combinam.
8. **`Tela` mistura destinos de produto com ações.** O tipo
   `Tela = 'visao' | 'importar' | 'escalas' | 'grade' | 'usuarios' |
   'trocas' | 'plantoes' | 'administracao'` (`DashboardApp.tsx:285`)
   trata "Importar" (uma ação: começar uma escala a partir de um
   arquivo) e "Grade" (uma forma de ver/editar UM tipo específico de
   escala) como se fossem seções permanentes do produto, do mesmo nível
   hierárquico que "Usuários" ou "Administração". A app abre, por
   padrão, em `'importar'` (`useState<Tela>('importar')`,
   `DashboardApp.tsx:2874`) — ou seja, a primeira coisa que qualquer
   usuário vê ao entrar é uma tela de upload de arquivo, não uma visão
   do seu trabalho.

## 2. Problemas visuais observados

1. `ModalNovaEscala`, etapa Plantão (`DashboardApp.tsx:2240-2312`):
   label e campo compartilham a mesma linha de texto em vários pontos
   (ex.: `<label>Grupo de Plantão<select>...` sem separação visual
   clara entre rótulo e controle); o `<select>` de Grupo não tem
   affordance de dropdown além do estilo nativo do navegador; o campo
   de competência (`<input placeholder="2026-08">`) parece texto solto
   por não ter contraste de borda suficiente contra `.edit-modal`; as
   três opções de "Como começar?" aparecem mesmo quando Grupo/
   competência ainda não foram preenchidos (hierarquia fraca — a ação
   mais importante não está visualmente subordinada ao pré-requisito).
2. O "Resumo por pessoa" (`app/globals.css:4883-4890`,
   `DashboardApp.tsx` dentro de `PreviewPlantao`) fica **abaixo** do
   calendário — em competências com muitos plantonistas, o coordenador
   precisa rolar a página inteira para ver quem tem zero plantões
   atribuídos, exatamente a informação mais útil para decidir "quem
   ainda falta escalar".
3. A aba "Resumo" (`aba === 'resumo'` em `PreviewPlantao`) mistura
   erros/avisos estruturais da planilha com uma frase estática quando a
   origem não é XLS — nenhum dado realmente acionável, confirmado
   pouco útil em homologação visual pelo usuário.
4. A Lista (`aba === 'plantoes'`) repete o mesmo status de pendência
   por CADA atribuição da pessoa pendente, em vez de agrupar por
   pessoa — uma pessoa com 10 plantões e vínculo pendente gera 10
   linhas de "Usuário não encontrado" em vez de 1.
5. O card de calendário (`.plantao-card`) já é compacto, mas o restante
   da tela ao redor dele (título grande, badges, textos auxiliares
   repetidos em 3 lugares) consome mais espaço vertical do que o
   próprio conteúdo operacional — sensação de "muito texto, pouco
   trabalho visível" já identificada informalmente durante a ESCALAS-UX-1C.

## 3. Problemas de navegação

1. Fluxo real hoje para revisar uma escala de Plantão já existente:
   `Escalas` (não mostra Plantão) → não há botão óbvio → usuário
   tenta `Plantões` (administração, sem calendário) → expande o Grupo
   → vê a lista de rascunhos → clica "Abrir rascunho" → só ENTÃO cai em
   `Importar escala` (rótulo errado) → working copy aparece. Cinco
   telas para "ver o Plantão do mês".
2. Fluxo para começar uma jornada 6x1 nova: `Escalas` → "+ Nova
   escala" → "Escala de jornada" → roteia direto para `Importar
   escala` (`escolherJornadaNovaEscala`, `DashboardApp.tsx`) sem
   nenhuma etapa de "competência"/"como começar" equivalente à que o
   Plantão já tem — a jornada 6x1 nunca ganhou os benefícios de
   ESCALAS-UX-1B/1C (criar vazia, usar período anterior).
3. "Grade" é alcançável tanto pela sidebar quanto por dentro de
   "Escalas" (`onClick={() => setTela('grade')}`,
   `DashboardApp.tsx:6056`) e pelo sino de alertas — três caminhos
   distintos para a mesma tela, sem que nenhum deles preserve "qual
   escala eu estava olhando".
4. Não existe navegação nenhuma que preserve contexto ao trocar de
   tipo de escala — sair de uma competência de Plantão para olhar a
   jornada 6x1 e depois voltar significa reconstruir manualmente
   Grupo+competência de novo (o estado de Plantão não é limpo, mas
   também não é reapresentado — apenas some da tela visível).

---

## 4. Princípio central: um único workspace de escala

> O produto possui **UM WORKSPACE DE ESCALA**. O TIPO de escala (jornada
> 6x1 ou Plantão) determina qual **editor central** é renderizado —
> nunca a lógica mental do produto, nunca a navegação, nunca o conjunto
> de conceitos que o coordenador precisa aprender.

```
              CONTEXTO DE ESCALA (o que estou editando)
                       |
        +--------------+--------------+
        |                             |
   tipo = JORNADA                tipo = PLANTAO
        |                             |
   editor central =              editor central =
   Grade (ScheduleGrid)           Calendário (PlantaoCalendario)
        |                             |
        +--------------+--------------+
                       |
     mesmo SHELL: header de contexto, roster/painel lateral,
     faixa de status, ações (Salvar rascunho / Publicar),
     Lista alternativa, Contabilidade, Pendências
```

Isso não é uma abstração de código forçada — é a mesma ideia que
`docs/spec/EDITOR_ESCALAS.md` § 2 já registra ("o que converge: working
copy, conferência, rascunho; o que não converge: o modelo de dado em
si") elevada da camada de dados para a camada de **produto**. Hoje essa
convergência existe no código mas não na navegação — o objetivo desta
fase de design é fechar essa lacuna.

---

## 5. Proposta de sidebar

### Estado atual (`DashboardApp.tsx:659-668`, `Tela` em `DashboardApp.tsx:285`)

```
Visão geral | Importar escala | Escalas | Grade | Trocas | Usuários | Plantões | Administração
```

### Proposta

```
Visão geral | Escalas | Trocas | Usuários | Administração
```

| Item removido | Por quê | Para onde vai |
| --- | --- | --- |
| **Importar escala** | Importação é uma FORMA de começar uma escala, não um destino — o próprio `docs/spec/EDITOR_ESCALAS.md` § 1 já afirma "importação nunca é um destino" só que a navegação nunca refletiu isso. | Vira uma ação dentro de "+ Nova escala" (progressive disclosure, § 11) e, para uma escala já em andamento, o botão "Importar planilha" continua disponível dentro do próprio workspace quando fizer sentido reimportar. |
| **Grade** | É uma FORMA de editar um tipo específico de escala (jornada 6x1) — o mesmo raciocínio já aplicado ao Plantão (o calendário nunca foi um destino de sidebar próprio). | Vira o editor central do workspace quando o contexto ativo é uma Jornada — ver § 30 (a Grade deixa de ser destino global). |
| **Plantões** | Na implementação atual, esta tela é principalmente CONFIGURAÇÃO administrativa de Grupos (CRUD, participantes, contatos, ACL) — nunca a experiência mensal de escala. Manter o nome "Plantões" na sidebar, mas com esse conteúdo, é o que hoje engana o usuário fazendo-o achar que ali está a escala do mês. | Vira **Administração → Grupos de Plantão** (§ 27) — junto de outras configurações administrativas raras (Equipes, Unidades, Usuários), nunca misturada com o trabalho mensal de montar a escala. |

"Escalas" passa a ser o único destino de sidebar para "trabalhar numa
escala" — jornada OU Plantão — usando o contexto ativo (§ 6) para
decidir qual editor central mostrar. "Visão geral", "Trocas",
"Usuários" e "Administração" continuam exatamente como hoje (fora de
escopo desta fase).

Isso reduz a sidebar de 8 para 5 itens — cada um respondendo a uma
pergunta diferente do coordenador ("como estão as coisas", "vou
trabalhar numa escala", "há alguma troca pendente", "quem são as
pessoas", "configurar algo raro") em vez de misturar destinos
("Escalas"/"Grade"/"Plantões") com uma ação disfarçada de destino
("Importar").

---

## 6. Proposta de contexto de escala (header)

Novo bloco no topbar, à ESQUERDA (onde hoje só existe o rótulo estático
`.competence-control`) — nunca junto ao avatar/sino, que continuam
globais à direita:

```
+----------------------------------------------------------------------+
| ☰  Escala atual              Competência           [Rascunho]        |
|    [ SOC · Jornada 6x1  v ]  [ Agosto 2026     v ]                    |
|                                                       🔔  🌗  Conta v |
+----------------------------------------------------------------------+
```

- **Escala atual** — o `ScheduleContextSwitcher` (§ 31): qual Jornada
  ou Grupo de Plantão está ativo agora.
- **Competência** — dropdown de competência DENTRO do contexto já
  escolhido (mês/ano, formato AAAA-MM convertido para rótulo civil,
  reaproveitando `periodoDaCompetencia()`/`formatarCompetencia()` já
  existentes) — nunca um segundo seletor de "qual escala", só "qual
  mês desta escala".
- **Status** — badge `Rascunho`/`Publicada` (reaproveita
  `.status-badge` já existente), reagindo ao `StatusCompetenciaPlantao`
  real ou ao equivalente 6x1 (`documentos`/`publicados`).
- Lado direito continua **global**: notificações, tema, conta — nunca
  dependente do contexto de escala ativo (mantém a separação conceitual
  "o que eu edito" vs "o sistema/minha conta").

Isto substitui o `.competence-control` estático atual
(`AppFrame.tsx:181-184`) por um controle real — mas a peça de UI em si
(estilo visual, posição, tipografia) pode reaproveitar a MESMA classe
como ponto de partida, só tornando-a interativa (nenhum sistema visual
novo, per `docs/spec/UI_CASCADE_E_HERANCA.md`).

---

## 7. O seletor não é apenas "Equipe" — modelo baseado em dados reais

Requisito explícito do pedido: impedir o problema observado em
homologação — trocar para Plantão faz a Jornada SOC "parecer que
desapareceu" da Grade. Isso acontece hoje porque não existe nenhum
registro do que estava selecionado antes — trocar de tipo de escala
simplesmente troca de `tela`, perdendo o "onde eu estava".

Proposta de modelo (nunca hardcoded — ver § 32 para o formato de
estado):

```
ESCALA ATUAL  (dropdown agrupado, dados carregados normalmente)

  JORNADAS                              <- grupo, rotulado dinamicamente
    SOC — Jornada 6x1                   <- rotulo = equipe.nome + " — Jornada 6x1"
    NOC — Jornada 6x1
    (uma entrada por Equipe que o usuário administra/consulta)

  PLANTÕES                              <- grupo, rotulado dinamicamente
    Plantão de Segurança — COSI         <- rotulo = grupoPlantao.nome + " — " + equipeResponsavel.nome
    (uma entrada por GrupoPlantao que o usuário administra/consulta)
```

Regras do modelo:

- As duas listas vêm de dados já existentes — `equipesPermitidasEfetivas()`
  (jornada) e os Grupos de Plantão que o usuário administra/consulta
  (`gruposPlantaoAdmin`/`podeAcessarPlantoes`, já calculados hoje). Nenhum
  nome de equipe/sigla (SOC, NOC, COSI) é hardcoded no seletor — os
  exemplos deste documento são apenas ilustrativos, usando os mesmos
  dados de seed já usados no restante do projeto.
- **Cada entrada é um contexto isolado e completamente selecionável** —
  trocar de "SOC · Jornada 6x1" para "Plantão de Segurança · COSI" nunca
  descarrega nem descarta o estado da Jornada; ver § 32 (o estado de
  cada contexto é independente e mantido — só o editor central em tela
  muda). Isso resolve diretamente o bug de homologação: a Jornada nunca
  "desaparece", ela simplesmente não está sendo exibida no momento.
- Se o usuário não administra/consulta nenhuma Jornada, o grupo
  "JORNADAS" não aparece (idem para "PLANTÕES") — nunca uma seção vazia
  com placeholder.
- A ausência total de qualquer escala acessível mostra um estado vazio
  explícito ("Você ainda não tem nenhuma escala para gerenciar"), nunca
  um seletor quebrado ou sem opções.

---

## 8. "+ Nova escala" — primeira etapa (preservada)

A primeira etapa atual (`etapa === 'tipo'`, `DashboardApp.tsx:2217-2238`)
está visualmente aceitável e é preservada conceitualmente: dois cards
grandes, "Jornada" e "Plantão", cada um com ícone + descrição curta.
Nenhuma mudança visual proposta aqui além de, eventualmente, revisar a
descrição de cada card para não mencionar mais "usa a importação e a
grade já existentes" como se fossem destinos separados (a descrição
passa a falar do resultado — "turnos por colaborador" / "intervalos por
grupo" — não do caminho de navegação).

```
+-----------------------------------------------------+
|  O que você quer criar?                          [x]|
|                                                       |
|  +-------------------+   +-------------------+       |
|  |     📅            |   |     📻            |       |
|  |  Jornada           |   |  Plantão          |       |
|  |  Turnos por        |   |  Intervalos por   |       |
|  |  colaborador       |   |  grupo            |       |
|  +-------------------+   +-------------------+       |
+-----------------------------------------------------+
```

---

## 9. Fluxo Jornada — segunda etapa (nova)

Hoje "Escala de jornada" pula direto para "Importar escala"
(`escolherJornadaNovaEscala`) sem nenhuma etapa própria — a jornada 6x1
nunca ganhou o refinamento que o Plantão ganhou em ESCALAS-UX-1B/1C.
Proposta: dar à Jornada a MESMA segunda etapa que o Plantão já tem,
adaptada ao vocabulário de Equipe/competência:

```
+-----------------------------------------------------+
|  Nova escala de jornada                          [x]|
|                                                       |
|  Equipe                                              |
|  [ Selecionar equipe                            v ]  |
|                                                       |
|  Competência                                         |
|  [ Agosto 2026                                  v ]  |
|  26 jul -> 25 ago                                     |
|                                                       |
|  Como começar?                                        |
|                                                       |
|  [ Importar planilha ] [ Criar vazia ] [ Usar anterior]|
+-----------------------------------------------------+
```

Nenhuma dessas três opções existe hoje para jornada 6x1 — "Criar vazia"
e "Usar anterior" para 6x1 são trabalho de uma fase futura de
implementação (fora de escopo desta fase de design), mas o modelo de
tela já nasce simétrico ao de Plantão para que essa fase futura só
precise reaproveitar o padrão, nunca inventar um segundo.

---

## 10. Fluxo Plantão — segunda etapa (redesenhada)

Estrutura idêntica à Jornada (mesmo componente, dados diferentes),
corrigindo os problemas visuais concretos do § 2:

```
+-----------------------------------------------------+
|  Novo Plantão                                    [x]|
|                                                       |
|  Grupo de Plantão                                    |
|  [ Selecionar grupo                             v ]  |
|                                                       |
|  Competência                                         |
|  [ Agosto 2026                                  v ]  |
|  26 jul -> 25 ago                                     |
|                                                       |
|  ─────────────────────────────────────────────────  |
|  Como começar?                                        |
|                                                       |
|  [ Importar planilha ] [ Criar vazia ] [ Usar anterior]|
+-----------------------------------------------------+
```

Correções concretas de UX aplicadas (mapeadas ponto a ponto ao pedido):

- **Label e campo na mesma frase** → cada campo vira um bloco de duas
  linhas (rótulo em cima, controle embaixo, mesmo padrão de
  `<label>`/`<input>` empilhado já usado em outros formulários do
  Dashboard, nunca um novo padrão visual).
- **Select sem affordance clara** → um `<select>` estilizado com um
  ícone de chevron explícito (reaproveitando o padrão já usado em
  outros dropdowns do produto, ex.: o seletor de Grupo em
  `OrganizationTeamPicker`) em vez do estilo nativo cru do navegador.
- **Competência parecendo texto sem borda** → o controle de
  competência ganha a MESMA borda/fundo de qualquer outro campo do
  formulário (nenhuma exceção visual só porque hoje é um `<input>` de
  texto livre — na prática, vira o mesmo dropdown de competência do
  header, § 6, reaproveitado aqui).
- **Opções aparecendo antes do contexto estar claro** → um separador
  visual (`<hr>`/borda superior) isola "Como começar?" do bloco
  Grupo+Competência, e os três botões continuam desabilitados até
  Grupo+competência serem válidos (comportamento que já existe hoje
  via `podeCriar`, só precisa de reforço visual, não de lógica nova).
- **Excesso de espaço / hierarquia fraca** → remove-se o card de resumo
  do Grupo (equipe responsável, participantes ativos) da segunda etapa
  — essa informação passa a aparecer DENTRO do workspace, no roster
  lateral (§ 14), depois que o Editor já abriu; a segunda etapa do
  modal fica só com o essencial para decidir "qual escala, qual mês,
  como começar".

---

## 11. Importação inline

"Importar planilha" deixa de navegar para uma tela dedicada — vira
*progressive disclosure* dentro do MESMO modal de "+ Nova escala":

```
Etapa 2 (Grupo/Equipe + competência escolhidos)
        |
        v
  usuário toca [ Importar planilha ]
        |
        v
+-----------------------------------------------------+
|  Novo Plantão — Importar planilha                [x]|
|                                                       |
|      ┌─────────────────────────────────┐             |
|      │      Solte o arquivo aqui        │             |
|      │      ou toque para selecionar     │             |
|      └─────────────────────────────────┘             |
|                                                       |
|  (nome do arquivo só aparece DEPOIS de selecionado)   |
+-----------------------------------------------------+
        |
        v  arquivo selecionado -> parser roda em memória
        |
        v
+-----------------------------------------------------+
|  arquivo.xlsx selecionado                            |
|  ✓ 32 plantões detectados · 4 plantonistas            |
|  [ Voltar ]                          [ Continuar ]    |
+-----------------------------------------------------+
        |
        v  "Continuar"
        |
        v
   Editor já preenchido (mesmo workspace, § 13)
```

Regras explícitas:

- O nome do arquivo (`nomeArquivo`) só aparece DEPOIS de um arquivo
  real ser selecionado — nunca um placeholder tipo
  `Escala-SOC-Controle-Agosto.xls` sugerindo um nome antes de existir
  um arquivo.
- O nome do arquivo é sempre metadado secundário — nunca define o
  título da escala (o título continua sendo Grupo/Equipe + competência,
  já resolvido pelo contexto escolhido na etapa 2).
- A confirmação pós-análise é pequena e factual (contagem de
  intervalos/plantonistas, nunca uma segunda tela cheia de tabelas —
  essas continuam existindo, mas dentro do Editor já aberto, na aba
  Contabilidade/Lista).
- O dropzone/file-picker é o MESMO componente de upload já usado hoje
  (`processarArquivoImportado`) — só a moldura ao redor dele muda (modal
  em vez de página inteira).

---

## 12. "Importar" deixa de ser destino — formalização

> **Importação é uma ACTION, não uma seção principal da aplicação.**

O usuário nunca deveria precisar pensar "vou para a aba de importação"
— só "vou criar uma escala usando uma planilha". Consequências diretas
desta formalização:

- Nenhum item de sidebar chamado "Importar" (§ 5).
- Nenhuma tela cujo propósito primário seja "receber um arquivo" — o
  upload é sempre um passo dentro de um fluxo maior que já sabe qual
  escala/competência está sendo criada (§ 11).
- Reimportar um arquivo POR CIMA de uma escala já em andamento (hoje
  possível dentro de "Importar escala") continua possível, mas como uma
  ação dentro do workspace já aberto (ex.: um botão "Reimportar
  planilha" no cabeçalho do editor), nunca exigindo sair do contexto
  atual para "ir a outra aba".

---

## 13. Workspace desktop

Layout de duas áreas (nunca três colunas permanentes):

```
+------------------------------------------------------------------+
| SOC · Jornada 6x1  v  |  Agosto 2026  v  | [Rascunho]  [Salvar]   |  <- ScheduleHeader
+------------------------------------------------------------------+
| 4 plantonistas · 32 plantões · 504h · 2 horários atípicos · 4 pend|  <- ScheduleHealthSummary
+----------------+---------------------------------------------------+
| Plantonistas   |  [ Calendário ]  [ Lista ]                        |
| (230–280px)    |                                                    |
|                |                                                    |
| 🔍 buscar       |          CALENDÁRIO ou GRADE                     |
|                |     (editor central conforme o tipo de escala)    |
| ○ Bruno B.     |                                                    |
|   10 · 156h    |                                                    |
| ● Caroline F.  |                                                    |
|   11 · 192h    |                                                    |
| ○ Claudio      |                                                    |
|   0 · 0h       |                                                    |
| ○ Jean         |                                                    |
|   11 · 156h    |                                                    |
+----------------+---------------------------------------------------+
```

- Lateral (roster): 230–280px, sticky, rolagem própria independente do
  editor central.
- Central: flexível, ocupa o restante — Grade OU Calendário dependendo
  do contexto ativo, nunca os dois ao mesmo tempo, nunca uma terceira
  coluna fixa.
- Um inspetor de detalhes (ex.: histórico de uma atribuição, detalhes
  de conferência de um horário específico) pode abrir como **drawer**
  lateral por cima do conteúdo quando necessário — nunca uma terceira
  coluna permanente que reduz o espaço do editor central em toda tela.

---

## 14. Roster lateral

Redesign do atual "Resumo por pessoa" (hoje abaixo do calendário,
exigindo scroll — § 2.2) como painel lateral fixo:

```
Plantonistas                          🔍
────────────────────────────────────
○ Bruno Bueno
  10 plantões · 156h
────────────────────────────────────
● Caroline F.
  11 plantões · 192h
────────────────────────────────────
○ Claudio
  0 plantões · 0h
────────────────────────────────────
○ Jean
  11 plantões · 156h
────────────────────────────────────
```

Requisitos (mapeados 1:1 ao pedido):

- **Compacto** — uma linha de nome + uma linha de contador por pessoa,
  mesma densidade do atual `.plantao-resumo-por-pessoa`, só reposicionado.
- **Selecionável** — reaproveita EXATAMENTE o mecanismo já implementado
  na ESCALAS-UX-1C (`plantonistaSelecionadoPlantao`, botão
  `aria-pressed`) — nenhuma reimplementação, só reposicionamento visual
  de baixo do calendário para a lateral.
- **Pesquisável quando houver muitas pessoas** — um campo de busca no
  topo do painel (só aparece/é útil quando a lista ultrapassa um
  tamanho que exige scroll — não é uma barra de busca sempre visível
  para 4 pessoas).
- **Identidade visual consistente com os cartões** — continua
  reaproveitando `indiceIdentidadePlantonista()`/a paleta de identidade
  já existente (`TAMANHO_PALETA_IDENTIDADE_PLANTAO`,
  `lib/editorPlantao.ts`), nunca uma paleta paralela.
- **Contador de plantões/horas** — mesmo `resumirPorPessoa()` já
  existente, sem mudança de cálculo.
- **Participante com zero continua visível** — comportamento já
  garantido hoje (`resumirPorPessoa`/`consolidarParticipantesPlantao`
  nunca descartam quem não tem atribuição), preservado.
- **Nenhum seletor manual de cor** — a identidade continua determinística
  (hash), nunca configurável manualmente pelo usuário.

Para a Grade (jornada 6x1), o mesmo painel lateral mostra os
colaboradores da Equipe (substituindo a coluna de nomes que hoje é a
primeira coluna da própria tabela `ScheduleGrid`) — avaliação detalhada
de como isso se encaixa com uma grade célula-a-célula fica para a fase
de implementação (`ESCALAS-UX-2B`, § 36), mas o princípio de "painel
lateral sempre visível com contagem" é o mesmo para os dois tipos de
escala.

---

## 15. Referência dos projetos antigos — o que aproveitar, o que não

Referência conceitual: `LeoRVergani/escala-dashboard`,
`src/components/OnCallEditor.tsx` (não disponível neste ambiente de
trabalho — usado apenas pela descrição fornecida no pedido; nenhum
código desse projeto foi lido ou transplantado).

### Padrões de interação que valem recuperar

| Padrão antigo | Por que vale a pena | Onde entra no redesign |
| --- | --- | --- |
| Roster lateral com nomes + contagem de plantões/horas | Resolve exatamente o problema atual de "Resumo por pessoa" exigir scroll (§ 2.2) | § 14 |
| Nomes arrastáveis para o calendário | Reduz cliques para o caso comum, mantendo o clique como alternativa (nunca substituindo) | § 16 (drag-and-drop opcional) |
| Calendário como editor central | Já adotado desde ESCALAS-UX-1A (`PlantaoCalendario`) | inalterado |
| "Regra padrão mostrada ao usuário" | Base conceitual para o padrão de horário por Grupo (Bruno/COSI trabalha 19h→07h) — mas como DADO do Grupo, nunca condicional de código | § 17/§ 18 |

### Funcionalidades antigas que NÃO devem voltar

| Funcionalidade antiga | Por que fica de fora |
| --- | --- |
| Múltiplos modos de cartão (Card único / Entrada e saída / Dividido por dia) | Viola o princípio de simplicidade já registrado em `EDITOR_ESCALAS.md` § 6 — "nenhum modo de cartão concorrente foi trazido dos protótipos antigos"; um único formato de cartão já resolve a necessidade. |
| Seletor manual de cor | A identidade visual já é determinística (hash) — configuração manual de cor é personalização decorativa, não ajuda a criar/conferir/corrigir uma escala (teste do § 32/38 do pedido). |
| Botão "Compactar" | Densidade já é uma decisão de design fixa (§ 20) — um modo alternativo de densidade é mais um estado para o usuário aprender sem ganho operacional claro. |
| Autocompletar automático (de nomes/horários por IA ou heurística oculta) | Viola a proibição permanente de `PLANTOES.md` § 12 — "gerador determinístico, reproduzível e testável, nunca IA para decidir escala operacional." Qualquer atalho de preenchimento precisa ser uma ação explícita e auditável (como o já implementado `copiarAtribuicoesParaNovaCompetencia()`), nunca uma sugestão automática silenciosa. |
| Vários modos concorrentes de visualização/edição | Cada modo novo é uma segunda forma de aprender o produto — o princípio central desta fase (§ 4) é exatamente evitar isso. |

Teste aplicado a cada item considerado: **"Isso ajuda criar/conferir/
corrigir uma escala?"** — se a resposta é não, o item fica fora do
fluxo principal (formalizado no § 32 do pedido, aplicado a cada item
acima).

---

## 16. Drag-and-drop (atalho opcional) + alternativa sem drag

```
DESKTOP (opcional):
  arrastar "Bruno Bueno" do roster
        ↓
  soltar sobre o dia 19 no calendário
        ↓
  sistema abre o MESMO modal de criação, PRÉ-PREENCHIDO
  (plantonista=Bruno, data=19/08) — nunca cria a atribuição
  direto (nunca inventa horário, nunca persiste automaticamente)

QUALQUER DISPOSITIVO (sempre disponível):
  tocar/clicar "Bruno Bueno" no roster (fica "ativo")
        ↓
  tocar/clicar o dia 19 no calendário
        ↓
  MESMO modal de criação, MESMO pré-preenchimento
```

Os dois caminhos disparam a **mesma operação de domínio** — a função
que abre o modal de criação recebe `{ plantonistaNomeOriginal, data }`
independente de ter vindo de um evento de drop ou de um clique
sequencial (exatamente o desenho já usado por
`abrirCriacaoAtribuicaoPlantao()` desde a ESCALAS-UX-1C, que já separa
"quem está pré-selecionado" do "evento que abriu o modal"). Isso
significa que implementar drag-and-drop no futuro (`ESCALAS-UX-2B`, se
priorizado) é ADICIONAR um segundo gatilho para uma função que já
existe — nunca construir um segundo pipeline de criação.

Drag nunca persiste diretamente — ele só prepara os valores iniciais do
MESMO modal que o clique já abre; o coordenador sempre confirma
horário/data final explicitamente (mesma regra de "nunca inventar
horário" já vigente desde a ESCALAS-UX-1C).

No mobile, drag-and-drop **não existe** — toda operação usa
exclusivamente o caminho de clique/toque (§ 30).

---

## 17. Padrão de horário por Grupo (domínio futuro configurável)

Confirmado no schema atual (`packages/contrato/src/modeloPlantaoPersistente.ts:65-77`):
`GrupoPlantao` hoje tem `grupoId, nome, descricao?, equipeResponsavelId,
equipesConsulta, timezone, ativo, schemaVersion, criadoPorLogin,
criadoEm, atualizadoEm` — **nenhum campo de padrão de horário existe
ainda**. Este documento propõe o CONCEITO, não o schema final (a
implementação real, com validação/Rules/migração, é trabalho de uma
fase própria — `PLANTAO-PADRAO-1`, § 36).

Proposta conceitual de forma (ilustrativa, não normativa):

```ts
// Conceitual — NÃO implementado nesta fase.
interface PadraoHorarioDia {
  diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo
  horaInicio: string;  // "19:00"
  diasAposInicio: number; // deslocamento do fim relativo ao início
  horaFim: string;     // "07:00"
}

interface PadraoHorarioSemanal {
  dias: PadraoHorarioDia[]; // pode cobrir só alguns dias da semana
}

interface GrupoPlantao {
  // ...campos existentes, inalterados...
  padraoHorario?: PadraoHorarioSemanal; // opcional — grupo sem padrão configurado continua funcionando exatamente como hoje
}
```

Regras permanentes (o que este documento formaliza como restrição de
qualquer implementação futura):

- **O padrão pertence aos DADOS do Grupo — nunca ao nome/sigla da
  unidade.** Nunca `if grupo.nome === 'COSI'`. A UI de configuração do
  Grupo (dentro de Administração → Grupos de Plantão, § 27) é quem
  define o padrão, por Grupo, dado a dado.
- **Opcional** — um Grupo sem padrão configurado continua funcionando
  exatamente como hoje (todo horário digitado manualmente).
- **Nunca aplicado retroativamente/silenciosamente** — o padrão só
  entra em jogo em uma ação explícita do coordenador (§ 18), nunca
  reescreve atribuições já criadas.
- **Nunca usado por Rules/autorização** — é um dado de conveniência de
  UI/preenchimento, nunca uma regra de permissão.

---

## 18. UX do horário padrão (caso comum vira ação simples)

Continuação direta da distribuição rápida por clique já existente
(ESCALAS-UX-1C: selecionar plantonista + tocar dia abre o modal de
criação com plantonista+data preenchidos, horário sempre vazio). Com um
padrão configurado no Grupo, o MESMO modal passa a oferecer o padrão
como uma sugestão de um clique — nunca substituindo o preenchimento
manual:

```
+-----------------------------------------------+
|  Novo plantão                              [x]|
|                                                 |
|  Plantonista                                   |
|  Bruno Bueno                                   |
|                                                 |
|  Data                                          |
|  19/08/2026                                    |
|                                                 |
|  ┌───────────────────────────────────────────┐ |
|  │ Padrão do grupo                            │ |
|  │ 19:00 → 07:00 (+1 dia) · 12h                │ |
|  │                          [ Adicionar ]      │ |
|  └───────────────────────────────────────────┘ |
|                                                 |
|  Outro horário                                 |
|  Início [ __:__ ] __/__/____                   |
|  Fim    [ __:__ ] __/__/____                   |
|                                                 |
|                          [Cancelar] [Salvar]   |
+-----------------------------------------------+
```

- **"Adicionar"** (dentro do card do padrão) preenche instantaneamente
  início/fim com o padrão do dia da semana escolhido e já habilita
  "Salvar" — sem abrir quatro campos de data/hora para o caso comum.
- **"Outro horário"** é a mesma edição completa que já existe hoje
  (início/fim livres) — nunca removida, sempre visível, nunca escondida
  atrás de um menu extra.
- Se o Grupo não tem padrão configurado, o card "Padrão do grupo"
  simplesmente não aparece — o modal volta a ser exatamente o de hoje.
- Uma ação explícita futura, **"Aplicar padrão"**, poderia preencher em
  lote os dias vazios de uma competência de uma vez (mencionada no
  pedido) — este documento a registra como possibilidade avaliável em
  `PLANTAO-PADRAO-1`, nunca como parte obrigatória desta fase de design.

---

## 19. Importação e exceções — preservação sem normalização

Regra permanente, sem exceção, reafirmando o que já vale desde
PLANTÃO-1/ESCALAS-UX-1C: **intervalos importados de uma planilha
continuam sendo preservados EXATAMENTE como estão** — um plantão de 43h
ou de 5h nunca é "corrigido" para caber no padrão do Grupo. O padrão de
horário (§ 17/§ 18) serve exclusivamente para:

1. **Criação de uma nova atribuição** (o coordenador está adicionando
   um plantão que não existia).
2. Uma ação explícita e nomeada, tipo **"Aplicar padrão"**, que o
   coordenador aciona conscientemente sobre dias vazios — nunca
   executada automaticamente, nunca aplicada sobre dias que já têm uma
   atribuição (importada ou manual).

Nenhum padrão de Grupo corrige, sugere correção, ou sinaliza como
"errado" um horário divergente vindo de importação — a única reação a
uma duração atípica continua sendo a conferência neutra já existente
(`duracaoPlantaoAtipica()`, § 20).

---

## 20. Calendário — melhorar densidade sem aumentar informação por cartão

Preserva integralmente a visualização 26→25 já implementada
(`PlantaoCalendario`) — nenhuma mudança de janela, nenhuma navegação
mês-a-mês. Refinamento de densidade do cartão, mantendo a mesma
quantidade de informação (nunca acrescentando uma terceira linha):

```
Cartão comum:              24h:                 Exceção:
┌─────────────────┐        ┌─────────────────┐  ┌─────────────────┐
│ Bruno B.         │        │ Caroline F.      │  │ Caroline F.      │
│ 19:00–07:00      │        │ 24h              │  │ ⚠ 5h             │
└─────────────────┘        └─────────────────┘  └─────────────────┘
```

- Nome curto (já existente, `nomeCurtoPlantonista()`) + uma linha de
  horário/duração — nunca as duas coisas em linhas separadas quando
  cabem juntas.
- 24h vira um rótulo direto (`24h`), sem precisar mostrar
  `00:00–00:00` ou equivalente confuso.
- Uma duração atípica (`duracaoPlantaoAtipica()`, já existente) ganha o
  ícone de alerta (`⚠`) e a duração em vez do intervalo — informação
  mais útil no espaço do mesmo cartão, não informação adicional.

---

## 21. Grade — deixa de ser destino global da sidebar

A Grade (`ScheduleGrid`) passa a existir **somente quando o contexto
ativo é uma Jornada 6x1** — nunca mais um item de sidebar próprio (§ 5),
nunca mais alcançável por três caminhos diferentes sem contexto (§ 3.3).
`ScheduleGrid` (`components/ScheduleGrid.tsx`) não precisa de nenhuma
mudança de props para isso — ela já recebe `documentos`/`usuarios`/
`catalogo`/callbacks como um componente puro; o que muda é só ONDE ela é
montada (dentro do `PlantaoEditor`/`JornadaEditor` que o workspace
escolhe renderizar, § 33), nunca sua própria lógica interna.

Consequência direta: trocar o contexto de "SOC · Jornada 6x1" para
"Plantão de Segurança · COSI" nunca faz a Grade "sumir" — ela para de
estar em tela porque o contexto mudou, exatamente como esperado, e volta
inteira (com o mesmo estado) quando o contexto volta a ser uma Jornada
— porque o estado da Jornada nunca foi destruído, só deixou de ser o
contexto ativo (§ 32).

---

## 22. Edição de cartão existente

Clique/toque em um cartão do calendário abre um **drawer/modal de
edição** com ações — nunca tudo diretamente no cartão (que continua
compacto, § 20):

```
+-----------------------------------------------+
|  Bruno Bueno — 19/08                       [x]|
|  19:00 → 07:00 (+1 dia) · 12h                  |
|                                                 |
|  [ Alterar plantonista ]                       |
|  [ Aplicar padrão deste dia ]                  |
|  [ Outro horário ]                             |
|  [ Mover ]                                     |
|  [ Excluir ]                                   |
+-----------------------------------------------+
```

`[Alterar plantonista]`, `[Outro horário]` e `[Excluir]` já existem
hoje dentro de `ModalEditarAtribuicaoPlantao` (modo `editar`) — este
redesign só organiza essas ações como uma lista explícita em vez de um
formulário único sempre aberto. `[Aplicar padrão deste dia]` (§ 18) e
`[Mover]` (mudar a data de uma atribuição existente sem reabrir o
formulário completo) são novidades conceituais desta fase — ambas
avaliáveis para `PLANTAO-PADRAO-1`/`ESCALAS-UX-2B`, nunca implementadas
nesta fase de design.

---

## 23. Resumo — de aba para faixa persistente

A aba "Resumo" (considerada pouco útil em homologação, § 2.3) deixa de
ser uma aba navegável e vira uma **faixa persistente** logo abaixo do
`ScheduleHeader`, sempre visível, nunca exigindo navegação:

```
4 plantonistas · 32 plantões · 504h · 2 horários para conferir · 4 pendências
```

- Números vêm exatamente dos mesmos cálculos já existentes
  (`conferirEscalaAtualPlantao()`, `resumirPorPessoa()`,
  `contarPendenciasVinculoPlantao()`) — nenhum cálculo novo.
- "Horários para conferir" refere-se a durações atípicas
  (`quantidadeDuracoesAtipicas`) — rótulo neutro, nunca "problema"/
  "erro", preservando a regra já estabelecida de nunca chamar uma
  duração atípica de "errada" sem confirmação do coordenador.
- Clicar em "N pendências" abre o painel de Pendências (§ 26) — mesma
  ideia do já existente `onMudarAba('vinculos')`, só que a partir de uma
  faixa sempre visível em vez de uma aba entre outras.
- A aba "Resumo" como destino próprio de navegação é removida —
  qualquer conteúdo que restar de erros/avisos estruturais de uma
  importação (`resultado.erros`/`resultado.avisos`) passa a viver dentro
  da seção "Conferência do arquivo importado" (§ 24), nunca duplicado em
  dois lugares.

---

## 24. Lista

Vira uma visualização ALTERNATIVA ao calendário/grade, nunca uma aba
extra entre outras — um toggle simples ao lado do editor central:

```
[ Calendário ]  [ Lista ]
```

```
Data       Plantonista     Horário          Duração   Situação        
19/08      Bruno Bueno     19:00 → 07:00    12h       OK        [Editar]
20/08      Caroline F.     00:00 → 00:00    24h       OK        [Editar]
21/08      Caroline F.     19:00 → 00:00    5h        ⚠ atípico [Editar]
22/08      (planilha)      19:00 → 07:00    12h       ⚠ pendente [Editar]
```

- Filtros: `Todos` / `Horários atípicos` / `Pendências` — sobre a
  MESMA working copy que o calendário já usa (nunca uma segunda
  fonte de dados).
- **Correção explícita do problema atual**: "Usuário não encontrado"
  não se repete uma vez por atribuição da mesma pessoa pendente — a
  Lista continua mostrando cada atribuição (a granularidade correta
  para "editar"), mas o rótulo de situação usa o NOME/identificador da
  planilha em vez de repetir a frase completa por linha, e o filtro
  "Pendências" permite ver de uma vez só as linhas de uma mesma pessoa
  agrupadas visualmente (mesmo agrupamento por dia que o calendário já
  usa, `agruparAtribuicoesPorDia()`, aplicado aqui por pessoa).

---

## 25. Contabilidade

Redesenho em duas camadas, nunca misturando working copy com dados da
fonte (regra já vigente em `EDITOR_ESCALAS.md` § 5):

```
Escala atual
32 plantões · 504h · 4 pessoas · 2 horários atípicos

Por plantonista
Bruno       10     156h
Caroline    11     192h
Claudio      0       0h
Jean        11     156h

▸ Conferência do arquivo importado           (recolhível, só quando origem = IMPORTADO)
  Intervalos encontrados: 34
  Duração literal dos intervalos: 528h
  Contabilidade informada na planilha: 32 plantões · 504h
  Total declarado na planilha: 32 plantões · 504h
```

- "Escala atual" e "Por plantonista" vêm sempre da working copy
  (`conferirEscalaAtualPlantao()`/`resumirPorPessoa()`) — idênticos
  para qualquer origem (`IMPORTADO`/`MANUAL`/`COPIADO`/reaberto).
  "Conferência do arquivo importado" só aparece quando existe uma fonte
  real (`resultado !== null`) e fica **recolhida por padrão** (nunca
  expandida automaticamente) — informação auditável disponível, nunca
  obrigatória de olhar.
- Nenhuma reconciliação automática entre as duas camadas — divergência
  entre "Escala atual" e "Conferência do arquivo importado" continua
  sendo mostrada como fato, nunca escondida ou "corrigida" por cálculo.

---

## 26. Pendências / Vínculos

A aba "Vínculos" deixa de ser uma aba de navegação principal — vira
**"Pendências (N)"**, acessível como painel/drawer a partir da faixa
persistente (§ 23) ou de um badge no `ScheduleHeader`:

```
Pendências (4)                                              [x]

Bruno Bueno (planilha)                    [ Vincular... ]
Ana Souza (planilha)                      [ Vincular... ]
lvergani (inativo no grupo)               [ Reativar e vincular ]
desconhecido@x (login não encontrado)     [ Buscar usuário... ]
```

- Cada participante pendente aparece **UMA única vez** — nunca repetido
  por atribuição (correção explícita do problema já identificado na
  Lista, § 24, aplicado aqui também).
- Objetivo mantido: resolver identidade ANTES de salvar/publicar, sem
  transformar a reconciliação no foco do Editor — o painel continua
  bloqueando só "Salvar rascunho"/"Publicar", nunca a visualização do
  calendário/lista (regra já vigente desde PLANTÃO-2, preservada).
- Reaproveita integralmente `VinculoPlantao`/`confirmarVinculoPlantao()`/
  `desfazerVinculoPlantao()` já existentes — nenhuma estrutura de dados
  nova, só reposicionamento de "aba" para "painel contextual".

---

## 27. Grupos de Plantão — separar administração de uso mensal

Formalização explícita da distinção:

| Hoje | Proposta |
| --- | --- |
| `tela === 'plantoes'`: Grupo, equipe responsável, participantes, contatos, ACL, rascunhos — tudo junto, sob o rótulo "Plantões" | **Administração → Grupos de Plantão**: CRUD de Grupo, participantes, contatos, ACL (`equipeResponsavelId`/`equipesConsulta`), e (futuro) o padrão de horário do § 17 — tudo o que é configuração RARA, tocada por um administrador/gestor de vez em quando |
| (não existe destino separado) | **Escalas** (com contexto = um Grupo de Plantão específico): calendário, roster, contabilidade, pendências — tudo o que é trabalho MENSAL, tocado toda competência |

A lista de rascunhos por Grupo (`listarCompetenciasPlantaoRascunho()`,
já existente) muda de lugar: hoje aparece dentro da tela de
administração do Grupo; no redesign, "abrir um rascunho" acontece
através do seletor de competência já dentro do workspace de Escalas
(§ 6) — a tela de Administração → Grupos de Plantão para de precisar
saber sobre rascunhos/competências, focando só na configuração do
Grupo em si.

---

## 28. "Equipe responsável — sempre incluída"

Simplificação de UX (sem mudar o invariante já garantido por
`equipesConsultaEfetivas()`):

```
Equipe responsável
[ Analistas de Segurança                         v ]

Quem mais pode consultar?
[ SOC ]  [ NOC ]                                    + Adicionar

ℹ A equipe responsável já possui acesso.
```

- `equipeResponsavelId` continua sendo escolhido primeiro (via
  `OrganizationTeamPicker` em modo `single`, já existente).
- "Quem mais pode consultar?" mostra só as equipes ADICIONAIS —
  internamente, `equipesConsultaEfetivas()` continua garantindo que
  `equipesConsulta` sempre inclua `equipeResponsavelId` (invariante já
  implementado, nunca exposto ao coordenador como algo que ele precisa
  lembrar de fazer manualmente).
- O texto auxiliar ("A equipe responsável já possui acesso") substitui
  a necessidade de o coordenador entender a mecânica interna do array
  — a implementação (`equipesConsulta: string[]` sempre concreto,
  nunca opcional) não muda; só a apresentação.

---

## 29. Timezone

Continua no domínio (`GrupoPlantao.timezone`, obrigatório, validado) —
nenhuma remoção técnica proposta. Na UX de criação/edição comum do
Grupo, o campo passa a viver dentro de uma seção recolhida
**"Configurações avançadas"**, com um valor padrão sensato pré-selecionado
(o timezone organizacional já usado pela maioria dos Grupos existentes —
não um valor hardcoded por sigla, apenas o default de UI mais comum
hoje observado nos dados):

```
Configurações avançadas                                    ▸ (recolhido)
  Timezone
  [ America/Sao_Paulo                              v ]
```

O risco já registrado (mudar o timezone de um Grupo depois de rascunhos
salvos exibir horário civil errado ao reabrir, `EDITOR_ESCALAS.md`
§ 10) permanece exatamente como está — esconder o campo na UI comum não
resolve nem agrava esse risco, só reduz a chance de um coordenador mexer
nele sem necessidade durante a criação do Grupo.

---

## 30. Mobile

Projetado explicitamente para os dois tipos de escala, mesma estrutura
conceitual do desktop, sem coluna lateral fixa:

```
Desktop:                          Mobile:
+----------------+---------+      +---------------------+
| roster lateral | central |      | ScheduleHeader        |
| (sempre visível)|         |      +---------------------+
+----------------+---------+      | [Plantonistas ▾]      |  <- bottom sheet/collapse
                                   | (toca para expandir)  |
                                   +---------------------+
                                   |                       |
                                   |   Calendário/Agenda    |
                                   |   (rolagem vertical)   |
                                   |                       |
                                   +---------------------+
```

- Roster vira uma **bottom sheet recolhível** (ou uma aba compacta no
  topo) — nunca uma coluna lateral fixa competindo por espaço de tela.
- Selecionar uma pessoa (toque) → tocar um dia → mesmo modal do
  desktop (nenhuma lógica de domínio diferente entre plataformas).
- Drag-and-drop **não existe** no mobile — todas as operações (criar,
  editar, aplicar padrão, mover, excluir) funcionam inteiramente via
  toque, sem nenhuma dependência de arrastar.
- O calendário continua a mesma janela 26→25, com rolagem vertical
  (padrão já usado hoje) em vez de qualquer grade horizontal apertada.

---

## 31. Arquitetura de componentes proposta

Nomes ilustrativos — podem mudar na implementação real; o que importa
são as responsabilidades e fronteiras.

| Componente | Responsabilidade | Fronteira (o que NÃO faz) |
| --- | --- | --- |
| `ScheduleWorkspace` | Shell do workspace: monta `ScheduleHeader` + `ScheduleHealthSummary` + roster + editor central conforme o contexto ativo. Único ponto que decide "Grade ou Calendário". | Nunca contém lógica de domínio de jornada OU Plantão — só orquestra qual filho renderizar. |
| `ScheduleContextSwitcher` | Dropdown "Escala atual" (§ 6/§ 7) — lê a lista de Jornadas/Grupos de Plantão acessíveis e emite a troca de contexto. | Nunca decide o que fazer com a troca (não sabe salvar/descartar working copy) — só emite o novo `ContextoEscalaAtivo` (§ 32). |
| `ScheduleHeader` | Contexto + competência + status + ação Salvar/Publicar, sempre no topo do workspace. | Nunca contém o roster nem o editor central. |
| `NewScheduleDialog` | O modal "+ Nova escala" completo (as duas etapas, § 8/§ 9/§ 10, incluindo a importação inline § 11). | Nunca escreve no Firestore diretamente — delega para as mesmas ações já existentes (`criarPlantaoEmBrancoAcao`/`usarPeriodoAnteriorAcao`/equivalentes de Jornada). |
| `ScheduleRoster` | Painel lateral de pessoas (§ 14) — lista, busca, seleção ativa, contador. Compartilhado entre Jornada e Plantão (dados diferentes, mesmo componente). | Nunca decide o que acontece ao clicar num dia — só expõe "quem está selecionado" para o editor central consultar. |
| `ScheduleHealthSummary` | Faixa persistente de números (§ 23) — substitui a aba "Resumo". | Nunca navega sozinha — só emite eventos (ex.: "abrir Pendências") para o workspace decidir o que abrir. |
| `PlantaoEditor` | Composição de `PlantaoCalendario` + Lista + toggle — o editor central quando o contexto é Plantão. Equivalente ao `PreviewPlantao` de hoje, sem a aba Resumo/Vínculos (que saem para `ScheduleHealthSummary`/`SchedulePendingIssues`). | Nunca renderiza a Grade nem sabe nada de `TurnosMes`. |
| `JornadaEditor` | Composição de `ScheduleGrid` + Lista equivalente + toggle — o editor central quando o contexto é Jornada. | Nunca renderiza o calendário de Plantão nem sabe nada de `AtribuicaoPlantaoEditavel`. |
| `PlantaoAccounting` | Contabilidade de Plantão (§ 25) — duas camadas (working copy + conferência da fonte recolhível). | Nunca mistura os dois números num só; nunca reconcilia automaticamente. |
| `SchedulePendingIssues` | Painel de Pendências/Vínculos (§ 26), compartilhável entre os dois tipos de escala onde fizer sentido (jornada 6x1 hoje não tem conciliação de vínculo, mas o padrão de "uma pendência por pessoa, nunca por atribuição" é genérico). | Nunca bloqueia visualização — só "Salvar"/"Publicar". |

Nenhum desses componentes substitui os já existentes e testados
(`PlantaoCalendario`, `ModalEditarAtribuicaoPlantao`, `ScheduleGrid`) —
eles são composições/reorganizações ao redor do que já existe.
`lib/editorPlantao.ts`/`lib/montagemRascunhoPlantao.ts` continuam sendo
a única fonte de lógica de domínio; nenhum dos componentes acima
duplicaria cálculo nenhum já existente.

---

## 32. Modelo de estado/contexto proposto

Problema central a resolver (§ 3.4/§ 7): hoje não existe uma variável
única "o que estou editando" — jornada e Plantão são dois blocos de
estado paralelos, e trocar de um para o outro é trocar de `tela`, o que
faz o outro parecer "sumido".

Proposta conceitual (formato de dado, não código de produção):

```ts
// Conceitual — não implementado nesta fase.
type ContextoEscalaAtivo =
  | { tipo: 'JORNADA'; equipeId: string; competencia: string }
  | { tipo: 'PLANTAO'; grupoId: string; competencia: string }
  | null; // nenhuma escala selecionada ainda (ex.: primeiro acesso)

// O estado de CADA contexto já visitado continua vivo, indexado por
// uma chave estável (ex.: `${tipo}:${equipeId|grupoId}:${competencia}`),
// nunca destruído ao trocar de contexto — só o contexto ATIVO muda.
interface EstadoWorkspace {
  contextoAtivo: ContextoEscalaAtivo;
  workingCopies: Record<string, WorkingCopyJornada | WorkingCopyPlantao>;
}
```

Princípios que este modelo formaliza:

- **Nunca misturar `Equipe`, `GrupoPlantao`, competência e working copy
  num único objeto solto** — `ContextoEscalaAtivo` é só a REFERÊNCIA
  (que tipo, qual alvo, qual competência); a working copy em si
  continua vivendo separadamente, indexada por esse contexto.
- **Trocar de contexto nunca descarta a working copy do contexto
  anterior** — resolve diretamente o bug relatado em homologação
  ("trocar para Plantão faz SOC sumir da Grade"): a Jornada continua
  com seu estado intacto em `workingCopies`, só não está sendo exibida
  porque `contextoAtivo` mudou. Voltar para "SOC · Jornada 6x1"
  restaura exatamente o que estava lá, sem reconsultar o Firestore
  (a menos que o próprio dado tenha mudado, mesma regra de cache já
  usada hoje por `rascunhosPlantaoPorGrupo`/`participantesPorGrupoPlantao`).
- **Mudar de `SOC Jornada` para `COSI Plantão`**: é só reatribuir
  `contextoAtivo` — o workspace (`ScheduleWorkspace`, § 31) reage e
  troca o editor central (`JornadaEditor` → `PlantaoEditor`); nenhuma
  navegação de "tela", nenhum unmount de estado que precise ser
  reidratado do zero.
- **Nenhuma persistência nova nesta fase** — este é um modelo de
  ESTADO DE FRONTEND (React), não um novo documento Firestore; o que já
  é persistido (`CompetenciaPlantao`, `TurnosMes`, rascunhos) continua
  exatamente igual. A única mudança é como o Dashboard organiza, EM
  MEMÓRIA, o que já busca do Firestore hoje.

---

## 33. Wireframes

### 33.1 Sidebar nova

```
┌──────────────────┐
│ 🏠 Escala ICI      │
│                    │
│ 🏠 Visão geral      │
│ 📅 Escalas          │
│ 🔁 Trocas           │
│ 👥 Usuários         │
│ 🛡️ Administração    │
│                    │
│ ─────────────────  │
│ ● Sistema           │
│   operacional       │
└──────────────────┘
```

### 33.2 Header com seletor de escala

```
┌───────────────────────────────────────────────────────────────────┐
│ ☰  Escala atual            Competência                             │
│    [ SOC · Jornada 6x1 v]  [ Agosto 2026  v]   [Rascunho] [Salvar] │
│                                              🔔   🌗   João V. v   │
└───────────────────────────────────────────────────────────────────┘
```

### 33.3 Modal Nova Jornada (etapa 2)

```
┌───────────────────────────────────────────┐
│ Nova escala de jornada                 [x]│
│                                             │
│ Equipe                                     │
│ [ Selecionar equipe                    v]  │
│                                             │
│ Competência                                │
│ [ Agosto 2026                          v]  │
│ 26 jul → 25 ago                             │
│ ───────────────────────────────────────── │
│ Como começar?                              │
│ [Importar planilha][Criar vazia][Usar ant.]│
└───────────────────────────────────────────┘
```

### 33.4 Modal Novo Plantão (etapa 2)

```
┌───────────────────────────────────────────┐
│ Novo Plantão                           [x]│
│                                             │
│ Grupo de Plantão                           │
│ [ Selecionar grupo                     v]  │
│                                             │
│ Competência                                │
│ [ Agosto 2026                          v]  │
│ 26 jul → 25 ago                             │
│ ───────────────────────────────────────── │
│ Como começar?                              │
│ [Importar planilha][Criar vazia][Usar ant.]│
└───────────────────────────────────────────┘
```

### 33.5 Importação inline

```
┌───────────────────────────────────────────┐
│ Novo Plantão — Importar planilha       [x]│
│                                             │
│   ┌─────────────────────────────────┐     │
│   │   Solte o arquivo aqui            │     │
│   │   ou toque para selecionar         │     │
│   └─────────────────────────────────┘     │
│                                             │
│                        [Voltar] [Continuar]│
└───────────────────────────────────────────┘
        depois de um arquivo real:
┌───────────────────────────────────────────┐
│ escala-agosto.xlsx selecionado             │
│ ✓ 32 plantões · 4 plantonistas             │
│                        [Voltar] [Continuar]│
└───────────────────────────────────────────┘
```

### 33.6 Workspace Plantão desktop

```
┌─────────────────────────────────────────────────────────────────┐
│ Plantão de Segurança·COSI v | Agosto 2026 v | [Rascunho] [Salvar]│
├─────────────────────────────────────────────────────────────────┤
│ 4 plantonistas · 32 plantões · 504h · 2 atípicos · 4 pendências  │
├────────────────┬──────────────────────────────────────────────────┤
│ Plantonistas 🔍 │ [ Calendário ]  [ Lista ]                        │
│                │                                                    │
│ ○ Bruno B.     │   D    S    T    Q    Q    S    S                 │
│   10 · 156h    │  ┌──┬──┬──┬──┬──┬──┬──┐                          │
│ ● Caroline F.  │  │26│27│28│29│30│31│01│  ...                     │
│   11 · 192h    │  │  │BB│  │CF│  │  │  │                          │
│ ○ Claudio      │  └──┴──┴──┴──┴──┴──┴──┘                          │
│   0 · 0h       │                                                    │
│ ○ Jean         │                                                    │
│   11 · 156h    │                                                    │
└────────────────┴──────────────────────────────────────────────────┘
```

### 33.7 Workspace Jornada desktop

```
┌─────────────────────────────────────────────────────────────────┐
│ SOC · Jornada 6x1 v      | Agosto 2026 v | [Rascunho] [Publicar] │
├─────────────────────────────────────────────────────────────────┤
│ 6 colaboradores · faltam 3 dias sem turno definido               │
├────────────────┬──────────────────────────────────────────────────┤
│ Colaboradores 🔍│ [ Grade ]  [ Lista ]                             │
│                │                                                    │
│ Ana Silva      │        26  27  28  29  30  31  01                │
│ Bruno Costa    │  Ana    M   M   T   T   F   DU  DU               │
│ Caio Souza     │  Bruno  T   T   N   N   M   M   DF               │
│ ...            │  ...                                              │
└────────────────┴──────────────────────────────────────────────────┘
```

### 33.8 Roster lateral (detalhe)

```
┌────────────────────┐
│ Plantonistas    🔍  │
├────────────────────┤
│ ○ Bruno Bueno       │
│   10 plantões·156h  │
├────────────────────┤
│ ● Caroline F.       │  ← selecionado (aria-pressed)
│   11 plantões·192h  │
├────────────────────┤
│ ○ Claudio           │
│   0 plantões · 0h   │  ← participante sem atribuição, continua visível
├────────────────────┤
│ ○ Jean              │
│   11 plantões·156h  │
└────────────────────┘
```

### 33.9 Contabilidade

```
┌───────────────────────────────────────────┐
│ Escala atual                               │
│ 32 plantões · 504h · 4 pessoas · 2 atípicos│
│                                             │
│ Por plantonista                            │
│ Bruno        10     156h                   │
│ Caroline     11     192h                   │
│ Claudio       0       0h                   │
│ Jean         11     156h                   │
│                                             │
│ ▸ Conferência do arquivo importado          │
└───────────────────────────────────────────┘
```

### 33.10 Pendências

```
┌───────────────────────────────────────────┐
│ Pendências (4)                         [x]│
│                                             │
│ Bruno Bueno (planilha)     [Vincular...]   │
│ Ana Souza (planilha)       [Vincular...]   │
│ lvergani (inativo)      [Reativar/vincular]│
│ desconhecido@x (não encontrado) [Buscar...]│
└───────────────────────────────────────────┘
```

### 33.11 Mobile — Plantão

```
┌─────────────────────┐
│ ☰ Plantão COSI  🔔 v │
│ Agosto 2026 [Rascunho]│
├─────────────────────┤
│ 4·32·504h·4 pend.     │
├─────────────────────┤
│ [Plantonistas ▾]      │ <- toca para abrir bottom sheet
├─────────────────────┤
│ [Calendário][Lista]   │
│                       │
│  26/08                │
│  ┌─────────────────┐  │
│  │ Bruno B.          │  │
│  │ 19:00–07:00       │  │
│  └─────────────────┘  │
│  27/08                │
│  (vazio)              │
│  ...                  │
└─────────────────────┘
```

### 33.12 Mobile — Jornada

```
┌─────────────────────┐
│ ☰ SOC · Jornada  🔔 v │
│ Agosto 2026 [Rascunho]│
├─────────────────────┤
│ 6 colaboradores        │
├─────────────────────┤
│ [Colaboradores ▾]     │ <- bottom sheet
├─────────────────────┤
│ [Grade][Lista]        │
│                       │
│  26/08 — Ana: M        │
│  26/08 — Bruno: T      │
│  26/08 — Caio: N       │
│  ...                  │
└─────────────────────┘
```

---

## 34. Matriz atual → novo

| Tela/controle atual | Problema | Destino no redesign | Reutilizar? | Remover? | Refatorar? |
| --- | --- | --- | --- | --- | --- |
| **Importar escala** (tela) | Trata uma ação como destino; app abre nela por padrão | Vira progressive disclosure dentro de "+ Nova escala" (§ 11) | Sim — `processarArquivoImportado`/parser reaproveitados | Remover como item de sidebar/tela | Refatorar como modal step |
| **Escalas** (tela) | Só conhece jornada 6x1 (`DashboardApp.tsx:6032-6079`) | Vira o destino único de "Escalas" — mostra o contexto ativo (Jornada OU Plantão) | Sim — histórico de publicação 6x1 reaproveitado | Não | Refatorar para ser agnóstica de tipo, via `ScheduleWorkspace` |
| **Grade** (tela) | Item de sidebar próprio, alcançável por 3 caminhos, "sumia" ao trocar contexto | Vira o editor central quando contexto = Jornada | Sim — `ScheduleGrid` sem mudança de props | Remover como item de sidebar | Refatorar local de montagem |
| **Plantões** (tela) | Mistura administração de Grupo com o que deveria ser uso mensal | Administração → Grupos de Plantão | Sim — CRUD de Grupo/participantes/contatos reaproveitado | Remover rótulo/posição atual | Refatorar destino |
| **Resumo** (aba) | Pouco útil em homologação, mistura conceitos | Faixa persistente `ScheduleHealthSummary` (§ 23) | Sim — cálculos reaproveitados | Remover como aba | Refatorar apresentação |
| **Lista** (aba) | Repete pendência por atribuição, confusa | Toggle "Lista" ao lado do Calendário/Grade (§ 24) | Sim — dados/estrutura reaproveitados | Não | Refatorar agrupamento de pendências |
| **Contabilidade** (aba) | Mistura implícita entre working copy e fonte | `PlantaoAccounting` com seção recolhível de fonte (§ 25) | Sim — cálculos reaproveitados | Não | Refatorar layout/separação |
| **Vínculos** (aba) | Repete status por atribuição, disputa espaço com abas de trabalho | `SchedulePendingIssues` (painel/drawer "Pendências (N)") (§ 26) | Sim — `VinculoPlantao`/ações reaproveitadas | Remover como aba | Refatorar apresentação, agrupar por pessoa |
| **Novo Plantão** (etapa 2 do modal) | Label+campo na mesma linha, select sem affordance, hierarquia fraca (§ 2.1) | Mesma etapa, redesenhada (§ 10) | Sim — mesma lógica de validação/criação | Não | Refatorar layout visual |
| **Novo Grupo** (`ModalGrupoPlantao`) | Mistura timezone/ACL com criação comum | Timezone em "Configurações avançadas" (§ 29); ACL simplificada (§ 28) | Sim — schema/validação inalterados | Não | Refatorar apresentação |
| **Seletor de competência** (`.competence-control`) | String estática, nunca reage a nada | Dropdown real dentro do `ScheduleHeader` (§ 6) | Parcial — reaproveita a classe visual como base | Remover o comportamento estático | Refatorar para componente interativo |

---

## 35. Riscos

1. **Migrar "Grade" de destino de sidebar para editor central é uma
   mudança estrutural em `Tela`/roteamento** — precisa de um plano de
   compatibilidade (ex.: manter `setTela('grade')` funcional durante a
   transição, redirecionando para o novo workspace) para não quebrar
   nenhum link/atalho existente (ex.: o sino de alertas 6x1 hoje navega
   para `tela='grade'`).
2. **O modelo de estado por contexto (§ 32) precisa decidir o que
   acontece com uma working copy "suja" (não salva) ao trocar de
   contexto** — este documento propõe preservar o estado, mas a
   implementação real precisa decidir se avisa o coordenador ("você
   tem alterações não salvas em SOC · Jornada 6x1") ao trocar, ou se
   confia silenciosamente na preservação em memória (risco de perda se
   o navegador fechar antes de o coordenador voltar a esse contexto).
3. **Aplicar a mesma segunda etapa (Importar/Vazia/Anterior) à Jornada
   6x1 exige implementar "Criar vazia"/"Usar anterior" para 6x1**, que
   hoje não existem — é trabalho adicional real, não só UI (equivalente
   ao que ESCALAS-UX-1B/1C já fizeram para Plantão, mas para o modelo
   de dado `TurnosMes`/grade fixa por célula, que tem particularidades
   próprias — feriados, códigos de turno fixos).
4. **Painel/drawer de Pendências compartilhado entre Jornada e
   Plantão** pode não fazer sentido 1:1 — jornada 6x1 hoje não tem
   conciliação de vínculo (usuários já são cadastrados por login desde
   o início) — a implementação real pode precisar de duas variantes do
   mesmo conceito, não um componente idêntico.
5. **O padrão de horário por Grupo (§ 17) é a mudança de schema mais
   arriscada mencionada neste documento** — qualquer campo novo em
   `GrupoPlantao` precisa de uma auditoria de Rules/migração própria
   (mesmo cuidado já demonstrado nas fases anteriores ao avaliar se uma
   mudança de schema é "significativa"), tratada como fase isolada
   (`PLANTAO-PADRAO-1`), nunca misturada com a navegação.
6. **Remover a aba "Vínculos"/"Resumo" como abas de navegação pode
   quebrar testes de boundary existentes** que hoje verificam a
   presença dessas abas/rótulos (`tests/plantao-editor-boundaries.test.mjs`,
   `tests/plantao-preview-boundaries.test.mjs`) — a fase de implementação
   precisa revisar e atualizar esses testes deliberadamente, nunca
   apagá-los silenciosamente para "fazer passar".
7. **Reorganizar a sidebar e o `Tela` union type toca em muitos pontos
   do arquivo `DashboardApp.tsx` (7700+ linhas) simultaneamente** — alto
   risco de regressão se feito em uma única fase; a divisão em
   microfases (§ 36) existe justamente para isolar esse risco.

---

## 36. Plano de microfases (proposto)

O pedido sugeriu uma sequência; ela é adotada quase integralmente, com
um ajuste: `ESCALAS-UX-2A` é dividida em duas (2A e 2A.1) porque migrar
a NAVEGAÇÃO (sidebar/`Tela`) e migrar o CONTEXTO/SHELL (context
switcher, header) são riscos de tamanhos e naturezas diferentes — a
primeira é uma reorganização de roteamento existente (baixo risco de
lógica, alto risco de "esqueci um link"), a segunda introduz um
conceito de estado novo (`ContextoEscalaAtivo`, § 32) que não existe
hoje. Separá-las permite validar a navegação nova ANTES de introduzir o
modelo de contexto novo por cima dela.

| Microfase | Escopo | Depende de |
| --- | --- | --- |
| **ESCALAS-UX-2A** | Sidebar nova (§ 5): remove "Importar"/"Grade"/"Plantões" como itens; "Escalas" vira destino único de trabalho; "Plantões" (conteúdo) migra para Administração → Grupos de Plantão (§ 27). Migração de rotas internas (`setTela('grade')` etc.) para o novo destino, sem ainda introduzir o `ContextoEscalaAtivo`. | — |
| **ESCALAS-UX-2A.1** | `ScheduleContextSwitcher` + `ScheduleHeader` + modelo `ContextoEscalaAtivo` (§ 6/§ 7/§ 32); `NewScheduleDialog` com as três formas de começar para AMBOS os tipos (§ 9/§ 10/§ 11), incluindo implementar "Criar vazia"/"Usar anterior" para Jornada 6x1 (risco § 35.3). | ESCALAS-UX-2A |
| **PLANTAO-PADRAO-1** | Padrão semanal configurável por Grupo (§ 17/§ 18) — schema, Rules, UI de configuração em Administração → Grupos de Plantão, e o card "Padrão do grupo" no modal de criação. Fase isolada por causa do risco de schema (§ 35.5). | ESCALAS-UX-2A (para o novo local de Administração já existir) |
| **ESCALAS-UX-2B** | Roster lateral (§ 14) substituindo "Resumo por pessoa"; interação rápida (clique+clique já existe, só reposiciona); drag-and-drop opcional (§ 16) como atalho adicional sobre o mesmo pipeline de criação. | ESCALAS-UX-2A.1 |
| **ESCALAS-UX-2C** | Contabilidade redesenhada (§ 25), Pendências como painel (§ 26), limpeza de Lista (§ 24)/Resumo (§ 23) como abas — remoção formal das abas antigas, atualização de boundary tests (risco § 35.6). | ESCALAS-UX-2A.1 |
| **HOMOLOGAÇÃO VISUAL** | Validação end-to-end do novo workspace (desktop 1440/1024, mobile 412/390/360, light/dark) para os dois tipos de escala, com o usuário testando diretamente (sem emulador+Playwright autônomo, conforme preferência já registrada). | ESCALAS-UX-2A, 2A.1, 2B, 2C |
| **PLANTÃO-3C** | Publicação/histórico de Plantão — só depois do workspace estabilizado, para a UI de publicação já nascer dentro do novo `ScheduleHeader`/status, nunca como mais uma tela solta. | HOMOLOGAÇÃO VISUAL |

Esta fase de design (**ESCALAS-UX-2**) não inicia nenhuma das
microfases acima — apenas as define para aprovação futura.

---

## 37. Confirmação de zero mudanças funcionais

Nesta fase, **nenhum arquivo de código de produto foi alterado**:
`apps/dashboard/src/DashboardApp.tsx`, `app/globals.css`,
`components/`, `lib/`, `packages/`, `firestore.rules`,
`firestore.indexes.json` permanecem bit-a-bit idênticos ao estado
anterior a este documento (confirmado por `git status`/`git diff` no
relatório final desta fase). Apenas dois arquivos novos de
documentação foram criados: este documento
(`docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`) e
`CHECKPOINT-FASE-ESCALAS-UX-2-REDESIGN-WORKSPACE.md`; `docs/README.md`
foi atualizado para referenciar o novo documento.
