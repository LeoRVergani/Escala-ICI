# Spec Mestre — Projeto Escala ICI

**Produto:** Escala ICI  
**Status:** implementação local acumulada  
**Data:** agosto de 2026  
**Autor:** Manus AI  
**Escopo:** gestão de escalas SOC/Jornada 6x1 e Plantão para coordenação operacional

## 1. Propósito do documento

Este documento é o índice normativo da evolução do Projeto Escala ICI. Ele deve ser lido por qualquer pessoa ou IA antes de alterar uma tela já aprovada. As specs específicas continuam sendo a fonte detalhada de cada domínio; este documento registra como elas se conectam e quais decisões não podem ser revertidas casualmente.

> **Princípio geral:** melhorar uma tela não autoriza alterar regras de negócio, schema Firebase, Rules, persistência, parser ou um padrão visual previamente aprovado. Mudanças devem ser locais, documentadas, validadas em runtime e incluídas no ZIP completo atualizado.

## 2. Arquitetura funcional atual

O produto possui um Dashboard do coordenador com os seguintes contextos e áreas:

| Área | Responsabilidade |
|---|---|
| Visão geral | Resumo operacional unificado de SOC e Plantão, com navegação acionável. |
| Escalas | Lista de rascunhos/publicações, wizard de Nova/Importar e histórico local. |
| Grade | Editor da Jornada 6x1 com competência completa, coluna sticky e assistente de ciclo. |
| Importação SOC | Revisão visual com resumo, roster, matriz mensal e pendências preservadas. |
| Plantão | Calendário mensal, roster, atribuições e padrões de horário. |
| Trocas | Revisão, aprovação/recusa e histórico de solicitações. |
| Administração | Unidades, equipes, grupos de Plantão, participantes e governança. |

O contexto superior é a fonte de verdade da operação aberta. Ele alterna entre Jornada SOC e Grupo Plantão e possui controle de competência. Toda troca passa pelo guard de alterações não salvas.

## 3. Visão geral operacional SOC + Plantão

A Visão geral mostra SOC e Plantão diretamente ao coordenador. A ordem aprovada é: cabeçalho com `Nova escala` e `Importar escala`; dois cards principais de SOC/Plantão; faixa com Colaboradores, Dias, Saúde das escalas e Pendências; cards de Publicação, Alertas por operação e Trocas pendentes.

Os cards principais são botões completos. O card SOC abre a Grade Jornada 6x1; o card Plantão abre o editor/revisão ou a tela de Escalas sem escala, conforme a competência disponível. O card Trocas abre a tela de Trocas e seleciona a primeira pendência quando houver.

A Visão geral lista as operações concedidas pela matriz mesmo sem escala
criada. A leitura dos dados usa o alvo operacional resolvido: Jornada por
`equipeId` real da equipe, Plantão por `grupoId` real do grupo. Rótulos como
SOC ou Plantão COSI são apenas apresentação. Colaboradores da Jornada vêm da
equipe/grade da escala; participantes de Plantão vêm do grupo. A equipe do
responsável logado não é fallback de dados quando uma operação da matriz está
selecionada.

Estados da Visão geral: **Sem escala** quando não há rascunho nem publicação;
**Rascunho** quando há rascunho não publicado; **Publicada** quando há
publicação vigente sem rascunho pendente. A ausência de publicação não deve
mascarar um rascunho existente como ausência total de escala.

A saúde é uma métrica de apresentação derivada de alertas e pendências. Não deve ser persistida. Quando não há escala carregada, o estado é neutro e não exibe percentual arbitrário. O card Plantão informa sem escala quando não há competência criada; não cria rascunho automaticamente.

**Spec detalhada:** `docs/spec/VISAO_GERAL_OPERACIONAL_SOC_PLANTAO.md`.  
**Checkpoint:** `CHECKPOINT-VISAO-GERAL-OPERACIONAL-2026-08.md`.

## 4. Wizard Preparar escala

O modal de Nova/Importar não usa hiperlinks nem a sequência visual artificial `1 Tipo / 2 Destino / 3 Revisar`. A ordem normativa é escolher intenção, tipo, destino, competência, arquivo quando importar e, por fim, editor/revisão. O resumo mostra o nome real da equipe Jornada ou do grupo Plantão. Assim, o mesmo código atende SOC, NOC, Plantão COSI, CODB, Infra, Redes e grupos futuros sem nomes hardcoded.

