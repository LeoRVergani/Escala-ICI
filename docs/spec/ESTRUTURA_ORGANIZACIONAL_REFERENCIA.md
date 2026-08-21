# Estrutura Organizacional de Referencia

**Status:** normativa  
**Escopo:** dominio organizacional, cadastro, navegacao, filtros e relacao com a Matriz de Responsaveis por Escala  
**Schema sugerido:** `schemaVersion: 1`

Esta spec define a estrutura organizacional de referencia do projeto. Ela
serve para contexto, navegacao, filtros, agrupamento visual, cadastro de
unidades, cadastro de equipes e exibicao de caminhos organizacionais.

A referencia e evolutiva. Uma unidade sem sigla confirmada pode aparecer pelo
nome, mas o produto nao deve inventar uma sigla nem deduzir a subordinacao.
Inclusoes e mudancas futuras entram como dados administrativos, sem exigir
condicionais por area no codigo.

A estrutura organizacional nao concede automaticamente permissao para criar,
importar, editar, salvar ou publicar escalas. Quem administra cada Jornada ou
Plantao e definido pela Matriz de Responsaveis por Escala.

## 1. Separacao normativa de escopos

| Escopo | Finalidade | Nao concede sozinho |
|---|---|---|
| Estrutura organizacional | Presidencia, diretorias, assessorias, gerencias, coordenacoes, supervisoes, liderancas, equipes e caminhos. | Administracao operacional de Jornada ou Plantao. |
| Nivel hierarquico | Classificacao deliberativa, estrategica, tatica ou operacional para leitura do produto. | Permissao por nivel, cargo ou subordinacao. |
| Escopo administrativo | Cadastro e manutencao de unidades, equipes, usuarios e grupos. | Administracao automatica das escalas associadas. |
| Escopo operacional de escala | Responsaveis por administrar uma Jornada ou Plantao. | Consulta ampla ou posse dos colaboradores. |
| Escopo de consulta | Visualizacao e monitoramento. | Edicao, importacao, salvamento, publicacao ou administracao. |

Regras permanentes:

- Organograma nao e autorizacao automatica de escala.
- Cargo nao e autorizacao automatica de escala.
- Subordinacao nao concede automaticamente administracao de escala.
- A arvore organizacional e fonte de contexto e cadastro.
- A Matriz de Responsaveis por Escala e a fonte operacional para definir responsaveis.
- Uma coordenacao pode existir formalmente acima de uma equipe, mas a responsabilidade da escala pode ser de outra pessoa configurada explicitamente.
- Uma supervisao pode administrar uma escala mesmo sem ser a coordenacao formal da unidade inteira.
- Uma equipe pode consultar um Plantao sem administrar esse Plantao.
- A matriz operacional deve permitir excecoes reais sem hardcode.
- Nomes de pessoas, nomes de setores e siglas nao podem ser usados como regra de autorizacao.
- Siglas podem ser usadas como IDs tecnicos e labels de cadastro, mas nao como permissao por si so.

## 2. Niveis organizacionais de referencia

| Nivel | Abrange |
|---|---|
| Deliberativo | Conselho de Administracao e Presidencia. |
| Estrategico | Diretorias e assessorias estrategicas. |
| Tatico | Gerencias, coordenacoes, supervisoes e liderancas de projetos. |
| Operacional | Equipes, grupos de trabalho e colaboradores vinculados a escala. |

## 3. Estrutura de referencia

### Presidencia / PRE

Nivel: Deliberativo ou Estrategico conforme o uso do produto. Pode conter
diretorias, assessorias e unidades subordinadas.

Assessorias:

- Assessoria da Presidencia
- Assessoria de Relacoes Institucionais e Mercado / ASRIM
- Assessoria de Relacionamento com Clientes e Gestao de Contrato
- Assessoria de Desenvolvimento de Novos Mercados

### Diretoria de Sistemas e Inovacao / DSI

Nivel: Estrategico  
Subordinacao: Presidencia

Unidades subordinadas conhecidas:

| Unidade | Sigla | Nivel | Subordinacao | Coordenacoes |
|---|---|---|---|---|
| Gerencia de PMO | GEPMO | Tatico | DSI | COIN; Coordenacao de Transformacao Digital |
| Coordenacao de Fabrica de Software Interna | CFSI | Tatico | GEPMO ou estrutura equivalente conforme cadastro | - |
| Gerencia de Sistemas | GESIS | Tatico | DSI | COPM; Coordenacao de Portais; CSRH; CSDE; COSA; Coordenacao de Sistemas de Educacao |
| Gerencia de Sistemas GRP | GEGRP | Tatico | DSI | CISS; CSGT; CSGP |
| Gerencia de Saude | GESAU | Tatico | DSI | CODS; COPS |
| Gerencia de Novas Tecnologias | GENOV | Tatico | DSI | COPF; COGL |

