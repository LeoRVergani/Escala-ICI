# Specs oficiais — Escala ICI

Esta pasta concentra a fonte normativa atual do projeto. Checkpoints e arquivos de entrega são histórico: eles ajudam a entender o que foi feito, mas não substituem as specs listadas aqui.

## Ordem de leitura para alterações no Dashboard

1. `ESCALA_ICI_MASTER_SPEC.md` — índice funcional e decisões consolidadas do Dashboard.
2. `STAGING_RESET_HIERARQUIA_ICI.md` — reset controlado do staging com o organograma canônico do ICI e liberação operacional ampla de coordenador/supervisor, exclusiva de staging.
3. `ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md` — árvore organizacional sanitizada de referência para cadastro, navegação, filtros e contexto; não autoriza escala.
5. `MIGRACAO_IDS_ORGANIZACIONAIS_PRODUCAO.md` — contrato diferido para a base final: staging preserva IDs legados e produção nasce com IDs organizacionais canônicos.
6. `ESCOPO_OPERACIONAL_MATRIZ.md` — matriz explícita de responsáveis por Jornada/Plantão; organograma/cargo/unidade são contexto, não autorização operacional automática.
7. `WIZARD_PREPARAR_ESCALA.md` — fluxo unificado de `Nova escala` e `Importar escala`.
8. `VISAO_GERAL_OPERACIONAL_SOC_PLANTAO.md` — Visão geral operacional SOC + Plantão.
9. `JORNADA_6X1_ASSISTENTE_CICLO.md` — grade Jornada 6x1 e assistente de ciclo inicial.
10. `REVISAO_JORNADA_6X1_LAYOUT_CALENDARIO.md` — revisão/importação SOC com calendário central ampliado.
11. `PLANTAO_MODAL_D.md` — modal visual de atribuição de Plantão, presets e exceção manual.
12. `NAVEGACAO_RETORNO_ESCALAS.md` — padrão de retorno visual para Escalas.
13. `UI_CASCADE_E_HERANCA.md` — regra permanente para alterações de CSS/layout.
14. `APP_PLANTAO_VISUALIZACAO.md` — visão "Plantão" no App/PWA do colaborador (quem está de plantão agora/próximo, meus plantões, contatos do plantonista).
15. `INFORMACOES_ESCALA.md` — informações operacionais dia/pessoa-dia (Feriado, Treinamento, DU, Férias...), separadas de `TurnosMes` e reaproveitando 100% da Matriz para autorização. Parte B1 (domínio/Rules/repository) concluída; Dashboard/App/importação ainda pendentes.
16. `PLANTAO_CODB.md` — Plantão CODB é UM GrupoPlantao multi-função (postos DBA/Linux/Telecom/Windows na mesma atribuição, via `FuncaoPlantao`), com anchor técnico `GEDSI_CODB_PLANTAO` — nunca quatro Equipes/Grupos/Matrizes/publicações. Separa definitivamente a responsabilidade do Coordenador CODB (Plantão CODB) da Supervisora NOC (Jornada NOC): hierarquia nunca concede escala. Parser/domínio/Rules concluídos; provisionamento em staging, Hub, Editor, importação real e App ainda pendentes.
17. `IMPORTADOR_UNIVERSAL_ESCALAS.md` — modelo canônico neutro (`RegistroEscalaCanonico`) e entrypoint único de análise (`analisarArquivoEscalaPlantao()`) para o domínio Plantão, por trás dos parsers/detectores já existentes (nunca substituídos). Corrigiu a causa raiz real de "4 plantonistas em vez de 17" no Plantão CODB. Jornada 6x1 e o scanner genérico de qualquer estrutura tabular ainda não migrados — dívida documentada na própria spec.
18. `PLANTAO_MULTIPOSTO.md` — spec genérica (não específica de CODB) do workspace de Plantão multi-função: tabs Todos/postos geradas de `grupo.funcoesEsperadas`, cards de saúde por posto (`CardFuncaoPlantao`), filtro único (`filtrarAtribuicoesPlantaoPorFuncao`), vínculos/conflitos/postos-faltando por posto (`lib/plantaoMultiposto.ts`), e "Nova escala" com posto único ou múltiplos postos. `FuncaoPlantao` continua o enum fechado atual — postos além dele exigem evolução de modelo, fora desta fase.