**Spec detalhada:** `docs/spec/WIZARD_PREPARAR_ESCALA.md`.  
**Checkpoint:** `CHECKPOINT-WIZARD-PREPARAR-ESCALA-2026-08.md`.

## 5. Wizard unificado de Nova/Importar

Nova escala e Importar escala usam o mesmo `ScheduleStartWizard`, com modo explicitamente separado. O wizard resolve tipo, área, equipe/grupo e competência conforme dados e permissões. A Visão geral reutiliza `abrirNovaEscala` e `abrirImportarEscala`; não criar fluxos paralelos.

Ao clicar em Plantão na Visão geral, a competência é atualizada no topo e a navegação respeita a existência de um rascunho. Ao clicar em SOC, o contexto passa para a equipe Jornada correspondente.

## 5. Jornada 6x1

A grade usa `periodoInicio`/`periodoFim` como fonte de verdade, não apenas as chaves de células preenchidas. Isso impede que uma linha vazia faça a competência colapsar. A tabela usa `table-layout: fixed`, coluna sticky de nome e largura fixa para datas.

O assistente inicial é acionado ao abrir a primeira célula vazia. Ao escolher um turno de trabalho, replica o código nos próximos cinco dias livres, totalizando seis dias. Células preenchidas são preservadas e cada dia permanece editável individualmente.

A validação registrada usa Lia Vilar: seis `MD` foram criados; depois apenas o segundo dia foi alterado para `N`, preservando os outros cinco.

**Spec:** `docs/spec/JORNADA_6X1_ASSISTENTE_CICLO.md`.  
**Helper/testes:** `lib/cicloJornada6x1.ts` e `lib/cicloJornada6x1.test.ts`.

## 6. Revisão/importação SOC

A revisão SOC usa resumo executivo, roster lateral, matriz mensal central e pendências da fonte. O card lateral permanente **Detalhes do dia** foi removido para ampliar o calendário. A matriz mantém todas as 31 datas, seleção de coluna, rolagem horizontal e edição.

**Spec:** `docs/spec/REVISAO_JORNADA_6X1_LAYOUT_CALENDARIO.md`.  
**Checkpoint:** `CHECKPOINT-FASE-REVIEW-JORNADA-6X1-VISUAL.md`.

## 7. Plantão

Plantão possui grupo, participantes, competência, atribuições, vínculos e calendário mensal. O calendário é uma grade mensal única com navegação de mês anterior/próximo, chips por plantonista e legenda lateral/semântica conforme a tela.

O Modal D de atribuição apresenta duas colunas: padrões à esquerda e detalhes à direita. Os padrões Noturno, 5h e 24h usam cores semânticas; a exceção manual permanece disponível. Padrões são deduplicados e ordenados.

Cores semânticas preservadas: madrugada `#7c5ce0`, manhã `#13b99a`, tarde `#e99b38`, noite `#2e8be6` e 24h `#d98218`.

**Spec:** `docs/spec/PLANTAO_MODAL_D.md`.  
**Helpers/testes:** `components/plantao/horariosPlantao.ts` e `components/plantao/horariosPlantao.test.ts`.

## 8. Navegação e retorno

O retorno às escalas usa o botão compacto **Escalas**, com seta, borda discreta, foco acessível e sem hiperlink sublinhado. O padrão deve ser reutilizado nas telas internas e não substituído por links textuais antigos.

**Spec:** `docs/spec/NAVEGACAO_RETORNO_ESCALAS.md`.

## 9. Contexto SOC/Plantão

O seletor superior possui grupos de Jornadas e Plantões. SOC e Plantão são contextos independentes; o grupo de Plantão não deve ser tratado como uma segunda Jornada. A competência selecionada acompanha o contexto. A troca não deve perder working copy sem confirmação.

O carregamento do seletor segue o estado da Matriz de Responsáveis:
`carregando`, `sucesso`, `vazio` ou `erro`. Lista vazia e falha sempre encerram
o loading; timeout/rede oferecem **Recarregar operações**. `permission-denied`
ao ler a matriz diagnostica Rules de staging não publicadas, nunca **Sem
escala**. Vazio orienta o usuário a pedir vínculo em **Administração →
Responsáveis por escala**, com atalho direto para `ADMIN_SISTEMA`.

