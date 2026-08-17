# Checkpoint — Fase ESCALAS-UX-2B.2 (homologação funcional/visual + quick-add + vínculo inline + correção de equipe no cadastro)

Data: 2026-08-17. Microfase de CORREÇÃO baseada em homologação real no
navegador após ESCALAS-UX-2B/ESCALAS-UX-2B.1 — corrige exatamente cinco
problemas concretos, sem avançar para o redesign completo de
Contabilidade/Lista/Pendências (ESCALAS-UX-2C).

## Baseline (precheck)

```
pwd                            /home/vergani/projetos/Escala-ICI
git rev-parse --show-toplevel  /home/vergani/projetos/Escala-ICI
git branch --show-current      main
git status --short             ?? apps/dashboard/.sites-runtime/
                                ?? packages/contrato/.sites-runtime/
git fetch origin                 ok
git rev-parse HEAD              2cf03e4c5cec9bb72a2f524a4b1e7ab3ca7ca25a
git rev-parse origin/main       2cf03e4c5cec9bb72a2f524a4b1e7ab3ca7ca25a
git diff --check                 limpo
```

HEAD == origin/main no precheck. Baseline de testes confirmado:
`test:unit` 941/941, `test:boundaries` 268/268, `test:firestore-rules`
166/166. Nenhum arquivo inesperado além dos dois `.sites-runtime/`
conhecidos.

## 1. Método

Leitura obrigatória das fontes de verdade + checkpoints das 4 fases
imediatamente anteriores (`CHECKPOINT-FASE-ESCALAS-UX-2A1-CONTEXTO-ATIVO.md`,
`CHECKPOINT-FASE-ESCALAS-UX-2A1-FIX-DIRTY.md`,
`CHECKPOINT-FASE-PLANTAO-PADRAO-1.md`,
`CHECKPOINT-FASE-ESCALAS-UX-2B-ROSTER-DRAG.md`,
`CHECKPOINT-FASE-ESCALAS-UX-2B1-LIMITES-COMPETENCIA.md`), seguida de um
mapeamento factual exaustivo (via agente de exploração, read-only) de
`PlantaoRoster.tsx`/`PlantaoCalendario.tsx`/`QuickAddPlantaoPopover.tsx`,
a aba Vínculos, o formulário de cadastro de usuário
(`FormularioUsuario`/`novoUsuario()`/`abrirNovoUsuario()`), a aba
Resumo, e a cascata CSS do header (`.topbar` → `.schedule-context-cluster`
→ cada controle) — antes de qualquer edição.

## 2. Causa real do "modal grande abrindo" (§ 23 do pedido)