## Specs herdadas ainda válidas por domínio

- `STAGING_RESET_HIERARQUIA_ICI.md` — fases STAGING-RESET-HIERARQUIA-ICI-1/2/3: reset controlado de staging, IDs canônicos de unidade/equipe, `souCoordenadorOperacionalStaging()`, cadastro livre de unidade/equipe, descrição textual de nível hierárquico, e separação de pessoas reais (nunca hardcoded) do seed estrutural.
- `HIERARQUIA_ORGANIZACIONAL.md` — domínio organizacional, permissões e regra de não hardcode.
- `ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md` — estrutura organizacional de referência do produto, com níveis, unidades, siglas e regras sanitizadas para cadastro/contexto.
- `ESCOPO_OPERACIONAL_MATRIZ.md` — fonte normativa atual para quem administra ou apenas consulta cada Jornada/Plantão.
- `ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` — escopo administrativo de `GESTOR_UNIDADE` sobre Unidades/Equipes/Grupos de Plantão (`lib/escoposOperacionais.ts`). A autorização operacional por unidade desta spec agora é **Regra transitória / fallback de compatibilidade** quando não existir matriz explícita para o alvo.
- `ADMINISTRACAO_E_HIERARQUIA.md` — fluxos administrativos atuais e matriz de permissões.
- `AUTENTICACAO_FIREBASE_MICROSOFT_EMAIL.md` — login Microsoft/e-mail e identidade por `usuarios/{login}`.
- `LEMBRETES.md` — módulo de Lembretes, separado de Escalas.
- `TROCA_ESCALA_PLANO.md` — módulo de Trocas no estado atual.
- `APP_PLANTAO_VISUALIZACAO.md` — fonte normativa da aba "Plantão" no App/PWA do colaborador e da autoatualização de contatos do plantonista.
- `INFORMACOES_ESCALA.md` — domínio de informações operacionais dia/pessoa-dia, apartado de `TurnosMes`, sem ACL paralela à Matriz.
- `PLANTAO_CODB.md` — Plantão CODB como GrupoPlantao multi-função (`FuncaoPlantao`), anchor técnico `GEDSI_CODB_PLANTAO`, e a separação hierarquia×responsabilidade entre Coordenador CODB e Supervisora NOC.
- `IMPORTADOR_UNIVERSAL_ESCALAS.md` — modelo canônico e entrypoint único de análise do domínio Plantão (fonte única e multi-função), reaproveitando os parsers/detectores existentes.
- `PLANTAO_MULTIPOSTO.md` — workspace de Plantão multi-função (tabs/cards/filtro/saúde por posto) e Nova escala com posto único ou múltiplos postos.

Nota ESCOPO-OPERACIONAL-MATRIZ-1: a tela **Administração → Responsáveis por
escala** é a interface normativa para configurar responsáveis. Seed/fixture
serve só para bootstrap idempotente; colaboradores são carregados da equipe
da escala; `GrupoPlantao ativo:false` não influencia seletor, Wizard nem
destino operacional de Equipe.

Nota ESCOPO-OPERACIONAL-MATRIZ-1.1: responsável humano de escala precisa ser
usuário ativo com perfil `ADMIN_SISTEMA`, `GESTOR_UNIDADE`, `GESTOR_EQUIPE`
ou `SUPERVISOR_EQUIPE`. Analista/técnico comum não aparece como responsável;
exceções são resolvidas por promoção de perfil, não por hardcode. Separar
sempre Responsáveis, Equipes administradoras e Equipes que consultam.

Nota ESCOPO-OPERACIONAL-MATRIZ-1.2: a matriz autoriza o alvo, mas os dados da
escala são lidos pelo ID real do alvo. Jornada usa `equipeId`; Plantão usa
`grupoId`. A Visão geral deve distinguir **Sem escala**, **Rascunho** e
**Publicada**, contar colaboradores/participantes do alvo e nunca cair para a
equipe do responsável logado quando uma operação válida foi aberta.