O contexto ativo tem `{ tipo, alvoId, label, competencia }`. O ID é a chave de
domínio e o rótulo é somente apresentação. Toda abertura, criação, leitura,
salvamento e publicação preserva esse contexto: Jornada usa `equipeId` e
Plantão usa `grupoId`, nunca `usuario.equipeId`, `label` ou
`GrupoPlantao.equipeResponsavelId` quando já existe um alvo selecionado.

Quando persistido como preferência no `localStorage`, o contexto é revalidado
após a matriz carregar. Alvo inexistente/inativo ou Grupo de Plantão inativo é
limpo e exige nova seleção. A tela Escalas nunca cria nem exibe um card de
operação genérico sem alvo válido.

`docs/spec/ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md` define a estrutura
organizacional de referência do produto para cadastro, navegação, filtros,
agrupamento visual e exibição de unidade/caminho. Essa árvore separa
Presidência, diretorias, assessorias, gerências, coordenações, supervisões,
lideranças e equipes, com níveis deliberativo, estratégico, tático e
operacional quando aplicável. A árvore é contexto; não é autorização
operacional.

O padrão de cadastro usa siglas institucionais para unidades e códigos de
equipe no formato **Gerência_Coordenação_FunçãoOuLocalidade**, por exemplo
`GEDSI_CODB_NOC`, `GEDSI_COSI_N3_SEGURANCA` e `GESUP_COSD_N1`. Unidade sem
sigla confirmada permanece sem código inventado. Equipe e Grupo de Plantão
continuam entidades próprias vinculadas à árvore, ainda que apareçam como
níveis operacionais na taxonomia ampla. IDs persistidos não são renomeados e
nenhum segmento desses códigos participa da autorização.

As listas de Jornadas/Plantões administráveis vêm de `lib/escoposOperacionais.ts`, alimentado prioritariamente por `escoposOperacionais` (ver `docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md`). Organograma, cargo, unidade pai e equipe do usuário são contexto/fallback transitório, não autorização operacional automática. Um Plantão administrável nunca aparece simultaneamente como monitorado; `GrupoPlantao ativo:false` fica fora do seletor operacional e do Wizard.

Responsável humano de escala é usuário ativo com perfil elegível de gestão/
supervisão (`ADMIN_SISTEMA`, `GESTOR_UNIDADE`, `GESTOR_EQUIPE` ou
`SUPERVISOR_EQUIPE`). Analista/técnico comum não aparece como responsável de
escala; a exceção real é promoção de perfil, nunca hardcode por nome, cargo,
sigla, unidade ou equipe. Responsáveis, equipes administradoras e equipes que
consultam são conceitos separados: consulta não concede salvar/importar/
publicar, e a equipe responsável de um Plantão não vira equipe administradora
da matriz automaticamente.

Responsável por escala não possui colaboradores. A Jornada usa usuários
ativos da equipe da escala; staging real não pode herdar colaboradores
sintéticos de demo sem modo demo explícito. `GrupoPlantao ativo:false` não
influencia destino operacional de Equipe.

Uma equipe de Plantão sem `GrupoPlantao` vinculado não aparece em Plantões — o Wizard oferece criar o Grupo pelo fluxo oficial (nunca pelo Console do Firestore), ver `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` § 9 (Fase PROVISIONAMENTO-GRUPO-PLANTAO-1).

Os estados são `publicada`, `rascunho` e `sem-escala`, conforme o domínio existente. O read model de Plantão consulta tanto `rascunhosCompetenciasPlantao` quanto `competenciasPlantao`; rascunho pendente tem precedência visual sobre a publicação anterior.

Na Fase ESCOPO-OPERACIONAL-MATRIZ-2, a matriz ativa também autoriza escrita.
`responsaveisLogin`, `responsaveisEquipe` e `ADMIN_SISTEMA` podem salvar e
publicar o alvo compatível. `equipesConsulta` permanece estritamente de
leitura/monitoramento. O fallback legado só existe quando o alvo ainda não
possui documento de matriz e a compatibilidade foi explicitamente habilitada
por `VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO=true`.

