# Checkpoint — Fase ESCALAS-SIMPLES-1 (simplifica criação e importação de escalas)

Data: 2026-08-17. HEAD inicial: `d716e3cb32f6c38dfbeeb6864bb9a84f386a92fb`
(`fix(ux): homologa editor e vinculos de plantao`).

## Decisão

Prioridade explícita de SIMPLICIDADE sobre exaustividade: "o sistema não
pergunta o que já dá para saber sozinho". Concretamente:

- **Área de gestão ativa** (`lib/areaGestaoAtiva.ts`, puro) resolve
  automaticamente qual unidade está em foco (1 disponível → automática;
  2+ → seletor discreto no header; preferência de sessão via
  `localStorage`, nunca autorização).
- **"Nova escala" e "Importar escala" abrem o MESMO wizard**
  (`ModalIniciarEscala`, renomeado de `ModalNovaEscala`, `modo: 'NOVA' |
  'IMPORTAR'`) — nenhum componente/fluxo paralelo.
- **Resolução automática de destino**: equipe (Jornada) e Grupo de
  Plantão são filtrados por autorização real (`podeGerenciarEquipe`/
  `podeGerenciarGrupoPlantao`) + área ativa. 1 opção → segue sozinho; 2+
  → pergunta; 0 → oferece criação inline (nunca navega para
  Administração), reaproveitando a MESMA escrita administrativa
  (`salvarEquipeDoModal`/`salvarGrupoPlantaoDoModal`).
- **Criar equipe exige `podeGerenciarUnidade`** (ADMIN_SISTEMA/
  GESTOR_UNIDADE, mesma regra de `firestore.rules`) — um GESTOR_EQUIPE
  comum nunca vê o formulário de criação, só a orientação de pedir a um
  gestor de unidade (a Rule rejeitaria a escrita).
- **Quick-add de Plantão**: três presets fixos (12h/24h/5h) sempre
  disponíveis, com ou sem `padraoHorarioSemanal` — substitui o bloqueio
  "Nenhum padrão configurado" da ESCALAS-UX-2B.2.

## Fluxo

```
Escalas
  [+ Nova escala]  [↑ Importar escala]  ← únicas 2 ações primárias
        │
        ▼
  ModalIniciarEscala (modo=NOVA|IMPORTAR)
  etapa 'tipo': Jornada 6x1 | Plantão
        │
   ┌────┴────────────────────────┐
   ▼ Jornada                     ▼ Plantão
equipesAdministraveisNaArea   gruposAdministraveisNaArea
   │ 1 → auto                    │ 1 → auto
   │ 2+ → etapa 'equipe'         │ 2+ → etapa 'plantao' (<select>)
   │ 0 → etapa 'criar-equipe'    │ 0 → etapa 'criar-plantao'
   ▼                             ▼
ContextoEscalaAtivo atualizado imediatamente (header)
   │                             │
   ▼                             ▼
tela 'importar'              NOVA: Importar/Usar anterior/Criar vazia
(única via — Jornada não     IMPORTAR: só "Selecionar planilha"
tem "criar vazia")               │
                                  ▼
                              Editor de Plantão (calendário/roster)
```

## Arquivos

- **Novo**: `lib/areaGestaoAtiva.ts` (+ `.test.ts`) — resolução pura de
  área/equipes/grupos administráveis.
- **Novo**: `tests/escalas-simples-1-boundaries.test.mjs` (13 testes).
- **`lib/editorPlantao.ts`**: `PRESETS_HORARIO_QUICK_ADD_PLANTAO`,
  `padraoDivergeDosPresetsQuickAdd`.
- **`lib/organizacao.ts`**: `gerarIdSugerido` (ID técnico a partir do
  nome, para a criação inline não pedir ID ao gestor).
- **`components/plantao/QuickAddPlantaoPopover.tsx`**: reescrito —
  lista de opções (presets + padrão do Grupo quando diverge) em vez do
  antigo bloqueio "sem padrão".
- **`apps/dashboard/src/DashboardApp.tsx`**: `ModalIniciarEscala`
  (renomeado/estendido de `ModalNovaEscala`); `abrirWizardEscala`/
  `abrirNovaEscala`/`abrirImportarEscala`; `escolherJornadaNovaEscala`/
  `escolherPlantaoNovaEscala` (resolução automática);
  `criarEquipeWizardAcao`/`criarPlantaoWizardAcao` (criação inline);
  `selecionarEquipeWizard`/`selecionarGrupoWizard` (atualizam
  `ContextoEscalaAtivo`); `escolherAreaGestaoAtiva` + estado
  `areaGestaoEscolhaManual`; seletor de área no header; botão "Abrir
  grade" removido do topo de "Escalas" (funcionalidade preservada via
  "Revisar grade" no card da escala atual).
- **Docs**: `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` (§38),
  `docs/spec/EDITOR_ESCALAS.md`, `docs/spec/PLANTOES.md` (§31).
- **Testes atualizados** (comportamento explicitamente superseded, não
  removidos): `tests/dashboard-navegacao-boundaries.test.mjs` (teste 8),
  `tests/plantao-homologacao-2b2-boundaries.test.mjs` (testes 16-19),
  `tests/plantao-roster-drag-boundaries.test.mjs` (testes 6, 8b, 9, 10, 11).

## Testes

| Suite | Resultado |
| --- | --- |
| `test:unit` | 968/968 (baseline 946 + 22 novos) |
| `test:boundaries` | 316/316 (baseline 303 + 13 novos) |
| `test:firestore-rules` | 166/166 (sem mudança — nenhuma Rule alterada) |
| `typecheck` / `typecheck:apps` / `typecheck:worker` | limpos |
| `lint` | 0 erros (6 warnings pré-existentes, não relacionados) |
| `build:dashboard` / `build:app:pages` | ok |
| `validate:pwa` / `validate:artifact` | ok |
| `git diff --check` | limpo |

## Limitações

- Jornada 6x1 continua sem "criar escala vazia" — toda escala de
  Jornada nasce de uma planilha importada (limitação arquitetural
  pré-existente, fora do escopo pedido). Em NOVA e IMPORTAR, Jornada
  termina igualmente na tela "Importar", só com a equipe já resolvida.
- A tela "Importar" continua autodetectando o tipo do arquivo pelo
  conteúdo; o tipo escolhido no wizard não bloqueia ainda com um erro
  explícito um arquivo do tipo oposto (§31 do pedido original) —
  autodetecção continua sendo a validação real.
- Validação visual (desktop/mobile, os 4 fluxos) não foi executada
  nesta sessão — o usuário prefere validar a UI diretamente.
