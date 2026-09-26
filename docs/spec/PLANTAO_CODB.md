# Especificação — Plantão CODB (multi-função) e separação hierarquia × responsabilidade

Fase FASE-PLANTAO-CODB-CANONICO-1. Normativa para o Plantão CODB e para o
padrão geral de "GrupoPlantao multi-função" (`FuncaoPlantao`) — as demais
operações (SOC, Plantão COSI, NOC) continuam regidas por
`docs/spec/PLANTOES.md`/`docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md` sem
alteração.

## 1. Objetivo

Plantão CODB é **uma única operação operacional do CODB**, importada de
**uma** planilha (`Relatorio-PlantaoCODB.xls`), que cobre quatro postos
paralelos — DBA, Linux, Telecom, Windows — no mesmo `GrupoPlantao`, com
**um** coordenador responsável, **uma** competência por mês, **uma**
publicação/revisão por competência. Esta spec existe porque a tentação
óbvia (quatro Equipes, quatro Grupos, quatro Matrizes, quatro publicações)
está deliberadamente errada — corrigido antes de qualquer dado real ser
criado.

## 2. Estrutura organizacional

```
Coordenador CODB
└── GEDSI_CODB
    └── Supervisora NOC
        └── GEDSI_CODB_NOC
```

`GEDSI_CODB` é a unidade; `GEDSI_CODB_NOC` é a equipe/Jornada do NOC,
hierarquicamente abaixo do Coordenador CODB. Isso é **estrutura visual**,
nunca autorização (seção 4).

## 3. Responsabilidades

| Papel | Vínculo organizacional | Responsabilidade operacional |
|---|---|---|
| Coordenador CODB (Elton) | `GEDSI_CODB` (`unidadeId`) | `PLANTAO:<grupoId Plantão CODB>` |
| Supervisora NOC (Wanessa) | `GEDSI_CODB_NOC` (`equipeId`/`equipesPermitidas`) | `JORNADA:GEDSI_CODB_NOC` |

Nenhuma responsabilidade é inferida da outra. O Coordenador CODB nunca
recebe `JORNADA:GEDSI_CODB_NOC`; a Supervisora nunca recebe
`PLANTAO:<grupoId Plantão CODB>` — cada uma exige atribuição explícita em
`escoposOperacionais` (`docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md`).

## 4. Separação hierarquia × responsabilidade

**Hierarquia organizacional não concede escala.** O Coordenador CODB estar
acima do NOC na árvore não significa que ele administra, visualiza ou
consulta a Jornada do NOC — essa regra geral já existe
(`docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md` §1), mas o CODB/NOC foi o caso
real que expôs uma violação dela: `usuarios/elrauh.equipeId` chegou a
apontar para `GEDSI_CODB_NOC` (uma equipe descendente), o que — combinado
com `responsaveisEquipe` da Matriz de NOC — concedia administração da
Jornada do NOC por acidente. Corrigido em
`lib/perfilAcessoUsuario.ts` (`usuarioGestorUnidadeComEquipeIdInvalido()`,
aplicada por `salvarUsuario()`) — ver commit `425b86f`. `GESTOR_UNIDADE`
nunca tem `equipeId`; seu vínculo é sempre `unidadeId`/`unidadesPermitidas`.

## 5. Anchor técnico — `GEDSI_CODB_PLANTAO`

`GrupoPlantao.equipeResponsavelId` é um campo obrigatório e imutável no
modelo atual — participa de invariantes de Rules (`equipeResponsavelId in
equipesConsulta`), do fallback legado de autorização
(`podeOperarNaEquipe(grupoDoc.equipeResponsavelId)`), e do provisionamento
oficial. Torná-lo opcional exigiria reabrir esses invariantes para TODO
`GrupoPlantao` existente (incluindo o Plantão COSI já em produção-staging)
— risco de regressão maior do que esta correção pede.

`GEDSI_CODB_PLANTAO` é o anchor técnico aprovado, no mesmo padrão já usado
por `GEDSI_COSI_PLANTAO` (o anchor do Plantão COSI, que também não é uma
equipe de analistas real — plantonistas de COSI são `ParticipantePlantao`
individuais, nunca membros de `GEDSI_COSI_PLANTAO`). `GEDSI_CODB_PLANTAO`:

- **não** é uma equipe humana — ninguém tem `equipeId`/`equipesPermitidas`
  apontando para ela;
- **não** é o vínculo organizacional do Coordenador CODB (que continua
  `unidadeId: GEDSI_CODB`);
- **não** concede Jornada de nenhum tipo;
- **não** aparece na árvore organizacional comum como equipe de trabalho;
- existe exclusivamente para satisfazer `GrupoPlantao.equipeResponsavelId`.

## 6. `GrupoPlantao` canônico

```
nome: "Plantão CODB"
equipeResponsavelId: GEDSI_CODB_PLANTAO
unidadeResponsavelId: GEDSI_CODB
equipesConsulta: [GEDSI_CODB_PLANTAO]   // sempre inclui o próprio anchor
funcoesEsperadas: ['DBA', 'LINUX', 'TELECOM', 'WINDOWS']
ativo: true
```

`grupoId` é derivado do helper oficial (`identificadorGrupoPlantaoDaEquipe()`,
`lib/inicioEscala.ts` — normaliza a `sigla`/`id` do anchor), nunca
concatenado à mão num script isolado. Provisionamento usa
`construirGrupoPlantaoOficial()` (`lib/gruposPlantaoProvisionamento.ts`) —
nunca um `setDoc` manual no Console do Firestore
(`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` §9.2).

**Não são** quatro Equipes, quatro `GrupoPlantao`, quatro
`escoposOperacionais`, ou quatro publicações — DBA/Linux/Telecom/Windows
são postos dentro deste único Grupo (seção 7).

## 7. Funções (`FuncaoPlantao`)

`FuncaoPlantao = 'DBA' | 'LINUX' | 'TELECOM' | 'WINDOWS'`
(`packages/contrato/src/modeloPlantaoPersistente.ts`) — nome genérico
deliberado (nunca `EspecialidadePlantaoCODB`): o conceito é do domínio
Plantão, reaproveitável por qualquer Grupo multi-função futuro, sem
hardcode de CODB em `packages/contrato`/`firestore.rules`.
`FUNCOES_PLANTAO_VALIDAS` e `ROTULO_FUNCAO_PLANTAO` (rótulos de exibição
— UI nunca mostra o código técnico) completam o enum.
`GrupoPlantao.funcoesEsperadas?: FuncaoPlantao[]` é opcional e
retrocompatível: ausente/vazio (Plantão COSI, SOC) = Grupo de posto único,
`funcao` nunca é exigido em nenhuma atribuição dele.

## 8. Atribuições

`funcao` pertence à **atribuição** (`AtribuicaoPlantaoPersistida.funcao?:
FuncaoPlantao`), nunca ao `ParticipantePlantao`. Uma pessoa pode ocupar
funções diferentes em períodos diferentes — nada infere "Fulano é sempre
DBA". `papel` (`PRIMARIO`/`SECUNDARIO`) é ortogonal: distingue
titular/backup dentro do MESMO posto/turno; `funcao` distingue qual posto
paralelo é aquele.

## 9. Planilha oficial

`Relatorio-PlantaoCODB.xls` — uma tabela com colunas `Plantonista DBA`,
`Plantonista Linux`, `Plantonista Telecom`, `Plantonista Windows`, `Data
Início`, `Data Fim`. Uma linha = uma ocorrência (mesmo intervalo
início/fim) com até 4 postos preenchidos independentemente — célula vazia
numa coluna de posto não gera atribuição fictícia para aquele posto
naquela linha (nunca inventa pessoa).

## 10. Parser

Pipeline (`packages/contrato`):

```
XLS
 → parsePlanilhaPlantaoMultiFonte()          (detecta N colunas "Plantonista <fonte>")
 → converterAtribuicoesMultiFonteParaBrutas() (fonte → FuncaoPlantao via funcaoPlantaoDaFonte())
 → [conciliação de usuários — lib/conciliacaoPlantoes.ts, inalterado]
 → montarAtribuicoesPlantaoRascunho()         (funcao passa intacto para AtribuicaoPlantaoPersistida)
```

