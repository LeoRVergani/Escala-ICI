# Calendário do ponto — o ciclo das escalas (Jornada e Plantão)

**CALENDARIO-PONTO-1.** Fonte da regra: comunicado da Gestão de Pessoas de **10/11/2026** ("Novo calendário de fechamento do ponto").

## A regra

- O ponto **fecha sempre no dia 16**: o período vai do **dia 17 de um mês ao dia 16 do mês seguinte**.
- O **primeiro período** do novo calendário foi **parcial**: 26/10 a 16/11.
- **Exceção em dezembro**: o fechamento é antecipado para **15/12** (ajustes nos dias 16 e 17/12).
- **Transição em janeiro**: o período seguinte vai de **16/12 a 16/01** (32 dias). Depois disso, o fluxo regular: 17 a 16.
- A **competência** (rótulo `AAAA-MM`) é **sempre o mês em que o período termina**.

| Competência | Período | Observação |
|---|---|---|
| até 2026-10 | 26 do mês anterior a 25 | ciclo antigo |
| 2026-11 | 26/10 a **25/11** | ciclo antigo, **como já foi publicado** (há trocas/edições em andamento) |
| 2026-12 | **17/11 a 15/12** | exceção (fecha antecipado) |
| 2027-01 | **16/12 a 16/01** | transição (32 dias) |
| 2027-02 em diante | 17 do mês anterior a 16 | regular |

Novembro **fica** 26/10 a 25/11 de propósito: a escala de novembro já está publicada assim. Por isso os dias **17 a 25/11 existem nas duas escalas** (novembro e dezembro); daqui para frente eles **pertencem a dezembro** (`competenciaDoPonto('2026-11-20') === '2026-12'`). Onde dois documentos cobrem a mesma data, **vale a competência mais recente** (App: `mesclarDiasEscalas` e `selecionarEscalaPorData`; worker: `mesclarDiasDasEscalas`).

## Onde a regra mora (fonte única)

`packages/contrato/src/jornada.ts`:

- `periodoDoPonto(competencia)` → `{ periodoInicio, periodoFim }` (ou `null` se o rótulo for inválido);
- `competenciaDoPonto(dataIso)` → a competência da data;
- `competenciaOperacional(dataIso)` e `competenciasCandidatas(dataIso)` usam o calendário (com `diaCorte` explícito voltam à regra simples antiga);
- `periodoDaCompetencia()` (Plantão e Dashboard) e `dataPertenceCompetencia()` delegam a `periodoDoPonto`.

O **push-worker não importa o contrato** (a imagem Docker leva só o worker). Ele procura a escala numa **janela de três rótulos** (mês anterior, do calendário e seguinte) — o rótulo certo é sempre um desses — e um teste confere esse atalho contra `competenciaDoPonto` para as datas de 2020 a 2032.

As **Regras do Firestore não dependem do ciclo**.

## Quando o RH mudar o calendário de novo

1. Acrescente uma linha em `EXCECOES_PONTO` (ou mude `ULTIMO_ROTULO_CICLO_ANTIGO` / a regra regular, se o fechamento mudar de dia).
2. Atualize a tabela acima e os testes de `packages/contrato/test/calendarioPonto.test.ts` (as datas-chave do comunicado).
3. Rode a bateria: o teste de ida e volta (todas as datas até 2032) e o de encadeamento (nenhum dia sobra nem se repete) acusam buracos e sobreposições.
4. Se um período novo passar de 31 dias (como janeiro de 2027), nada trava: não há limite de tamanho de período no código nem nas Regras.

## O que NÃO é tratado aqui

- A **contagem de dias seguidos** reinicia no primeiro dia de cada escala (não olha a escala anterior). No começo de cada escala ela pode ficar 1 ou 2 abaixo do real.