Durante a migração de staging, essa compatibilidade fica explicitamente ativa
no build `staging.dashboard`, permitindo que alvos ainda não migrados convivam
com alvos já presentes na matriz. Uma matriz existente, inclusive inativa,
sempre prevalece; o fallback não amplia autorização de escrita.

**STAGING-RESET-HIERARQUIA-ICI-1** adiciona uma segunda flag, separada e mais
ampla, também exclusiva do build `staging.dashboard`:
`VITE_ESCALA_STAGING_PERMISSAO_AMPLA=true`. Diferente do fallback acima (que só
preenche alvos SEM matriz), esta libera `ADMIN_SISTEMA`/`GESTOR_UNIDADE`/
`GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` mesmo quando a matriz JÁ existe para o alvo
mas não lista o usuário — a autorização real de escrita espelha
`souCoordenadorOperacionalStaging()` em `firestore.rules`, condicionada ao
documento `config/ambiente` (`{ staging: true }`), que só existe em staging
(nunca em produção). Ver `docs/spec/STAGING_RESET_HIERARQUIA_ICI.md`.

O read model operacional preserva resultados parciais: publicação carregada
com sucesso continua visível mesmo que rascunho, histórico ou estado de
publicação sejam recusados. `permission-denied` nas fontes determinantes da
escala diagnostica Rules de staging que ainda não reconhecem a matriz; falha
de rede usa mensagem recuperável distinta. A UI oferece **Recarregar
operações**, encerra loading em todos os caminhos e nunca converte uma recusa
de Rules em **Sem escala**.

Importar arquivo é preparação local, não escrita: o Wizard deve mostrar erros
de arquivo/parser no próprio modal, sempre encerrar o processamento e permitir
abrir a revisão de Plantão mesmo quando uma checagem auxiliar é recusada por
Rules antigas. Salvar/publicar permanecem protegidos e podem exigir a
publicação das Rules de staging.

Uma Jornada nova organiza cada colaborador pelo `turnoPadrao` do cadastro,
normalizando código, descrição ou alias do catálogo. Valor ausente/inválido
vai para **Outros**, nunca para Manhã por fallback. Cadastros criados durante
conciliação herdam o período detectado na planilha. Dias e folgas permanecem
editáveis e não são inventados quando o cadastro não informa o DSR individual.

## 10. Trocas

A tela Trocas contém filtros Pendentes, Aprovadas, Recusadas e Histórico. O dashboard mostra `trocasPendentesGestor.length`, prévias de até duas solicitações e ação `Gerenciar trocas`. O clique leva à tela de Trocas e, quando possível, seleciona a solicitação correspondente.

Nenhuma troca deve ser aprovada ou recusada diretamente no dashboard sem passar pela tela e pelos handlers existentes.

## 11. Dados e domínio

As métricas da Visão geral usam estados já carregados pelo DashboardApp:

| Domínio | Estado utilizado |
|---|---|
| Jornada | Resumo por alvo `equipeId` com `rascunhosTurnosMes`, `turnosMes`, `publicacoesEscala`/histórico quando aplicável, usuários ativos da equipe, `resultado` apenas quando o editor aberto é o mesmo alvo. |
| Plantão | Resumo por alvo `grupoId` com `rascunhosCompetenciasPlantao`, `competenciasPlantao`, participantes do grupo, `resultadoPlantao`/`atribuicoesEditaveisPlantao` apenas quando o editor aberto é o mesmo grupo. |
| Vínculos | `pendenciasVinculoPlantao`. |
| Trocas | `trocas`, `trocasPendentesGestor`. |
| Contexto | `contextoEscalaAtivo`, `solicitarTrocaContexto`, `solicitarTrocaCompetencia`. |

Não criar persistência adicional para contadores, barras de saúde, status derivados ou métricas de apresentação.

## 12. Acessibilidade e responsividade

Controles acionáveis usam `button`, rótulos explícitos, ícones como reforço e foco visível. A cor não é o único sinal de estado. Cards empilham em telas menores e nenhum conteúdo essencial pode depender de hover.

A largura da Visão geral foi validada sem overflow horizontal na viewport de runtime. O layout deve manter cards inteiros e evitar texto cortado.