### Diretoria de Infraestrutura e Operacoes / DIO

Nivel: Estrategico  
Subordinacao: Presidencia

Unidades subordinadas conhecidas:

| Unidade | Sigla | Nivel | Subordinacao | Coordenacoes |
|---|---|---|---|---|
| Gerencia de Data Center e Seguranca da Informacao | GEDSI | Tatico | DIO | CODB; COCR; COSI |
| Gerencia de Infraestrutura e Suporte Tecnico | GESUP | Tatico | DIO | CSTE; COAT; COSD |
| Gerencia de Operacoes | GEOPE | Tatico | DIO | COAC; COPC |

### Diretoria Administrativa e Financeira / DAF

Nivel: Estrategico  
Subordinacao: Presidencia

Unidades subordinadas conhecidas:

| Unidade | Sigla | Nivel | Subordinacao | Coordenacoes |
|---|---|---|---|---|
| Gerencia Administrativa | GEADM | Tatico | DAF | Coordenacao de Apoio Administrativo; Coordenacao de Compras e Aquisicoes; Coordenacao de Contratos |
| Gerencia Financeira | GEFIN | Tatico | DAF | Coordenacao Financeira |
| Gerencia de Gestao de Pessoas | GEGEP | Tatico | DAF | Coordenacao de Departamento Pessoal; Coordenacao de Desenvolvimento Humano e Organizacional |

### Diretoria Juridica e Compliance / DJC

Nivel: Estrategico  
Subordinacao: Presidencia

Unidade subordinada conhecida:

- Coordenacao Juridica e Compliance / COJC

### Coordenacoes ou unidades complementares visiveis

- Coordenacao de Comunicacao / CCOM
- Coordenacao de Marketing
- Coordenacao Juridica e Compliance / COJC
- Coordenacao de Gestao de Legados / COGL
- Coordenacao de Produtos de Financas / COPF
- Coordenacao de Transformacao Digital
- Coordenacao de Inovacao / COIN
- Coordenacao de Fabrica de Software Interna / CFSI
- Coordenacao de Seguranca da Informacao / COSI
- Coordenacao de Data Center e Banco de Dados / CODB
- Coordenacao de Conectividade e Redes / COCR
- Coordenacao de Suporte em TI Externo / CSTE
- Coordenacao de Service Desk / COSD
- Coordenacao de Assistencia Tecnica / COAT
- Coordenacao de Atendimento ao Cidadao / COAC
- Coordenacao de Operacoes Continuadas / COPC

## 4. Siglas de referencia para cadastro

| Sigla | Nome | Tipo sugerido |
|---|---|---|
| PRE | Presidencia | PRESIDENCIA |
| DSI | Diretoria de Sistemas e Inovacao | DIRETORIA |
| DIO | Diretoria de Infraestrutura e Operacoes | DIRETORIA |
| DAF | Diretoria Administrativa e Financeira | DIRETORIA |
| DJC | Diretoria Juridica e Compliance | DIRETORIA |
| ASRIM | Assessoria de Relacoes Institucionais e Mercado | ASSESSORIA |
| GEPMO | Gerencia de PMO | GERENCIA |
| GESIS | Gerencia de Sistemas | GERENCIA |
| GEGRP | Gerencia de Sistemas GRP | GERENCIA |
| GESAU | Gerencia de Saude | GERENCIA |
| GENOV | Gerencia de Novas Tecnologias | GERENCIA |
| GEDSI | Gerencia de Data Center e Seguranca da Informacao | GERENCIA |
| GESUP | Gerencia de Infraestrutura e Suporte Tecnico | GERENCIA |
| GEOPE | Gerencia de Operacoes | GERENCIA |
| GEADM | Gerencia Administrativa | GERENCIA |
| GEFIN | Gerencia Financeira | GERENCIA |
| GEGEP | Gerencia de Gestao de Pessoas | GERENCIA |
| CCOM | Coordenacao de Comunicacao | COORDENACAO |
| COIN | Coordenacao de Inovacao | COORDENACAO |
| CFSI | Coordenacao de Fabrica de Software Interna | COORDENACAO |
| COPM | Coordenacao de Portais e Mobilidade | COORDENACAO |
| CSRH | Coordenacao de Sistemas de Recursos Humanos | COORDENACAO |
| CSDE | Coordenacao de Sistemas Departamentais | COORDENACAO |
| COSA | Coordenacao de Sistemas de Atendimento | COORDENACAO |
| CISS | Coordenacao de Sistemas para ISS Eletronico | COORDENACAO |
| CSGT | Coordenacao de Sistemas para Gestao Tributaria | COORDENACAO |
| CSGP | Coordenacao de Sistemas para Gestao Publica | COORDENACAO |
| CODS | Coordenacao de Desenvolvimento de Sistemas para Gestao de Saude | COORDENACAO |
| COPS | Coordenacao de Processos em Saude | COORDENACAO |
| COPF | Coordenacao de Produtos de Financas | COORDENACAO |
| COGL | Coordenacao de Gestao de Legados | COORDENACAO |
| CODB | Coordenacao de Data Center e Banco de Dados | COORDENACAO |
| COCR | Coordenacao de Conectividade e Redes | COORDENACAO |
| COSI | Coordenacao de Seguranca da Informacao | COORDENACAO |
| CSTE | Coordenacao de Suporte em TI Externo | COORDENACAO |
| COAT | Coordenacao de Assistencia Tecnica | COORDENACAO |
| COSD | Coordenacao de Service Desk | COORDENACAO |
| COAC | Coordenacao de Atendimento ao Cidadao | COORDENACAO |
| COPC | Coordenacao de Operacoes Continuadas | COORDENACAO |
| COJC | Coordenacao Juridica e Compliance | COORDENACAO |