Nota ESCOPO-OPERACIONAL-MATRIZ-2: a mesma matriz agora governa leitura e
escrita operacional. Jornada usa `equipeId`; Plantão usa `grupoId`; o contexto
ativo preserva `tipo`, `alvoId`, `label` e competência. `label` é apresentação,
`equipesConsulta` é somente leitura e o fallback legado vale exclusivamente
quando não existe documento de matriz para o alvo. Colaboradores continuam
pertencendo à equipe/grade da Jornada, nunca ao responsável.

Nota ESCOPO-OPERACIONAL-MATRIZ-2.1: o carregamento da matriz tem estados
explícitos de carregando/sucesso/vazio/erro e timeout; a UI nunca permanece em
loading infinito. `permission-denied` diagnostica Rules de staging não
publicadas, rede oferece **Recarregar operações**, e vazio orienta o vínculo em
**Administração → Responsáveis por escala**. Contexto salvo inválido ou ligado
a alvo/grupo inativo é removido. O fallback legado só roda com
`VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO=true`.

Nota ESCOPO-OPERACIONAL-MATRIZ-2.2: enquanto a migração de staging estiver
incompleta, o modo `staging.dashboard` habilita explicitamente o fallback para
alvos sem documento de matriz. Alvos já migrados continuam governados pela
matriz. As fontes de rascunho/publicação/histórico são assentadas
independentemente: dados válidos são preservados diante de falha parcial,
Rules e rede têm diagnósticos distintos e a ação **Recarregar operações**
repete a carga sem prender o seletor.

Nota IMPORTACAO-PLANTAO/JORNADA-PADRAO-1: interpretar planilha de Plantão é
working copy local e não pode ser bloqueado por uma checagem auxiliar negada;
erros de arquivo aparecem no próprio Wizard e sempre encerram o loading.
Jornada nova usa o período padrão individual do cadastro, aceita código/
descrição/alias e nunca converte valor ausente para Manhã. Login criado pela
conciliação herda o período detectado na planilha.
- `PLANTOES.md` e `EDITOR_ESCALAS.md` — contêm histórico e detalhes de domínio anteriores; para UI nova de Plantão/Jornada, preferir as specs novas acima. Exceção: `EDITOR_ESCALAS.md` § 14 (JORNADA-IMPORTACAO-VINCULOS-UX-1 — alertas/colaborador importado acionáveis, modal de vínculo, "Criar usuário"/"Associar usuário" a partir da conciliação) é normativa atual, não histórico.

## Decisões que não devem regredir