FASE-IMPORTADOR-UNIVERSAL-1 (`docs/spec/IMPORTADOR_UNIVERSAL_ESCALAS.md`)
— o entrypoint real do Dashboard (`lib/importadorPlanilha.ts`) agora
decide multi-fonte × fonte única através de
`analisarArquivoEscalaPlantao()` ANTES de qualquer outra detecção. Isso
corrigiu um bug real: o detector de fonte única aceitava sozinho a última
coluna "Plantonista Windows" (contígua às colunas de data) como se fosse
a planilha inteira, produzindo só 1 dos 4 postos no Dashboard ("4
plantonistas" em vez de 17). Ver a spec do importador para o pipeline
completo e os limites documentados desta fase.

`funcaoPlantaoDaFonte(fonte)` normaliza (trim + uppercase + remove
acentos) o texto verbatim do cabeçalho ("Linux"/"Telecom"/"Windows", só
"DBA" já nasce maiúsculo) — uma coluna cujo cabeçalho não bate com nenhum
posto conhecido nunca vira `funcao` inventada: a linha daquela fonte é
reportada em `erros` (com o texto real da coluna) e excluída do resultado.
Sem pipeline paralelo específico de CODB — o mesmo
`converterAtribuicoesMultiFonteParaBrutas()` serve qualquer futuro Grupo
multi-função.

## 11. Conciliação

Inalterada (`lib/conciliacaoPlantoes.ts`): nome→login por identidade
normalizada (`normalizarNome()`), nunca por posição/índice na lista —
confirmado que `aplicarVinculosNasAtribuicoes()` casa por
`Map<nomeNormalizado, vinculo>`, então adicionar `funcao` a cada linha
bruta não interfere na conciliação (ela ignora campos que não conhece e
preserva os que já tinha via spread). Pessoa não conciliada nunca ganha
login inventado — `montarAtribuicoesPlantaoRascunho()` lança erro exigindo
que a prévia seja validada primeiro.

## 12. Postos incompletos

`postosIncompletos(grupo, atribuicoesDaOcorrencia, ocorrencia)`
(`packages/contrato/src/modeloPlantaoPersistente.ts`) — para uma
ocorrência (mesmo `inicio`/`fim` exatos), retorna os postos de
`funcoesEsperadas` sem nenhuma atribuição cobrindo-a. Nunca inventa
pessoa; `[]` para Grupo de posto único (`funcoesEsperadas`
ausente/vazio). UI consome isto para "Plantão incompleto: Telecom sem
plantonista." (seção 16).

## 13. Publicação

Uma competência (`Plantão CODB` + `AAAA-MM`) tem UMA
`competenciaPlantao`/revisão — a revisão inclui as atribuições das quatro
funções juntas. Nunca quatro publicações independentes por posto; o
modelo de competência/publicação de `docs/spec/PLANTOES.md` §20 não muda.

## 14. Rollback

Restaura o estado conjunto da revisão anterior — DBA/Linux/Telecom/Windows
juntos, nunca rollback por função isolada (mesmo mecanismo existente de
`docs/spec/PLANTOES.md`, sem alteração de schema).

## 15. Hub

Para o Coordenador CODB, o Hub mostra **um** card: "Plantão CODB", com um
subtítulo `DBA · Linux · Telecom · Windows` (postos, não sub-cards). Nunca
quatro cards. Fonte de dados inalterada:
`resolverOperacoesDashboard()`/`resolverEscoposOperacionais()` — o card é
"administrável" porque existe `escoposOperacionais/PLANTAO_<grupoId>`
listando o Coordenador, exatamente como qualquer outra operação.

## 16. Editor

Depois de aberto ("Plantão CODB · Setembro de 2026"), um filtro secundário
`[Todos] [DBA] [Linux] [Telecom] [Windows]` — filtro de apresentação do
MESMO Grupo, nunca uma rota/aba principal nova. Contabilidade (total de
plantões, horas, alertas) continua agregada; função fica disponível para
filtrar/exibir, nunca obrigatória para o cálculo.

Implementado em `FASE-PLANTAO-MULTIPOSTO-WORKSPACE-1` e
`FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1`
(`docs/spec/PLANTAO_MULTIPOSTO.md`, spec genérica — não específica de
CODB): tabs geradas de `grupo.funcoesEsperadas`, cards de saúde por
posto, calendário/roster/contabilidade já recebem a lista filtrada,
"Nova escala" oferece posto único ou múltiplos postos ao criar um Grupo,
criar/editar uma atribuição exige o posto correto (nunca aceito
silenciosamente ausente), a aba Vínculos prioriza a função selecionada, a
importação valida a função encontrada contra `grupo.funcoesEsperadas`
específico (não só o enum global), e "Revisar publicação" resume a
saúde por posto com o gate de publicação baseado em
`ResultadoSaudePlantao.podePublicar`. Ver a spec genérica para o modelo
completo e as dívidas técnicas ainda pendentes.

## 17. Responsabilidade operacional

`escoposOperacionais/PLANTAO_<grupoId>` com `responsaveisLogin: [login do
Coordenador CODB]` — **uma** responsabilidade cobre o Grupo inteiro. Nunca
`PLANTAO:DBA`/`PLANTAO:LINUX`/etc. — não existe ACL por função; a
autorização (`podeAdministrarEscalaPlantao(grupoId)`) opera no nível do
Grupo, idêntica para qualquer posto.

## 18. Jornada NOC — fora do escopo do Coordenador CODB

Nenhuma mudança em `GEDSI_CODB_NOC`/`escoposOperacionais/JORNADA_GEDSI_CODB_NOC`.
Responsável continua a Supervisora NOC. O Coordenador CODB nunca aparece
em `responsaveisLogin`/`responsaveisEquipe` dessa Matriz, nunca administra,
nunca importa, nunca publica essa Jornada, e (salvo consulta explícita
futura) nunca a vê no Hub/Visão Geral/seletor de contexto.

## 19. Grupo legado `gruposPlantao/NOC`

Diagnosticado (read-only, staging): `grupoId: 'NOC'`, criado por `elrauh`
em 2026-08-25, **zero** participantes, competências, atribuições ou
publicações — um shell abandonado, não o "Plantão CODB legado" e não a
Jornada do NOC. Plano: **`DEACTIVATE_LATER`** — não reutilizar, não
deletar, não desativar ainda. Só marcar `ativo: false` depois que o
Plantão CODB canônico estiver criado, atribuído, importável, visível no
Hub, publicável, e um diagnóstico final confirmar zero referências
operacionais (script auditável, nunca delete físico).

## 19b. Precedência da Matriz em staging

`escoposOperacionais/PLANTAO_NOC` (`alvoId: 'NOC'`, `ativo: false`,
`responsaveisLogin: []`, `responsaveisEquipe: []`) é um **tombstone
temporário de migração**, não a arquitetura final — existe só para fechar
os dois fallbacks de staging sobre o Grupo legado `gruposPlantao/NOC`
(seção 19) enquanto ele não é desativado de vez. Remover quando o shell
`NOC` finalmente virar `ativo: false`.

Staging tem dois mecanismos de fallback (fallback legado,
`permitirFallbackLegado`/`souGestor()`+`souGestorUnidade()`; fallback
amplo, `permitirAmploStaging`/`souCoordenadorOperacionalStaging()`) que
ajudam um coordenador/supervisor legítimo administrar um alvo antes de uma
Matriz de Responsáveis (`escoposOperacionais`) existir para ele. A Matriz
de um alvo (`tipo` + `alvoId`) se classifica em quatro estados
(`estadoMatrizOperacional()` em `lib/escoposOperacionaisMatriz.ts`,
espelhado em `firestore.rules` por `matrizOperacionalEhBootstrapTecnico()`/
`fallbackStagingPermitidoParaAlvo()`):

- **AUSENTE** (nenhum documento) → fallback de staging pode ajudar
  (finalidade original).
- **BOOTSTRAP** (`ativo: true`, `responsaveisLogin` contém *só* o login
  técnico do seed inicial — `admin`, `scripts/staging/hierarquia-ici.mjs`,
  `MATRIZ_INICIAL` — e `responsaveisEquipe` vazio) → fallback de staging
  ainda pode ajudar. Todo alvo recém-semeado nasce neste estado; sem essa
  exceção, um reset de staging trancaria todo coordenador legítimo até um
  humano cadastrar manualmente o responsável real
  (Administração → Responsáveis por escala).
- **CONFIGURADA** (`ativo: true` com pelo menos um responsável real — um
  login diferente do técnico, ou `responsaveisEquipe` não vazio) → a
  Matriz decide sozinha; fallback de staging NUNCA complementa, mesmo que
  o ator não esteja entre os responsáveis listados.
- **INATIVA** (`ativo: false`) → fail-closed absoluto: nenhum fallback
  (legado ou amplo) reabre o alvo. É exatamente o papel de
  `escoposOperacionais/PLANTAO_NOC`.

Regra de precedência: **Matriz explícita (CONFIGURADA ou INATIVA) sempre
vence o fallback de staging.** Só a ausência de Matriz ou uma Matriz ainda
em estado de bootstrap deixam o fallback ajudar — nunca o inverso.
(`HOTFIX-STAGING-FALLBACK-MATRIZ-1` fechou o caso INATIVA;
`HOTFIX-STAGING-MATRIZ-BOOTSTRAP-1` corrigiu a correção anterior, que
tinha ficado absoluta demais e também travava o bootstrap.)

## 20. Segurança

Autorização sempre no nível do Grupo
(`podeAdministrarEscalaPlantao(grupoId)`), nunca por função/posto — não
existe, e não deve existir, uma Rule tipo `podeAdministrarPosto(grupoId,
funcao)`. Hierarquia nunca substitui responsabilidade explícita (seção 4).
`firestore.rules` já valida `funcao`/`funcoesEsperadas` como campos
opcionais retrocompatíveis (`funcaoPlantaoValida()`,
`funcoesEsperadasDoRequestValidas()` — commit `fadaed8`).

## 21. Testes obrigatórios

Parser (`packages/contrato/test/converterAtribuicoesMultiFonteParaBrutas.test.ts`),
domínio (`packages/contrato/test/modeloPlantaoPersistente.test.ts`,
`lib/montagemRascunhoPlantao.test.ts`), Rules
(`tests/firebase/firestore.rules.test.ts`, describe "Plantão
multi-função"), Hub/Visão Geral e App ficam pendentes até o Grupo
canônico existir em staging (ver `docs/spec/README.md` para o status
corrente da fase).

## 22. Dívidas técnicas reais

- Nenhum `detectarTipoPlanilha()` comum decide automaticamente entre
  `parsePlanilhaPlantao()` (fonte única) e `parsePlanilhaPlantaoMultiFonte()`
  — hoje são duas funções de entrada separadas; o Dashboard precisa saber
  de antemão que o Grupo alvo é multi-função (`funcoesEsperadas` não
  vazio) para escolher a segunda. Decisão de UX de importação (progressive
  disclosure para o Coordenador CODB) ainda não implementada no Dashboard.
- `AtribuicaoPlantaoEditavel` (`lib/editorPlantao.ts`, working-copy do
  Editor) ainda não tem campo `funcao` — necessário antes do Editor poder
  exibir/filtrar por posto.
- Hub, Visão Geral, Editor e importação real no Dashboard ainda não
  consomem `funcoesEsperadas`/`funcao` — implementados só na camada de
  domínio/parser/Rules até este checkpoint.
- Participação (`ParticipantePlantao`) vs. `equipesConsulta` — suspeita
  histórica de que um participante legítimo pode deixar de enxergar sua
  própria escala publicada se sua equipe não estiver em
  `equipesConsulta`; auditoria e teste de regressão contra o cenário COSI
  ainda pendentes (não confundir com o saneamento de Plantão
  COSI/`PLANTAO_GEDSI_COSI` vs. `PLANTAO`, tratado à parte).