Convencoes de cadastro:

- siglas usam letras maiusculas, sem espacos ou acentos;
- a sigla oficial e o identificador de referencia da unidade, mas nunca uma
  credencial ou regra de autorizacao;
- o `parentId` e o `caminho` devem refletir a arvore cadastrada e confirmada;
- nomes sem sigla definida, como Coordenacao de Marketing e Coordenacao de
  Transformacao Digital, permanecem sem codigo ate confirmacao administrativa;
- nao reutilizar a mesma sigla para unidades diferentes.

## 5. Modelo recomendado e compatibilidade

Cada unidade organizacional deve poder ter:

- `id` tecnico
- `sigla`
- `nome`
- `tipo`
- `nivelHierarquico`
- `parentId`
- `caminho`
- `ativa`
- `ordem`
- `observacao`
- `schemaVersion`

Tipos sugeridos:

- `PRESIDENCIA`
- `DIRETORIA`
- `ASSESSORIA`
- `GERENCIA`
- `COORDENACAO`
- `SUPERVISAO`
- `EQUIPE`
- `GRUPO_OPERACIONAL`

Niveis sugeridos:

- `DELIBERATIVO`
- `ESTRATEGICO`
- `TATICO`
- `OPERACIONAL`

Essa lista representa a taxonomia organizacional completa do produto. Na
persistencia atual, entretanto, `Equipe` e `GrupoPlantao` continuam entidades
proprias, vinculadas a uma unidade; nao devem ser duplicadas como documentos
de `unidadesOrganizacionais`. Assim:

- `PRESIDENCIA`, `DIRETORIA`, `ASSESSORIA`, `GERENCIA`, `COORDENACAO` e
  `SUPERVISAO` classificam unidades da arvore;
- `EQUIPE` classifica o no operacional mantido em `equipes`;
- `GRUPO_OPERACIONAL` classifica conceitualmente o agrupamento mantido em
  `gruposPlantao` quando o destino for Plantao;
- `AREA`, `SETOR` e `DEPARTAMENTO` permanecem valores legados aceitos pelo
  modelo atual e nao substituem siglas oficiais conhecidas.

O modelo implementado ainda nao possui todos os campos-alvo acima: o enum
atual de unidade nao inclui `ASSESSORIA`, e `nivelHierarquico`, `ordem`,
`observacao` e `schemaVersion` ainda nao fazem parte do registro persistido.
Essa diferenca deve ser tratada por uma evolucao de schema propria, com Rules,
migracao compativel e testes. Ate la, esta secao e referencia normativa para a
evolucao e nao autoriza gravar campos que as Rules atuais nao aceitam.

Exemplos conceituais:

```yaml
id: GEDSI
sigla: GEDSI
nome: Gerencia de Data Center e Seguranca da Informacao
tipo: GERENCIA
nivelHierarquico: TATICO
parentId: DIO
caminho: [PRE, DIO, GEDSI]
ativa: true
schemaVersion: 1
```

```yaml
id: COSI
sigla: COSI
nome: Coordenacao de Seguranca da Informacao
tipo: COORDENACAO
nivelHierarquico: TATICO
parentId: GEDSI
caminho: [PRE, DIO, GEDSI, COSI]
ativa: true
schemaVersion: 1
```