- `Nova escala` e `Importar escala` usam o mesmo wizard.
- O fluxo escolhe primeiro `Jornada 6x1` ou `Plantão`.
- Upload de planilha só aparece após tipo, destino e competência.
- O destino Jornada é uma `Equipe`; o destino Plantão é um `GrupoPlantao`.
- Área ativa é contexto de trabalho, não autorização nova.
- Não usar `usuario.equipeId` sozinho para decidir gestão.
- Não permitir self-escalation.
- Não deduzir responsabilidade operacional de escala apenas por organograma, cargo/função, unidade pai ou equipe do usuário.
- Não listar analista/técnico comum, usuário inativo ou usuário sem perfil de gestão como responsável humano de escala.
- Não confundir Responsáveis, Equipes administradoras e Equipes que consultam.
- `equipesConsulta` permite consulta/monitoramento, nunca edição.
- Criar, importar, salvar e publicar requer responsabilidade na matriz ativa ou `ADMIN_SISTEMA`.
- `GrupoPlantao ativo:false` não aparece em seletor operacional ou Wizard; aparece somente na Administração com badge Inativo.
- Visão geral e seletor superior usam `equipeId` para Jornada e `grupoId` para Plantão; nomes visuais não são chave de busca.
- Não tratar ausência de publicação como ausência total quando existe rascunho.
- Não hardcodar `COSI`, `SOC`, `NOC`, `CODB`, `GEDSI`, `EQ_SOC`, `EQ_PLANTAO_COSI` ou `EQ_SEG` como regra de negócio — vale também para os IDs canônicos novos (`GEDSI_COSI`, `GEDSI_CODB`, `GEDSI_COCR`, `GEDSI_COSI_SOC`, `GEDSI_COSI_PLANTAO`, `GEDSI_CODB_NOC`, `PLANTAO_GEDSI_COSI`): eles existem como DADO de staging (`scripts/staging/hierarquia-ici.mjs`), nunca como literal em `firestore.rules`/`lib/`.
- Não persistir `unidadeId` de uma coordenação como a sigla solta (`COSI`, `CODB`, `COCR`...) — sempre prefixado pela gerência-mãe (`GEDSI_COSI`, `GEDSI_CODB`, ...). `scripts/staging/validate-staging.mjs` falha explicitamente se encontrar isso.
- Quick-add/Modal de Plantão deve oferecer Noturno `19:00 → 07:00`, `5 horas` `19:00 → 00:00`, `24 horas` `19:00 → 19:00` e exceção manual.
- Dados importados atípicos são preservados; a UI pode alertar, mas não normalizar silenciosamente.
- Nenhuma versão estável (staging ou produção) pode depender de criação manual de `gruposPlantao/{grupoId}` pelo Console do Firestore — o produto (Wizard/Administração) e o seed (`scripts/seed-organizacao.mjs`) sempre oferecem um caminho oficial.
- Uma Equipe existir (mesmo com "Plantão" no nome) nunca implica que existe um `GrupoPlantao` — o seletor superior só mostra Plantões a partir de Grupo administrável.
- O seletor de visualização do calendário de Plantão (Compacta/Edição) muda só apresentação/interação; a preferência (`localStorage`) nunca é fonte de participantes, atribuições ou vínculos, e nunca influencia o que é salvo ou publicado.
- A tela inicial padrão do Dashboard é Visão geral; só navega para outra tela por ação do usuário ou por restauração de um contexto de escala explicitamente salvo.
- `cargo` real cadastrado em `usuarios/{login}` sempre prevalece sobre qualquer rótulo derivado de perfil/nível — o fallback só entra quando `cargo` está vazio e nunca é persistido.
- A tela Usuários, no contexto de um Grupo de Plantão, sempre inclui equipe responsável + `equipesConsulta` + unidade responsável — nunca só a equipe da última troca de contexto.
- Participar de um Plantão (`ParticipantePlantao`) nunca altera `perfil`/`escopo`/`equipeId`/`cargo` do usuário — um colaborador de Jornada pode também ser plantonista sem qualquer mudança de acesso.
- Trocar o contexto ativo (seletor superior) nunca força a navegação para "Escalas" quando a tela atual (Visão geral, Usuários, Trocas, Administração...) continua válida — só telas de editor/rascunho (`escalas`/`grade`/`importar`) podem ser redirecionadas automaticamente.
- O filtro de setor/equipe da tela Usuários é gerado a partir do próprio Grupo de Plantão (equipe responsável, `equipesConsulta`, unidade responsável) — nunca hardcoded por sigla, nunca duplica quem aparece em mais de uma categoria (ex.: SOC e Plantão ao mesmo tempo).
- As operações canônicas do Dashboard são só três: SOC (`JORNADA`/`GEDSI_COSI_SOC`), NOC (`JORNADA`/`GEDSI_CODB_NOC`) e Plantão COSI (`PLANTAO`/`PLANTAO_GEDSI_COSI`) — nunca existe uma operação genérica "Plantão"; qualquer card de Plantão vem de um `GrupoPlantao` real no escopo, ou não aparece.
- "Quais operações o Dashboard mostra, com qual status" tem uma única fonte, `resolverOperacoesDashboard()` (`lib/operacoesDashboard.ts`) — seletor superior e Visão geral nunca podem divergir sobre isso.
- Status operacional tem 4 estados únicos (sem-escala/rascunho/publicada/publicada-com-rascunho-pendente), derivados por uma única função (`derivarStatusOperacaoDashboard()`) — nenhuma tela recalcula status por conta própria.
- O título e a descrição de "Publicação da escala" (badge e texto abaixo dele) vêm sempre de `resumoPublicacaoOperacao(estado)` — nenhuma tela volta a calcular esse texto por um booleano solto.
- No App, a fonte da escala/atribuições de Plantão é sempre a competência publicada lida do Firestore — nunca `localStorage`, reservado só a preferências de UI.
- Autoatualização de contatos do plantonista (`atualizarContatosPlantonista`) sempre grava o próprio login autenticado — nunca um login recebido de fora — e nunca usa o gate de escrita administrativa.

