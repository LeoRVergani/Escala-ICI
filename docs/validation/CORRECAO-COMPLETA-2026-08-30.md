# Correção completa — COSI, CODB, importação, competência, permissões, App e Dashboard

Data: 2026-08-30. Fonte: commit `d9435e584283a1eb76da03c6f2f359affd2c8077`, branch `feat/redesign-visual-app-dashboard`. O ZIP da `main` não foi usado.

## 1. Causas raízes encontradas

- O detector multifonte confundia a coluna plural lateral `Plantonistas` (contabilidade) com uma segunda fonte operacional.
- A validação de destino só rejeitava funções fora do Grupo; um arquivo de posto único não tinha `funcao` e passava silenciosamente para um Grupo multiposto.
- Multiposto vazio tinha zero faltas porque não havia ocorrência da qual derivar postos, terminando incorretamente em `OK`/publicável.
- A competência informada no Wizard prevalecia sobre a competência inequívoca detectada no arquivo.
- O Wizard confundia “Grupo inexistente” com “Grupo existente sem administração”, oferecendo criação duplicada.
- O App não filtrava Grupos inativos da lista consultável.
- A reidratação do rascunho CODB descartava a `funcao` persistida de cada atribuição; por isso, após publicar, todos apareciam em todos os postos e os totais ficavam zerados.
- A Jornada tratava qualquer pendência de origem como bloqueio absoluto de persistência, sem permitir o fluxo operacional de correção posterior.

## 2. COSI — problema e solução

O XLS real possui `Plantonista Segurança` e uma tabela lateral de contabilidade com o plural `Plantonistas`. O detector agora reconhece somente `Plantonista` ou `Plantonista <fonte>` no singular. Resultado real: 32 ocorrências, 32 atribuições, 3 pessoas na tabela operacional, zero erros e zero avisos. Ao escolher CODB como destino, a mesma fonte de posto único é bloqueada antes do Editor com mensagem de incompatibilidade.

Foi adicionado `scripts/staging/auditar-reparar-plantao-cosi.mjs`: dry-run padrão, guarda literal de `escala-ici-staging`, auditoria de canônico/legados/participantes/publicações/rascunhos/Matriz e reparo idempotente somente das ACLs deriváveis. Nunca cria outro Grupo e nunca move ou apaga dados.

## 3. CODB — problema e solução

O motor universal continua em camadas: multifonte primeiro, parsers especializados preservados e adaptação ao modelo canônico sem big-bang. A função pertence à atribuição, nunca ao usuário. A saúde multiposto bloqueia arquivo sem função, função fora do Grupo e zero atribuições.

A reabertura do rascunho agora conserva a função persistida em cada atribuição. Assim, publicar CODB não perde a separação por DBA, Linux, Telecom e Windows.

| Métrica do XLS real | Resultado |
|---|---:|
| Pessoas únicas | 17 |
| Ocorrências | 32 |
| Atribuições | 128 |
| DBA | 32 |
| Linux | 32 |
| Telecom | 32 |
| Windows | 32 |

## 4. Jornada — resultado

Os quatro arquivos reais foram reconhecidos como `ESCALA_6X1`, janela 26/08/2026–25/09/2026, 31 dias e 9 colaboradores. O validador em duas passagens separa a ausência do diretório real de identidades dos erros da planilha: depois de vincular os nove logins a UIDs sintéticos locais, a planilha NOC mantém exatamente uma inconsistência estrutural de origem. 6x1 e descanso mínimo de 11 horas permanecem cobertos pela suíte unitária.

No Dashboard, essa inconsistência continua visível, mas não impede salvar. A publicação também é permitida mediante justificativa obrigatória. A pendência e a justificativa ficam persistidas no rascunho, na versão publicada e no histórico para correção posterior. Somente vínculo de identidade não conciliado continua impedindo a gravação, pois o sistema não pode adivinhar a pessoa correta.

## 5. Competência — solução

A competência é calculada pelo início de cada ocorrência usando 26→25. O fim não desloca a ocorrência: 25/08 19:00→26/08 00:00 continua na competência encerrada em 25/08. Somente os dias imediatamente anterior e posterior à janela são contexto. Uma competência inequívoca ajusta o Wizard com mensagem clara; duas competências reais bloqueiam a importação.

Nesta cópia CODB, os inícios vão de 25/08/2026 a 25/09/2026: competência `2026-09`, período 26/08–25/09, com 25/08 como contexto. Isso documenta a diferença para a faixa aproximada 25/07–26/08 citada na conversa.

## 6. Permissões — resultado

Consulta, participação e administração seguem distintas. Grupo existente sem administração não vira criação; a mensagem orienta revisar responsável/Matriz. Há preflight pelo ID determinístico. Matriz inativa permanece fail-closed, NOC legado não é reutilizado e delete físico segue negado. As Rules não foram alteradas.

## 7. App — resultado

O App descobre publicação por Grupo consultável, participantes e competência `PUBLICADA`; `CANCELADA` não fica ativa. A seleção padrão prioriza participação + publicação e desambigua canônico/legado. Grupos inativos agora são removidos da lista operacional. O script COSI inclui as equipes dos participantes ativos nas ACLs do Grupo e da Matriz sem depender de um segundo `equipeId` no usuário.

## 8. Dashboard — resultado