```yaml
id: CODB
sigla: CODB
nome: Coordenacao de Data Center e Banco de Dados
tipo: COORDENACAO
nivelHierarquico: TATICO
parentId: GEDSI
caminho: [PRE, DIO, GEDSI, CODB]
ativa: true
schemaVersion: 1
```

```yaml
id: GESUP
sigla: GESUP
nome: Gerencia de Infraestrutura e Suporte Tecnico
tipo: GERENCIA
nivelHierarquico: TATICO
parentId: DIO
caminho: [PRE, DIO, GESUP]
ativa: true
schemaVersion: 1
```

```yaml
id: COSD
sigla: COSD
nome: Coordenacao de Service Desk
tipo: COORDENACAO
nivelHierarquico: TATICO
parentId: GESUP
caminho: [PRE, DIO, GESUP, COSD]
ativa: true
schemaVersion: 1
```

Estes exemplos sao ilustrativos e podem existir em fixtures, seeds, docs ou
testes. A logica do produto nao pode depender desses nomes.

## 6. Equipes

Equipe e unidade operacional de escala. Ela pode estar vinculada a uma
coordenacao, gerencia ou outra unidade, mas nao e automaticamente uma escala.

Regras:

- Uma equipe pode ser alvo de Jornada.
- Uma equipe pode ser equipe responsavel de um Grupo de Plantao.
- Uma equipe pode apenas consultar um Plantao.
- Uma equipe nao administra uma Jornada ou Plantao apenas por nome, sigla ou unidade.
- O mesmo nome de area nao deve decidir permissao.

Exemplos conceituais:

- `EQ_SOC`: equipe operacional associada a uma coordenacao, usada como Jornada 6x1.
- `EQ_PLANTAO_COSI`: equipe operacional associada a uma coordenacao, usada como responsavel por Grupo de Plantao.
- `EQ_NOC`: equipe operacional associada a uma estrutura de infraestrutura/operacoes, usada como Jornada 6x1.
- `EQ_N1_ICI`: equipe operacional de suporte N1 local.
- `EQ_N1_NOVA_LIMA`: equipe operacional de suporte N1 por localidade.

Esses exemplos sao ilustrativos e devem ficar em fixtures, seeds, docs ou
testes. A logica do produto nao pode depender desses nomes.

### 6.1 ID tecnico e codigo organizacional

`Equipe.id`/`equipeId` e uma chave tecnica imutavel. Ela pode existir em
usuarios, escalas, publicacoes, trocas, grupos de Plantao e Matriz de
Responsaveis; portanto nao deve ser renomeada apenas para refletir o
organograma.

A interface apresenta separadamente um codigo organizacional calculado pela
posicao atual da equipe. Na estrutura de referencia:

- `EQ_SOC` aparece como `GEDSI_COSI_SOC`;
- `EQ_NOC` aparece como `GEDSI_CODB_NOC`;
- `EQ_PLANTAO_COSI` aparece como `GEDSI_COSI_PLANTAO`.

O codigo comeca na Gerencia, inclui areas/coordenacoes e termina na sigla da
equipe. Presidencia e Diretoria sao omitidas por serem contexto amplo;
Supervisao e omitida por representar funcao de chefia. Um segmento da sigla da
equipe que ja aparece no caminho nao e repetido. O calculo usa os dados da
arvore e nao pode conceder autorizacao.

O formato de referencia para o codigo de equipe e:

```text
<GERENCIA>_<COORDENACAO>_<FUNCAO_OU_LOCALIDADE>
```

Exemplos validos de apresentacao:

- `GEDSI_CODB_APROVACAO`
- `GEDSI_CODB_DBA`
- `GEDSI_CODB_SUPORTE`
- `GEDSI_CODB_NOC`
- `GEDSI_COSI_N3_SEGURANCA`
- `GESUP_COSD_N1`
- `GESUP_COAT_SUP_ICI`

Para equipes novas, `Equipe.sigla` deve preferir esse codigo completo quando
a vinculacao organizacional estiver confirmada. `Equipe.id` continua sendo a
chave tecnica imutavel: pode adotar o mesmo codigo na criacao, mas nunca deve
ser renomeado automaticamente depois de referenciado. Equipes legadas com
siglas curtas recebem o codigo completo apenas na apresentacao.

Se uma equipe mudar de unidade, o codigo visual acompanha a nova arvore sem
alterar o ID tecnico nem reescrever historico. Uma migracao real de IDs exigiria
plano transacional proprio e nao faz parte da edicao administrativa comum.

### 6.2 Bootstrap da base definitiva de producao

