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

## Specs herdadas ainda válidas por domínio

- `STAGING_RESET_HIERARQUIA_ICI.md` — fases STAGING-RESET-HIERARQUIA-ICI-1/2: reset controlado de staging, IDs canônicos de unidade/equipe, `souCoordenadorOperacionalStaging()`, cadastro livre de unidade/equipe e descrição textual de nível hierárquico.
- `HIERARQUIA_ORGANIZACIONAL.md` — domínio organizacional, permissões e regra de não hardcode.
- `ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md` — estrutura organizacional de referência do produto, com níveis, unidades, siglas e regras sanitizadas para cadastro/contexto.
- `ESCOPO_OPERACIONAL_MATRIZ.md` — fonte normativa atual para quem administra ou apenas consulta cada Jornada/Plantão.
- `ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` — escopo administrativo de `GESTOR_UNIDADE` sobre Unidades/Equipes/Grupos de Plantão (`lib/escoposOperacionais.ts`). A autorização operacional por unidade desta spec agora é **Regra transitória / fallback de compatibilidade** quando não existir matriz explícita para o alvo.
- `ADMINISTRACAO_E_HIERARQUIA.md` — fluxos administrativos atuais e matriz de permissões.
- `AUTENTICACAO_FIREBASE_MICROSOFT_EMAIL.md` — login Microsoft/e-mail e identidade por `usuarios/{login}`.
- `LEMBRETES.md` — módulo de Lembretes, separado de Escalas.
- `TROCA_ESCALA_PLANO.md` — módulo de Trocas no estado atual.

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
- `PLANTOES.md` e `EDITOR_ESCALAS.md` — contêm histórico e detalhes de domínio anteriores; para UI nova de Plantão/Jornada, preferir as specs novas acima.

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