Incompatibilidade e multiposto vazio são bloqueados antes do Editor. O calendário abre na competência detectada. O Wizard não sugere duplicar COSI quando o Grupo existe sem administração. Cards e revisão mostram “Sem dados”, nunca “Tudo certo”/“Pronto”, para CODB vazio.

No NOC, erros da fonte são pendências auditáveis: o botão de salvar permanece disponível e a publicação abre a confirmação com justificativa. Ao reabrir o rascunho, as pendências reaparecem para revisão e correção.

## 9. UX corrigida

- mensagem direta para posto único enviado a multiposto;
- ajuste de competência informado;
- mensagem distinta para Grupo existente sem acesso;
- `Sem dados` explícito nos cards/revisão;
- criação duplicada removida desse estado.

## 10. Specs atualizadas

Este checkpoint foi referenciado no índice e na master spec. As regras normativas seguem nas specs temáticas (`PLANTAO_CODB`, `IMPORTADOR_UNIVERSAL_ESCALAS`, `PLANTAO_MULTIPOSTO`, `ESCOPO_OPERACIONAL_MATRIZ`, `APP_PLANTAO_VISUALIZACAO` e `JORNADA_6X1_E_DESCANSO`).

## 11. Arquivos principais alterados

- `packages/contrato/src/detectorTabelaPlantaoMultiFonte.ts`
- `lib/importadorPlanilha.test.ts`
- `lib/plantaoMultiposto.ts` e testes
- `lib/montagemRascunhoPlantao.ts` e testes
- `lib/inicioEscala.ts` e testes
- `lib/firebase/plantaoReadRepository.ts` e testes
- `apps/dashboard/src/DashboardApp.tsx`
- `components/escalas/ScheduleStartWizard.tsx`
- `components/plantao/CardFuncaoPlantao.tsx`
- `components/plantao/RevisarPublicacaoPlantaoModal.tsx`
- `scripts/validate-real-spreadsheets.ts`
- `scripts/staging/auditar-reparar-plantao-cosi.mjs`

## 12. Testes executados e resultados

| Comando | Resultado |
|---|---|
| `npm run typecheck` | aprovado |
| `npm run typecheck:apps` | aprovado |
| `npm run test:unit` | 77 arquivos, 1.481 testes aprovados |
| `npm run test:boundaries` | 502 testes aprovados |
| `npm run test:firestore-rules` | 381 testes aprovados |
| `npm run lint` | aprovado, 0 erros e 8 avisos preexistentes |
| `npm run build:apps` | Dashboard e App aprovados |
| `npm run build:app:pages` | App/SPA/PWA aprovado |
| `npm run validate:real-spreadsheets -- <6 arquivos>` | aprovado |
| `git diff --check` | aprovado |

Os builds mantêm apenas o aviso conhecido de chunks acima de 500 kB. A suíte de Rules registra no stderr as negações esperadas dos testes negativos e o aviso de futura exigência de Java 21; terminou com código 0.

## 13. Testes que não puderam ser executados

O dry-run no Firestore de staging não foi executado porque o ambiente não forneceu uma credencial `GOOGLE_APPLICATION_CREDENTIALS` do projeto `escala-ici-staging`. Nenhum deploy foi realizado. O script falha fechado se a credencial estiver ausente ou apontar para outro projeto.

## 14. Scripts staging criados

```bash
# plano somente leitura
GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
node scripts/staging/auditar-reparar-plantao-cosi.mjs

# aplicação idempotente somente das ACLs derivadas
GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
node scripts/staging/auditar-reparar-plantao-cosi.mjs \
  --apply --confirm=REPARAR_PLANTAO_COSI
```

## 15. Riscos e dívidas restantes

- Bundles principais acima de 500 kB minificados; code splitting é dívida de performance.
- COSI legado com histórico exige decisão operacional; o script audita e não migra/apaga silenciosamente.
- Aceite online do App e dry-run de staging dependem de acesso ao ambiente real.

## 16. Comandos exatos para colocar a versão na VM

O roteiro completo, incluindo troca sem sobreposição, preservação dos `.env`,
rollback, deploy e aceite funcional, está em `ATUALIZACAO-VM-ZIP.md` na raiz do
pacote. A pasta antiga não deve receber uma extração por cima: a versão nova é
validada ao lado e depois substitui a pasta inteira.

## 17. Build/redeploy do Dashboard staging

```bash
cd /opt/escala-ici/releases/corrigido-final
cp .env.staging.dashboard.example .env.staging.dashboard
# preencher os VITE_* públicos de staging e a confirmação exigida
npm run firebase:staging:preflight
npm run docker:dashboard:staging:build
npm run docker:dashboard:staging:up
docker compose --env-file .env.staging.dashboard \
  -f deploy/dashboard/compose.yaml -f deploy/dashboard/compose.staging.yaml ps
curl --fail http://127.0.0.1:4173/health
```

App staging, somente após confirmar o projeto Pages existente `escala-ici-staging`:

```bash
npm run build:app:staging
npm run pages:deploy:staging -- --confirm=DEPLOY_STAGING
```

## 18. Deploy de Rules

Esta entrega contém o contrato completo atual de Rules e índices, validado por
381 testes. No staging, execute o preflight e use a confirmação literal:

```bash
npm run firebase:staging:preflight
npm run firebase:staging:deploy -- --confirm=DEPLOY_STAGING
```