Nota IMPORTACAO-PLANTAO-REVISAO-COMPACTA-1: a revisão de Plantão prioriza o
Calendário no topo, usa upload compacto e move fonte/divergências para o final.
Resumo e Lista deixam de ser abas; Contabilidade e Vínculos permanecem. Os
cartões exibem iniciais maiores e horário compacto ao lado. Participante sem
usuário pode abrir o cadastro no próprio Vínculos e é ligado somente depois de
salvar, sempre na equipe responsável do Grupo e sem associação automática ao
coordenador autenticado. A barra compacta anterior ao calendário concentra
**Importar outra planilha**, **Validar prévia**, **Salvar rascunho** e
**Publicar Plantão**; o card inferior de salvamento não deve reaparecer.

Nota CADASTRO-COORDENADOR-2: responsável operacional cadastra colaboradores,
coordenadores e supervisores na equipe da Jornada/Plantão administrado. A
delegação é explícita, limitada a `GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` com
escopo `EQUIPE`, e não altera a Matriz de Responsáveis. Plantão valida o Grupo
ativo e sua equipe responsável. Administração global, gestão de unidade e
equipes externas continuam exclusivas de `ADMIN_SISTEMA`. Erro de staging
distingue falta de responsabilidade de Rules ainda não publicadas.

Nota CODIGO-ORGANIZACIONAL-EQUIPE-1: a UI separa o ID técnico persistido do
código organizacional hierárquico. `EQ_SOC`, `EQ_NOC` e `EQ_PLANTAO_COSI`
continuam como chaves imutáveis; na apresentação aparecem, respectivamente,
como `GEDSI_COSI_SOC`, `GEDSI_CODB_NOC` e `GEDSI_COSI_PLANTAO`. O código é
calculado pela árvore, acompanha mudanças de unidade e nunca participa de
autorização, consulta ou escrita no Firestore.

Nota IDS-ORGANIZACIONAIS-PRODUCAO-1: a imutabilidade acima vale dentro do
ambiente já referenciado. O staging atual não é renomeado. Antes do primeiro
go-live, a base vazia de produção deve receber dados transformados para IDs
canônicos, incluindo `EQ_PLANTAO_COSI` → `GEDSI_COSI_PLANTAO`, conforme
`MIGRACAO_IDS_ORGANIZACIONAIS_PRODUCAO.md`. O corte exige backup, dry-run,
migração de todas as referências, Rules/índices testados e aprovação humana;
produção não aceita fallback legado.

Nota ESTRUTURA-ORGANIZACIONAL-REFERENCIA-1: o cadastro de unidades segue o
catálogo de siglas e nomes consolidado na spec de estrutura. Códigos de equipe
seguem **Gerência_Coordenação_FunçãoOuLocalidade**, como
`GEDSI_CODB_APROVACAO`, `GEDSI_COSI_N3_SEGURANCA` e `GESUP_COAT_SUP_ICI`.
Sigla ausente não é inventada. A taxonomia pode chamar Equipe e Grupo
Operacional de níveis operacionais, mas a persistência continua separada em
`equipes` e `gruposPlantao`; o padrão não cria seed obrigatório, não migra IDs
existentes e não concede autorização por nome ou sigla.