Confirmado por leitura estática: **click e drag sempre convergiram para
a MESMA função** (`solicitarNovaAtribuicaoPlantao`) desde a
ESCALAS-UX-2B — não havia nenhuma divergência de código entre os dois
caminhos. A causa real era cenário **A** do pedido ("grupo não tem
padrão configurado para o dia"): quando `obterPadraoHorarioGrupoParaData()`
retornava `null`, a função caía DIRETO e SILENCIOSAMENTE no editor
completo (`abrirCriacaoAtribuicaoPlantao`) — do ponto de vista de quem
testava, isso era indistinguível de "o drag não está funcionando
direito". Não havia bug de integração (cenário B) — havia ausência de
um estado intermediário que explicasse a ausência de padrão.

## 3. Fluxo anterior / final do quick-add

**Anterior**: `solicitarNovaAtribuicaoPlantao()` só abria
`QuickAddPlantaoPopover` quando `padrao !== null`; sem padrão, chamava
`abrirCriacaoAtribuicaoPlantao()` diretamente.

**Final**: a função sempre chama `setQuickAddPlantao({ plantonistaNomeOriginal,
dataIso, padrao })` — `padrao` pode ser `null`. `QuickAddPlantaoPopover`
ganhou um segundo modo visual:

- **Com padrão** (inalterado): "Padrão do grupo" + preview + "Outro
  horário"/"Adicionar".
- **Sem padrão** (novo): "Nenhum padrão configurado — Este Grupo não
  possui horário padrão para este dia da semana." + "Configurar
  padrão"/"Informar horário manualmente".

"Outro horário" (só existe com padrão) passou a pré-preencher início/fim
derivados do padrão via `construirAtribuicaoDoPadraoHorario()` (§ 28 do
pedido) — a MESMA função pura já usada por "Adicionar", nunca um
segundo construtor manual (2 call sites agora, não 1 — ver § 48 abaixo).

"Configurar padrão" (`irConfigurarPadraoQuickAdd()`) fecha o popover,
navega para `tela='plantoes'` (Administração → Grupos de Plantão) e abre
`abrirEdicaoGrupoPlantao(grupo)` — o MESMO formulário administrativo já
existente, nunca uma configuração dentro do calendário, nunca salva nada
automaticamente.

"Informar horário manualmente" (`informarHorarioManualmenteQuickAdd()`)
é o mesmo editor completo de sempre, início/fim vazios — nada a derivar
de um padrão inexistente.

**Zero Firestore no quick-add** (com ou sem padrão) — confirmado por
boundary test dedicado nos dois novos handlers.

## 4. Grupo homologado tinha padrão?

Não aplicável de forma determinística nesta auditoria estática (não há
acesso ao Firestore/estado real da sessão de homologação) — o que a
auditoria confirmou é que a FUNÇÃO (`obterPadraoHorarioGrupoParaData`)
está correta: dado um Grupo com padrão configurado só para domingo
(19:00 → 07:00 +1, os mesmos números do wireframe do pedido), ela
retorna o padrão certo para `26/07/2026` (domingo) e `null` para
`27/07/2026` (segunda) — reproduzido como teste dedicado (§ 51 do
pedido, ver § 25 abaixo). A causa do comportamento observado na
homologação é a AUSÊNCIA de feedback quando o retorno é `null`
(corrigida), não um erro de cálculo da função em si.

## 5. Vínculos — fluxo anterior / final

**Anterior**: participante com `status === 'USUARIO_NAO_ENCONTRADO'`
mostrava um botão "Ir para Usuários" (`onIrParaUsuarios={() =>
setTela('usuarios')}`) — navegação pura, sem nenhum contexto carregado
adiante; o gestor precisava reabrir o formulário de cadastro do zero e
redigitar nome/login.

**Final**: o mesmo participante mostra "Cadastrar e vincular"
(`onCadastrarEVincular`, ligado a `abrirCadastroDeVinculoPlantao(participanteNomeOriginal,
loginSugerido)`) — abre o MESMO modal de cadastro de usuário, sem trocar
`tela` (continua em `'importar'`, dentro da aba Vínculos). `loginSugerido`
vem do termo já digitado na busca (`termo.trim()`) — candidato razoável,
nunca inventado.

## 6. Equipe default final (§ 6/§ 7/§ 9 do pedido)

**Causa real do "EQ_SOC pré-definido"**: NÃO era um literal hardcoded.
O campo "Equipe" do formulário era `<input value={usuarioEfetivo?.equipeId
?? ''} disabled />` — mostrava o `equipeId` do OPERADOR logado (quem
estava fazendo o cadastro), nunca inferido de `grupo.equipeResponsavelId`
nem de `ContextoEscalaAtivo`. Ao salvar, `novoUsuario()`
(`lib/importUsers.ts:43`) persistia exatamente esse valor como fallback
interno (`equipeId: gestor.equipeId`) — correto para o caminho de
importação em lote de Jornada (`cadastrarFaltantes()`, onde o gestor
importou a escala DAQUELA equipe — evidência inequívoca, § 8 do pedido),
mas incorreto para o cadastro manual/a partir de Vínculos, onde não há
nenhuma relação necessária entre a equipe do operador e a equipe do novo
colaborador.

**Correção**: `FormularioUsuario` ganhou `equipeId: string`. Nasce vazio
(`''`) em `abrirNovoUsuario()`/`abrirCadastroDeVinculoPlantao()` — nunca
um default de sigla, nunca herdado de `usuarioEfetivo`/de um Grupo de
Plantão. `abrirEdicaoUsuario(item)` prefila com `item.equipeId` (fonte
segura — usuário real já existente). `salvarFormularioUsuario()` sempre
sobrescreve o resultado de `novoUsuario()` com
`equipeId: formularioUsuario.equipeId` explicitamente.

## 7. Seletor de equipe

`OrganizationTeamPicker` (modo `single`, reaproveitado — mesmo
componente já usado em `ModalGrupoPlantao` para `equipeResponsavelId`),
alimentado por `equipesAdmin`/`unidadesAdmin` já carregados (mesma
árvore organizacional de `arvoreOrganizacionalAdmin`, nenhuma segunda
árvore construída). Trigger mostra "Selecionar equipe" (vazio) ou o
nome real + caminho da unidade (`OrganizationBreadcrumb`) quando já
escolhida, com um botão "Alterar". IDs continuam sendo usados
internamente — nunca exposto ao usuário como texto técnico solto.

## 8. Comportamento para Plantão COSI (§ 9 do pedido)

Cadastrar a partir de um participante de "Plantão de Segurança · COSI"
nunca pré-seleciona nenhuma equipe relacionada a esse Grupo — o seletor
sempre nasce vazio, forçando o gestor a escolher a equipe real do novo
colaborador (que pode ou não ser a mesma equipe responsável pelo
Grupo). Confirmado por boundary test: `abrirNovoUsuario`/
`abrirCadastroDeVinculoPlantao` nunca leem
`grupoRascunhoEscolhido`/`gruposPlantaoAdmin`/`equipeResponsavelId`.

## 9. Confirmação — `equipeResponsavelId` nunca vira `equipeId`

Confirmado por boundary test: nenhuma ocorrência de `equipeId:
grupo.equipeResponsavelId` (ou equivalente) em todo `DashboardApp.tsx`.

## 10. Cargo

Auditado: `abrirNovoUsuario()` já definia `cargo: ''` (vazio) — nunca
`'ANALISTA_SEG'`/`'ANALISTA_SOC'` hardcoded. O comentário já existente
em `lib/importUsers.ts` (linhas 22-29) documenta que esse bug ("era
`'ANALISTA_SOC'` incondicional, inclusive para NOC/Suporte") já tinha
sido corrigido numa fase anterior a esta — `validarEdicaoUsuario()` já
exige cargo não vazio antes de salvar. O valor `"ANALISTA_SEG"`
observado na homologação não veio de nenhum default do sistema (fixture
de demo `lib/demoIdentidades.ts` tem `cargo: 'ANALISTA_SOC'` para um
usuário EXISTENTE, não um default de cadastro novo — provável
confusão entre editar um cadastro existente e criar um novo, ou
digitação manual durante o teste). **Nenhuma mudança necessária.**

## 11. Perfil

Nenhuma mudança. `camposAdministrativos` (perfil/escopo/unidadeId/
unidadesPermitidas/equipesPermitidas) continuam só entrando no payload
quando `souAdmin` — cadastro via Vínculos nunca define perfil
administrativo; `perfilEfetivo()`/`PerfilUsuario`/Rules inalterados.

## 12. Nível hierárquico

Auditado: `nivelHierarquico: 6` é o default já existente, não um valor
arbitrário desta fase — corresponde a "Analista" (não-coordenador,
`nivelHierarquico <= 5` é o corte usado em `AppFrame.tsx` para exibir
"Coordenador"), o extremo de MENOR privilégio, não uma sigla/equipe
específica. Preservado (§ 13 do pedido: "se já existe regra segura,
preservar").

## 13. Turno padrão

Auditado: `turnoPadrao: 'M'` é um literal fixo já existente,
Plantão-agnóstico (nunca derivado de `grupo`/`ContextoEscalaAtivo`) — o
mesmo valor nasce independente de o cadastro ter sido aberto a partir de
Jornada, Usuários ou Vínculos de Plantão. Como o modelo exige o campo
(`Usuario.turnoPadrao: string`, obrigatório) e o valor nunca é inferido
por Plantão, nenhuma mudança foi necessária para satisfazer o pedido.

## 14. Usuário existente (busca por login)

Fluxo inalterado (`buscarUsuariosPlantao`, normalização já existente) —
resultado exato mostra nome+login+badge "inativo" quando aplicável;
múltiplos resultados exigem clique explícito (nunca aplica sozinho).

## 15. Busca de login

Reaproveitada integralmente (`buscarUsuariosPlantao(usuarios, termo)`,
já existente) — nenhuma mudança.

## 16. Vínculo direto

Confirmado: `onConfirmarVinculo(participante.nomeOriginal, candidato)`
aplica o vínculo com um clique quando há match exato/sugestão — sem
mudanças nesta fase.

## 17. Usuário inexistente

`vinculo.status === 'USUARIO_NAO_ENCONTRADO'` → "Cadastrar e vincular"
(§ 5 acima) — nunca mais "Ir para Usuários".

## 18. Cadastro inline

Abre o MESMO `formularioUsuario`/modal já usado em toda a aplicação
(nenhum segundo formulário) — confirmado que `abrirCadastroDeVinculoPlantao`
nunca chama `setTela(...)`.

## 19. Prefill de nome

`nome: participanteNomeOriginal` — o nome exatamente como apareceu na
planilha, nunca alterado.

## 20. Prefill de login

`login: loginSugerido` (o termo já digitado na busca, `.trim()`) — nunca
um login inventado quando a busca estava vazia (nesse caso, prefila
vazio, e o gestor digita).

## 21. Campos obrigatórios

`validarEdicaoUsuario()` já exigia nome/e-mail/login/cargo/nível
hierárquico válido; ganhou `equipeId` não vazio nesta fase. Nenhum
cadastro incompleto pode ser salvo — mesmo ponto único de validação
para cadastro manual, cadastro via Vínculos e edição.

## 22. Retorno após cadastro

Como o modal nunca navegou para outra `tela`, "retornar" é automático —
fechar o modal (`fecharFormularioUsuario()`) simplesmente revela a MESMA
tela de Vínculos por trás, sem nenhum estado perdido (working
copy/aba/dirty intactos).

## 23. Vínculo após cadastro

`salvarFormularioUsuario()`, após persistir com sucesso: se
`origemCadastroVinculoPlantao !== null`, chama
`confirmarVinculoPlantaoAcao(origemCadastroVinculoPlantao, candidato)`
imediatamente — identidade exata (mesmo participante que abriu o
cadastro, mesmo `Usuario` recém-criado), nenhuma pesquisa de login
repetida.

## 24. Aliases da planilha

Nenhuma mudança — `aliasesPlanilha` continua existindo só no formulário
de usuário (Jornada), nunca usado para decidir equipe. O cadastro a
partir de Vínculos de Plantão não usa nem cria alias (a semântica atual
de vínculo de Plantão é por `login` direto — `VinculoPlantao`/
`confirmarVinculoPlantao()` nunca tiveram conceito de alias; nenhum foi
inventado agora).

## 25. Caso real reproduzido (§ 51 do pedido)

`packages/contrato/test/modeloPlantaoPersistente.test.ts`, 3 testes
novos em `describe('obterPadraoHorarioGrupoParaData', ...)`:
Grupo com padrão configurado só para domingo (19:00→07:00 +1, mesmos
números do wireframe do pedido) encontra o padrão para `2026-07-26`
(domingo real) e retorna `null` para `2026-07-27` (segunda) — e um
Grupo totalmente sem `padraoHorarioSemanal` retorna `null` para
qualquer dia. Confirma que a função em si nunca teve bug de integração
— a correção real foi o comportamento do Dashboard quando ela retorna
`null` (§ 3 acima).

## 26. Resumo removido

`AbaPreviaPlantao` deixou de incluir `'resumo'`; o botão de aba e o
bloco `{aba === 'resumo' && (...)}` foram removidos por completo.

## 27. Informações realocadas

O conteúdo exclusivo do antigo "Resumo" (tabela de erros estruturais
Local/Plantonista/Valor/Motivo + lista de avisos + as duas frases de
estado vazio) foi movido, sem alteração de conteúdo, para dentro da aba
"Contabilidade", numa seção recolhível nova (`<details
className="plantao-conferencia-importada">`, "Conferência do arquivo
importado") — logo depois da já existente "Fonte original (contabilidade
declarada na planilha)". Nenhuma informação foi perdida; nenhum dado da
working copy foi misturado com dados da fonte.

## 28. Tabs finais

`Calendário | Lista | Contabilidade | Vínculos (N)` — confirmado por
boundary test que as quatro continuam existindo e que nenhuma outra foi
removida por engano.

## 29. Problema anterior do header

`.topbar` tinha `height: 76px` FIXO; `.schedule-context-cluster` (e cada
controle dentro dele) não tinha `padding-block`/margem vertical própria
— o label+controle+período (Competência) ficava com pouquíssima folga
entre o topo/base do header fixo de 76px, lido como "sem respiro" na
homologação.

## 30. Container corrigido

Seguindo `docs/spec/UI_CASCADE_E_HERANCA.md` ("pai antes do filho"): a
correção foi aplicada no CONTAINER (`.schedule-context-cluster`), nunca
espalhando margem solta pelos filhos individuais. `.topbar` virou
`min-height: 76px` (de `height` fixo) especificamente para caber o novo
`padding-block` do cluster sem cortar conteúdo — aumento pequeno,
proporcional, nunca "exagerado" (nenhuma mudança visual nos ícones/
menu da conta à direita, que continuam centralizados pela mesma
`align-items: center` do `.topbar`).

## 31. Espaçamento aplicado

`.schedule-context-cluster`: `padding-block: 12px` (dentro da faixa
10-14px pedida), `gap` reduzido de 22px para 18px (dentro de 16-20px).
Mobile (`@media max-width: 780px`): `flex-wrap: wrap` no cluster (nunca
tenta espremer os três controles numa linha só) + `gap: 8px 14px`.

## 32. Status

`.escala-status-control .status-badge` ganhou `min-height: 34px` — mesma
altura dos gatilhos de "Escala atual"/"Competência", para o badge não
ficar visualmente mais baixo/desalinhado que os outros dois controles.

## 33. Período

Inalterado nesta fase — já usava `formatarData()` com dia/mês/ano
numéricos (`26/07/2026 → 25/08/2026`); o pedido permitia (não exigia)
trocar para um formato abreviado (`26 jul → 25 ago`) só se já existisse
um formatter reutilizável pronto para isso — nenhum foi encontrado sem
introduzir um formatter novo, então o valor visual foi mantido como
estava, só o respaçamento ao redor foi corrigido.

## 34. Mobile

`.schedule-context-cluster` ganhou `flex-wrap: wrap` dentro do
breakpoint mobile já existente (`@media max-width: 780px`) — os três
controles quebram linha em vez de comprimir horizontalmente; nenhum
scroll horizontal de página é introduzido (confirmado por boundary
test).

## 35. Roster preservado

`components/plantao/PlantaoRoster.tsx` — **zero diff** nesta fase
(confirmado por `git diff --stat`). Nenhuma reescrita.

## 36. Calendário preservado

`components/plantao/PlantaoCalendario.tsx` — **zero diff** nesta fase.
Toda a correção do quick-add foi feita na orquestração
(`DashboardApp.tsx`) e no próprio popover
(`QuickAddPlantaoPopover.tsx`), nunca no calendário/drag em si.

## 37. Importados preservados

Nenhuma mudança em `lib/editorPlantao.ts`/`lib/montagemRascunhoPlantao.ts`/
`lib/conciliacaoPlantoes.ts` — confirmado `git diff --stat` vazio para
`lib/editorPlantao.ts`; os únicos arquivos de domínio Plantão tocados
foram `lib/importUsers.ts` (validação de `equipeId`, nada relacionado a
atribuições) e o boundary test/unit test correspondentes.

## 38. 43h/5h preservados

Nenhuma função nova de normalização foi criada; a construção de novas
atribuições pelo padrão (`construirAtribuicaoDoPadraoHorario`) continua
sendo a mesma de antes, só chamada de um segundo ponto ("Outro
horário"). Nenhuma atribuição existente é recalculada por esta fase.

## 39. Testes novos

- `lib/importUsers.test.ts`: +2 (16→18 no arquivo — "recusa equipeId
  vazio"/"recusa equipeId só com espaços").
- `packages/contrato/test/modeloPlantaoPersistente.test.ts`: +3 (88→91)
  — caso real reproduzido (§ 25 acima).
- `tests/plantao-roster-drag-boundaries.test.mjs`: 3 testes
  pré-existentes (8/9/11) reescritos para a nova decisão do quick-add
  (nunca mais "sem padrão → editor completo direto"), + 1 teste novo
  (8b) — contagem final do arquivo sobe de 20 para 21 (nenhum removido).
- `tests/plantao-homologacao-2b2-boundaries.test.mjs` (novo arquivo, 34
  testes) — cobertura estrutural completa dos § 48-55 do pedido: equipe
  no cadastro (10 obrigatórios), cadastro inline/retorno/vínculo
  automático, quick-add sem padrão + "Configurar padrão"/"Informar
  manualmente", remoção do Resumo + realocação de conteúdo, header
  (padding/min-height/mobile/ordem estrutural), e confirmações de não
  regressão (ContextoEscalaAtivo/dirty guards/schema/publicação/limites
  de competência).

## 40. Totais

- `test:unit`: 946/946 (baseline 941 + 2 + 3).
- `test:boundaries`: 303/303 (baseline 268 + 1 novo em
  plantao-roster-drag + 34 novos no arquivo novo; nenhum teste anterior
  removido, 3 adaptados à mudança de comportamento autorizada nesta
  fase).
- `test:firestore-rules`: 166/166 (inalterado — nenhuma mudança de
  Rules/schema).

## 41. Typechecks/lint/builds

`typecheck` (raiz), `typecheck:apps` (dashboard + app-web),
`typecheck:worker`, `lint` (0 erros — só os 6 warnings pré-existentes já
conhecidos, inalterados), `build:dashboard`, `build:app:pages`,
`build:apps`, `validate:pwa`, `validate:artifact`, `git diff --check` —
todos OK. `packages/contrato` isolado confirma os mesmos 3 erros
pré-existentes inalterados (`jornada.ts:260`,
`detectorPlanilha.test.ts`, `parserPlantao.test.ts`).

## 42. Validação visual

Nenhum navegador disponível neste ambiente — auditoria estática (leitura
direta do JSX/CSS resultante + sucesso de build/typecheck) foi a
validação realizada, consistente com a preferência já registrada de que
o usuário testa mudanças de UI diretamente. Nenhum dos cenários A-E do
§ 60 do pedido (header em light/dark/mobile, quick-add com/sem padrão,
Vínculos com usuário existente/inexistente, tabs finais) foi exercitado
num navegador real por este agente.

## 43. Confirmação de diff zero nos caminhos protegidos

`git diff --stat` sobre `firestore.rules`, `firestore.indexes.json`,
`packages/contrato/src/modeloPlantaoPersistente.ts`,
`lib/firebase/authRepository.ts`, `apps/app/`, `apps/push-worker/`,
`components/organizacao/`, `lib/contextoEscala.ts`, `components/escalas/`,
`lib/sessao.ts`, `lib/modelos.ts`, `components/plantao/PlantaoRoster.tsx`,
`components/plantao/PlantaoCalendario.tsx`,
`components/plantao/ModalEditarAtribuicaoPlantao.tsx`,
`components/plantao/PadraoHorarioSemanalCampo.tsx` — **vazio**. Jornada
6x1, `ContextoEscalaAtivo`, os dirty guards, App, Auth, Push,
Organização e o schema Plantão permanecem intactos.

## 44. Arquivos alterados

`app/globals.css`, `apps/dashboard/src/DashboardApp.tsx`,
`components/plantao/QuickAddPlantaoPopover.tsx`, `lib/importUsers.ts`,
`lib/importUsers.test.ts`, `package.json` (lista de arquivos de
`test:boundaries`), `packages/contrato/test/modeloPlantaoPersistente.test.ts`,
`tests/plantao-roster-drag-boundaries.test.mjs`,
`docs/spec/EDITOR_ESCALAS.md`, `docs/spec/PLANTOES.md`,
`docs/spec/REDESIGN_WORKSPACE_ESCALAS.md`.

## 45. Arquivos criados

`tests/plantao-homologacao-2b2-boundaries.test.mjs`,
`CHECKPOINT-FASE-ESCALAS-UX-2B2-HOMOLOGACAO.md`.

## 46. Limitações restantes para ESCALAS-UX-2C

- Contabilidade/Lista continuam com o layout atual (tabelas simples) —
  nenhum redesign visual profundo nesta fase.
- Pendências/Vínculos continua sendo uma tabela, não um painel/drawer
  dedicado — a melhoria desta fase foi só a ação principal ("Cadastrar e
  vincular" em vez de "Ir para Usuários"), não uma reestruturação visual
  completa (§ 34 do pedido: "não executar a 2C inteira").
- Nenhuma importação inline, nenhuma publicação de Plantão.
- O período do header (`26/07/2026 → 25/08/2026`) não foi encurtado
  para o formato abreviado sugerido (`26 jul → 25 ago`) — nenhum
  formatter pronto para esse formato específico foi encontrado sem
  introduzir um novo; registrado como possibilidade futura, não uma
  omissão silenciosa.

## 47. Git

Commit local único, mensagem `fix(ux): homologa editor e vinculos de
plantao`. Nenhum push, deploy, merge, rebase, amend, reset ou stash.

## 48. Confirmação

NÃO HOUVE PUSH. NÃO HOUVE DEPLOY. PRODUÇÃO NÃO FOI TOCADA.

Esta fase **para aqui** — não inicia `ESCALAS-UX-2C` nem `PLANTÃO-3C`.