A regra de imutabilidade protege o staging e qualquer ambiente que ja possua
referencias. Ela nao obriga uma base nova a repetir IDs provisorios. Antes do
primeiro go-live, a producao deve ser criada com IDs canonicos alinhados a esta
estrutura; no recorte atual, `EQ_PLANTAO_COSI` e transformado em
`GEDSI_COSI_PLANTAO` durante a importacao controlada para a base vazia.

Isso nao autoriza renomear staging nem trocar apenas o documento de Equipe. O
grafo inteiro de referencias, Rules, indices e testes deve acompanhar o corte,
conforme `MIGRACAO_IDS_ORGANIZACIONAIS_PRODUCAO.md`.

## 7. Relacao com a Matriz de Responsaveis por Escala

A Matriz de Responsaveis por Escala e a fonte de permissao operacional.

Jornada:

- `alvo = equipeId`
- `responsaveis = usuarios gestores/supervisores habilitados`
- `consulta = normalmente vazio`

Plantao:

- `alvo = grupoPlantaoId`
- `responsaveis = usuarios gestores/supervisores habilitados`
- `equipesConsulta = equipes que podem visualizar/monitorar sem editar`

Exemplos operacionais sanitizados:

- Uma coordenacao de seguranca pode ter uma Jornada de equipe e um Plantao proprio.
- Uma equipe de operacoes pode estar dentro de uma coordenacao, mas ser administrada por uma supervisao especifica.
- Uma equipe de suporte N1 pode ter responsaveis diferentes conforme localidade.
- Um Plantao pode ser administrado por uma coordenacao e consultado por outra equipe.
- O organograma nao resolve essas excecoes; a matriz resolve.

## 8. Dashboard e administracao

- **Administracao -> Organizacao** mantem a arvore de unidades.
- **Administracao -> Equipes** mostra equipe, unidade, caminho e destino operacional.
- **Administracao -> Grupos de Plantao** mostra grupos ativos e inativos.
- **Administracao -> Responsaveis por escala** configura quem administra cada Jornada ou Plantao.
- A coluna Unidade/Area e contexto, nao permissao.
- A interface deve evitar sugerir que coordenador ou gerente ganha automaticamente todas as escalas abaixo.
- O usuario deve conseguir mudar responsavel de escala pela tela, sem console, seed ou alteracao de codigo.

## 9. Permissoes

- `ADMIN_SISTEMA` pode administrar toda a matriz.
- Usuarios com perfil de gestao/supervisao podem ser responsaveis por escala.
- Analista ou tecnico comum nao deve aparecer como responsavel operacional.
- Analista ou tecnico entra como colaborador da grade, nao como administrador da escala.
- Consulta nao concede edicao.
- Equipe que consulta nao pode salvar, publicar ou importar escala.
- Responsavel operacional pode administrar apenas os alvos configurados.
- Responsavel por uma Jornada nao administra automaticamente todos os Plantoes da unidade.
- Responsavel por um Plantao nao administra automaticamente a Jornada da equipe, salvo se tambem estiver configurado.

Perfis elegiveis para responsavel operacional:

- `ADMIN_SISTEMA`
- `GESTOR_UNIDADE`
- `GESTOR_EQUIPE`
- `SUPERVISOR_EQUIPE`

Perfis nao elegiveis:

- `ANALISTA`
- `ANALISTA_SOC`
- `TECNICO`
- `TECNICO_N1`
- usuario comum
- usuario inativo
- usuario sem perfil de gestao

## 10. Colaboradores

- Colaborador pertence a equipe/grade.
- Colaborador nao pertence ao coordenador.
- Promover alguem para responsavel deve exigir perfil elegivel.
- Mudar responsavel da escala nao altera `equipeId` dos colaboradores.
- Mudar responsavel da escala nao altera membros da grade.
- A grade deve carregar colaboradores da equipe alvo da escala, nao do responsavel logado.

## 11. Grupos inativos

- `GrupoPlantao ativo:false` nao aparece no seletor operacional.
- `GrupoPlantao ativo:false` nao aparece no Wizard Nova escala.
- `GrupoPlantao ativo:false` nao aparece no Wizard Importar escala.
- `GrupoPlantao ativo:false` pode aparecer apenas em **Administracao -> Grupos de Plantao**, com badge **Inativo**.
- Grupo inativo nao deve contaminar destino operacional da equipe.

## 12. Regras para specs e implementacao

- Esta spec e referencia de dominio, nao seed obrigatorio.
- Nao transformar a estrutura de referencia em regra fixa de permissao.
- Nao usar sigla, nome de area, cargo textual ou subordinacao como hardcode de autorizacao.
- Resolver excecoes operacionais pela Matriz de Responsaveis por Escala.