Nota PATCH-PLANTAO-PUBLICACAO-UX-VIEWS-1: corrigiu a publicação (não o
rascunho) do Plantão COSI (`grupoId PLANTAO_GEDSI_COSI`,
`unidadeResponsavelId GEDSI_COSI`, `equipeResponsavelId
GEDSI_COSI_PLANTAO`) por `GESTOR_UNIDADE` de `GEDSI_COSI` — causa raiz era um
`getDoc()` em `competenciasPlantao/{id}` inexistente estourando o limite de
expressões da regra, corrigido em `firestore.rules` com curto-circuito
`!exists(...) || podeLerEscalaPlantao(...)`, sem afrouxar autorização (ver
`ESCOPO_OPERACIONAL_MATRIZ.md` § 9.6/§ 10). Confirmado que participar da
escala como plantonista nunca altera `perfil`/`escopo` — o mesmo
`GESTOR_UNIDADE` pode administrar o Grupo e estar vinculado na própria
escala. A mensagem "regras não reconhecem a matriz" agora só nasce de uma
falha real e atual (booleano recalculado a cada falha, nunca congelado). O
mesmo patch trocou a escolha automática do modo visual do calendário de
Plantão (compacta/prévia vs. edição/arrastar, ambos já existentes em
`PlantaoCalendario`) por um seletor explícito e cosmético, e mudou a tela
inicial padrão do Dashboard de "Escalas" para "Visão geral". Ver
`docs/spec/EDITOR_ESCALAS.md` § 15.

Nota PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1: corrigiu três bugs de
leitura/apresentação — nenhuma Rule nova, nenhum seed/reset, publicação do
Plantão COSI intacta. (1) o cabeçalho do App usava um rótulo fixo por
`nivelHierarquico` em vez do `cargo` real cadastrado (`rotuloCargoExibicao()`,
`lib/sessao.ts`, cargo real sempre primeiro). (2) a tela Usuários, no
contexto de um Grupo de Plantão já Publicado sem rascunho aberto, ficava com
o pool de uma troca de contexto anterior — `aplicarTrocaContexto()` agora
sempre recarrega o mesmo pool amplo (`listarUsuariosElegiveisPlantao`) do
vínculo/importação. (3) o App só consultava Jornada 6x1 para "sem escala
publicada", ignorando Plantão — `mensagemAusenciaEscalaAcao()` agora
diferencia "sem Jornada 6x1" de "tem participação em Plantão" (leitura
tolerante a falha, nunca quebra o login). Confirmado que participação em
Plantão nunca altera perfil/cargo/equipe principal. Não implementa a visão
detalhada de Plantão no App nesta fase (a visão detalhada chega na fase
FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1, abaixo). Ver
`docs/spec/EDITOR_ESCALAS.md` § 16.

Nota FASE-MATRIZ-DEFINITIVA-E-INFORMACOES-DIA-1: Parte A (diagnóstico do
`permission-denied` ao publicar Jornada SOC) encontrou o incidente já
resolvido no ambiente: Rules de staging implantadas idênticas ao
`firestore.rules` local, Matriz de SOC ativa com `clis` em
`responsaveisLogin`, `config/ambiente.staging == true`, identidade de
Claudio íntegra (Auth + `usuarios/clis`), 341/341 testes de Rules
passando — nenhuma Rule/Matriz/identidade foi alterada por esta fase.
Parte B1 (domínio, Rules, repository de "Informações da Escala"
dia/pessoa-dia) concluída — ver `docs/spec/INFORMACOES_ESCALA.md`. B2
(Dashboard), B3 (App) e B4 (importação assistida) ficam para fases
seguintes, aguardando aprovação.

