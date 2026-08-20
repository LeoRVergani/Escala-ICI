# Checkpoint — Visão geral operacional SOC + Plantão

**Estado:** implementado localmente e validado em runtime.  
**Regra:** qualquer futura alteração deve ler este checkpoint antes de editar a Visão geral.

## O que foi implementado

A tela `visao` do DashboardApp foi reorganizada para ser uma central de acompanhamento de duas operações:

- card principal SOC/Jornada 6x1;
- card principal Plantão;
- faixa de métricas com Colaboradores, Dias no período, Saúde das escalas e Pendências;
- comparação de publicação;
- comparação de alertas;
- card acionável de Trocas pendentes;
- ações Nova escala e Importar escala no cabeçalho.

## Ações obrigatórias

- `Nova escala` deve continuar usando `abrirNovaEscala()` e o `ScheduleStartWizard` no modo `NOVA`.
- `Importar escala` deve continuar usando `abrirImportarEscala()` e o mesmo wizard no modo `IMPORTAR`.
- Card SOC deve usar `abrirOperacaoDoDashboard('JORNADA')`.
- Card Plantão deve usar `abrirOperacaoDoDashboard('PLANTAO')`.
- Trocas deve usar `abrirTrocasDoDashboard()` ou selecionar o `trocaId` existente.
- Contexto e competência devem mudar por `solicitarTrocaContexto`/`solicitarTrocaCompetencia`, nunca por uma segunda navegação paralela.

## Dados e limites

Os cards usam derivados de estados já existentes: `documentos`, `alertasVisiveis`, `gruposPlantaoAdmin`, `rascunhosPlantaoPorGrupo`, `participantesPorGrupoPlantao`, `resultadoPlantao`, `atribuicoesEditaveisPlantao`, `pendenciasVinculoPlantao` e `trocasPendentesGestor`.

As barras percentuais de saúde são somente apresentação. Não persistir essas porcentagens, não adicionar campos Firebase e não tratá-las como uma nova regra de negócio.

## Não regressão visual

Preservar todas as decisões anteriores:

| Padrão | Proteção |
|---|---|
| Grade Jornada 6x1 | Competência inteira, 31 datas e colaborador sticky. |
| Ciclo inicial 6x1 | Replicação para seis dias livres e edição individual. |
| Plantão | Calendário mensal, padrões Noturno/5h/24h e exceção manual. |
| Importação SOC | Roster, calendário central ampliado e ausência do card Detalhes do dia. |
| Retorno | Botão compacto `Escalas`, sem hiperlink sublinhado. |
| Contexto | Seletor superior alternando SOC/Plantão e competência. |

Não trocar a grade, o calendário Plantão, o Modal D ou a revisão SOC para layouts antigos ao trabalhar neste arquivo.

## Validação registrada

No runtime local foram confirmados:

- dois cards principais presentes, com largura de 474px cada na viewport de validação;
- botões do cabeçalho `Nova escala` e `Importar escala` presentes;
- ausência de overflow horizontal;
- Nova escala abre o wizard existente com Jornada 6x1 e Plantão;
- clique Plantão muda o seletor superior para Plantão e a competência para Agosto de 2026;
- clique Gerenciar trocas abre a tela `Trocas`.

## Arquivos desta fase

- `apps/dashboard/src/DashboardApp.tsx`
- `app/globals.css`
- `docs/spec/VISAO_GERAL_OPERACIONAL_SOC_PLANTAO.md`
- `CHECKPOINT-VISAO-GERAL-OPERACIONAL-2026-08.md`
- `docs/validation/dashboard-overview-research-2026-08.md`

## Instrução para futuras IAs

Antes de alterar a Visão geral, leia este checkpoint e a spec `docs/spec/VISAO_GERAL_OPERACIONAL_SOC_PLANTAO.md`. Faça mudanças somente dentro do escopo do dashboard operacional. Após qualquer alteração, execute typecheck, testes, lint, build, valide as ações no browser local e gere um novo ZIP completo do projeto.