## 13. Pesquisa de design

A concepção da Visão geral foi orientada por referências de dashboards operacionais que recomendam hierarquia de KPIs, espaço em branco, paleta limitada, cor com significado, agrupamento lógico, comparação direta e ações contextuais.

**Relatório:** `docs/validation/dashboard-overview-research-2026-08.md`.

## 14. Não regressão

Antes de modificar qualquer tela, ler esta spec e a spec específica. Não remover:

- a coluna sticky e as 31 datas da Jornada;
- o assistente de ciclo 6x1;
- o calendário mensal de Plantão;
- o Modal D e seus padrões semânticos;
- o seletor superior SOC/Plantão;
- o botão compacto Escalas;
- o roster e o calendário central da revisão SOC;
- os guards de alterações não salvas;
- as pendências/alertas preservados da importação;
- a entrega recorrente em ZIP completo atualizado.

## 15. Validação obrigatória

Toda entrega deve executar:

```bash
cd /home/ubuntu/Escala-ICI
npm run check
```

Além disso, ações de navegação devem ser testadas em runtime: Nova escala abre o wizard, Importar escala abre o wizard, SOC muda o contexto para Jornada, Plantão muda o contexto para Plantão e Trocas abre a tela de solicitações.

A entrega deve conter ZIP completo sem `node_modules`, `dist`, `.git` ou caches, patch aplicável, screenshot real do runtime e as specs/checkpoints relevantes.

## 16. Referências internas

- `docs/spec/STAGING_RESET_HIERARQUIA_ICI.md`
- `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`
- `docs/spec/VISAO_GERAL_OPERACIONAL_SOC_PLANTAO.md`
- `docs/spec/JORNADA_6X1_ASSISTENTE_CICLO.md`
- `docs/spec/PLANTAO_MODAL_D.md`
- `docs/spec/NAVEGACAO_RETORNO_ESCALAS.md`
- `docs/spec/REVISAO_JORNADA_6X1_LAYOUT_CALENDARIO.md`
- `CHECKPOINT-FASE-REVIEW-JORNADA-6X1-VISUAL.md`
- `CHECKPOINT-VISAO-GERAL-OPERACIONAL-2026-08.md`
- `docs/validation/dashboard-overview-research-2026-08.md`

## 17. Revisão de importação de Plantão

A tela de importação deve colocar o calendário mensal no topo e reduzir o
seletor de arquivo a uma ação compacta após detectar Plantão. Diagnósticos da
planilha e divergências ficam ao final. A navegação da revisão contém somente
Calendário, Contabilidade e Vínculos; não recriar abas vazias de Resumo nem uma
Lista paralela ao calendário.

A faixa operacional acima do calendário reúne o arquivo atual, o botão
**Importar outra planilha**, Grupo, competência, período e as ações
**Validar prévia**, **Salvar rascunho** e **Publicar Plantão**. Essas ações não
podem voltar para um card no fim da página. Publicar permanece desabilitado até
o rascunho atual ser salvo; mover o botão não altera Rules nem persistência.

Cartões importados apresentam iniciais e horário lado a lado, com intervalo
compacto quando possível, sem perder o rótulo acessível completo. Usuário
ausente pode ser criado pelo modal da própria aba Vínculos e só é vinculado
após persistência bem-sucedida. O cadastro usa a equipe responsável pelo Grupo
de Plantão, nunca a equipe/UID do operador autenticado. As Firestore Rules
validam esse vínculo pelo Grupo e pela Matriz, sem abrir acesso geral a outras
equipes.

## 18. Cadastro e delegação de coordenadores

O responsável operacional de uma Jornada ou Plantão pode cadastrar
colaboradores, coordenadores e supervisores na equipe do próprio alvo. A
delegação aceita somente `GESTOR_EQUIPE` ou `SUPERVISOR_EQUIPE` com escopo
`EQUIPE`; `ADMIN_SISTEMA`, `GESTOR_UNIDADE`, escopo global e equipes externas
continuam bloqueados. Para Plantão, as Rules validam o Grupo ativo e sua
`equipeResponsavelId`.

O cadastro registra o alvo operacional que autorizou a criação. Esse metadado
é auditoria, não uma nova ACL: o acesso do novo coordenador às escalas continua
dependendo da Matriz de Responsáveis. Cargo e nível hierárquico, sozinhos, não
concedem permissão.