Nota PATCH-CONTEXTO-USUARIOS-FILTRO-SETOR-1: corrigiu dois problemas de
navegação/apresentação — nenhuma Rule/seed/reset/publicação tocada. (1)
trocar o contexto (SOC ⇄ Plantão COSI) sempre forçava "Escalas", mesmo em
Usuários/Visão geral/Trocas/Administração — agora só navega
automaticamente quando a tela atual já dependia do editor/rascunho do
contexto (`escalas`/`grade`/`importar`); qualquer outra tela é preservada.
(2) o pool amplo do contexto Plantão mistura plantonistas com técnicos que
só consultam o Grupo (ex.: Plantão COSI consulta o SOC) — corrigido com um
filtro de setor/equipe na tela Usuários (`lib/usuariosTelaFiltros.ts`,
gerado a partir do próprio Grupo, nunca hardcoded), na ordem pool → setor →
busca textual (agora cobrindo nome/login/e-mail/aliases/cargo). Confirmado
que um usuário pode aparecer em SOC e em Plantão sem duplicar. Ver
`docs/spec/EDITOR_ESCALAS.md` § 17.

Nota PATCH-DASHBOARD-OPERACOES-SIMPLES-1: consolidou "quais operações o
Dashboard mostra, com qual status" em `resolverOperacoesDashboard()`
(`lib/operacoesDashboard.ts`) — sem alterar quem administra o quê
(`resolverEscoposOperacionais`/a Matriz continuam intocados). Três operações
canônicas, nunca uma genérica "Plantão": SOC, NOC, Plantão COSI. Causa raiz
do card duplicado: a Visão geral renderizava o card/linha de Plantão
incondicionalmente em 4 seções, caindo num rótulo genérico sempre que o
usuário não tinha nenhum Grupo de Plantão no escopo (ex.: supervisora do
NOC) — corrigido com um gate único, `possuiOperacaoPlantaoDashboard`. Causa
raiz do status inconsistente: 3 fórmulas de status independentes que podiam
divergir para a mesma operação/competência — corrigidas com uma única
derivação de 4 estados (`StatusOperacaoDashboard`). Admin vê SOC+NOC+Plantão
COSI; Claudio (`GESTOR_UNIDADE` de `GEDSI_COSI`) vê SOC+Plantão COSI, nunca
NOC; a supervisora do NOC vê só NOC. Ver `docs/spec/EDITOR_ESCALAS.md` § 18.

Nota FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1: corrigiu duas
inconsistências pós-publicação do Plantão no Dashboard e implementou a
primeira visão de Plantão no App. (1) o badge de "Publicação da escala" já
tinha 4 estados (§ 18.3), mas o texto abaixo dele ainda usava um booleano de
2 estados para Plantão — nunca dizia "Publicada"; unificado em
`resumoPublicacaoOperacao(estado)`, usado por Jornada e Plantão. (2) "Abrir
editor"/o card da Visão geral chamavam `setTela('importar')` direto, sem
popular a working copy — uma competência só publicada (sem rascunho) caía
na tela de importação vazia; corrigido com
`listarAtribuicoesPlantaoPublicada()` (novo) e
`abrirRascunhoNoEditorAcao()` branchando por `status`, sempre reidratando
pela mesma função, nunca um segundo formato de working copy. O painel
"Histórico de publicações" (conceito só de Jornada) ficou restrito a
Jornada; Plantão ganhou "Revisão publicada", mostrando só o que o modelo
atual grava de fato. (3) o App ganhou a aba "Plantão" (quem está de plantão
agora/próximo, "Meus próximos plantões", ícone `Radio` já mapeado desde
antes), lendo sempre a competência publicada (nunca rascunho, nunca
`localStorage`). (4) `ParticipantePlantao.contatos` (já existente) ganhou
autoatualização pelo próprio plantonista — `atualizarContatosPlantonista()`
com o mesmo gate de `criarSolicitacaoTroca()` (nunca o gate
administrativo), e um novo ramo em Rules restrito a
`affectedKeys().hasOnly(['contatos', 'atualizadoEm'])` do próprio login. (5)
troca de plantão ficou como entrada visual desabilitada — o modelo de troca
de Jornada 6x1 (`lib/trocasEscala.ts`) não serve para turnos de duração
variável; fica documentado como próxima fase. Ver `docs/spec/PLANTOES.md`
§ 33 e `docs/spec/EDITOR_ESCALAS.md` § 19.