## 19. Identificação organizacional de equipes

O produto distingue o ID técnico imutável (`Equipe.id`/`equipeId`) do código
organizacional apresentado ao usuário. O código é derivado da árvore atual e
segue o formato **Gerência_Area_Equipe**, por exemplo
`GEDSI_COSI_SOC`, `GEDSI_CODB_NOC` e `GEDSI_COSI_PLANTAO`.

Administração → Equipes, o detalhe da árvore e a Matriz de Responsáveis exibem
esse código. Seletores continuam enviando o ID técnico como valor; Rules,
repositórios e documentos de escala nunca autorizam nem consultam por código
visual. Mover uma equipe recalcula sua apresentação sem renomear documentos ou
romper usuários, publicações, trocas e histórico.

### 19.1 IDs canônicos no primeiro go-live de produção

A imutabilidade acima protege ambientes já referenciados; ela não obriga uma
base nova de produção a herdar IDs provisórios de staging. No
primeiro corte para a base vazia de produção, os dados devem ser transformados
para os IDs organizacionais confirmados, inclusive
`EQ_PLANTAO_COSI` → `GEDSI_COSI_PLANTAO` — ver
`docs/spec/MIGRACAO_IDS_ORGANIZACIONAIS_PRODUCAO.md`.

**STAGING-RESET-HIERARQUIA-ICI-1** antecipa esse corte para o STAGING,
sob controle (backup recuperável, dry-run, aprovação humana e validação
pós-seed — mesma disciplina do corte de produção, aplicada mais cedo):
`EQ_SOC`/`EQ_PLANTAO_COSI`/`EQ_NOC` deixam de ser criados/atualizados, e o
staging reiniciado nasce diretamente com `GEDSI_COSI_SOC`/
`GEDSI_COSI_PLANTAO`/`GEDSI_CODB_NOC` (grupo de Plantão canônico:
`PLANTAO_GEDSI_COSI`). Ver `docs/spec/STAGING_RESET_HIERARQUIA_ICI.md`
(spec central desta fase) e `scripts/staging/hierarquia-ici.mjs` (fonte
única de dados do organograma canônico).

O mesmo padrão vale um nível acima, para as UNIDADES/coordenações
(`unidadesOrganizacionais`, distintas de `equipes`): `COSI`/`CODB`/`COCR`
(e as coordenações de GESUP/GEOPE) nunca são `unidadeId` persistido — são só
a sigla de exibição. O `unidadeId` técnico sempre leva o prefixo da
gerência-mãe, mesma lógica de `GEDSI_COSI_SOC`: `GEDSI_COSI`, `GEDSI_CODB`,
`GEDSI_COCR`, `GESUP_CSTE`, `GESUP_COAT`, `GESUP_COSD`, `GEOPE_COAC`,
`GEOPE_COPC`. Correção feita em **STAGING-RESET-HIERARQUIA-ICI-2** — a
primeira versão do seed havia persistido a sigla solta como `unidadeId`.

Essa transformação não é edição comum nem fallback de runtime: deve migrar o
grafo completo de referências, validar Rules e índices genéricos, passar por
dry-run/backup/smoke test e exigir aprovação humana antes de liberar escrita.
O procedimento normativo está em
`docs/spec/MIGRACAO_IDS_ORGANIZACIONAIS_PRODUCAO.md`.

**STAGING-RESET-HIERARQUIA-ICI-3** reforça um princípio separado: IDs
organizacionais (unidades/equipes) são estrutura e podem ser seed; pessoas
(quem ocupa cada cargo) nunca são — mesmo em staging, ficam fora do código
versionado, cadastradas via Dashboard/Admin SDK. Ver
`docs/spec/STAGING_RESET_HIERARQUIA_ICI.md` § 6.

**JORNADA-IMPORTACAO-VINCULOS-UX-1** aplica o mesmo princípio à importação de
Jornada/6x1: um colaborador que aparece na planilha sem usuário
correspondente é uma pendência acionável (associar/criar/alias/ignorar),
nunca um cadastro implícito ou um nome hardcoded — ver
`docs/spec/EDITOR_ESCALAS.md` § 14.
