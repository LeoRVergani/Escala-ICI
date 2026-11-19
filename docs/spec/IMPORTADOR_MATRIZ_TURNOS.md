# Importador de escala em matriz "turno × data" (MATRIZ-TURNOS-1)

Formato novo, usado na **escala de fim de ano** do SOC: as **linhas** são os turnos (Madrugada, Manhã, Tarde, Noite), as **colunas** são as datas e cada célula
traz o **nome** de quem cobre aquele turno naquele dia. Quem não aparece num dia está de folga — a folga **não está escrita**. É uma importação em **trecho**: cobre
só os dias da planilha, não o período inteiro da competência.

## Reconhecimento (pela estrutura, nunca pelo nome do arquivo)

`localizarMatrizTurnos()` (em `packages/contrato/src/parserMatrizTurnos.ts`) procura uma célula **"Turno"** cuja linha tenha 3 ou mais dias da semana em sequência,
a linha de baixo com as datas (`dd/mm` ou data do Excel) e, na coluna do "Turno", 2 ou mais linhas seguidas com rótulos de turno de trabalho do catálogo.
A detecção só roda quando **não** há aba "Escalistas" (6x1) nem tabela de Plantão — o que já funcionava não muda. Tabelas ao lado da matriz (totais, fórmulas) nunca são lidas.

## Datas

O cabeçalho não traz o ano. Ele vem do **título** ("Escala de Final de Ano 2026"), de uma data completa ou de `anoInicio`; o ano é confirmado pelo **dia da semana** do
cabeçalho (se não bater, vale o ano vizinho que bate) e **vira** quando o mês volta (dezembro → janeiro). Dia da semana que não bate com a data é `ALERTA`.
Células de data com a palavra **"Feriado"** marcam feriados.

## Folgas (decisão do gestor)

| Dia | Código |
|---|---|
| feriado (cabeçalho com "Feriado") | `FOLGA` |
| sábado ou domingo | `DF` |
| dia útil | `DU` |

24/12 e 31/12 **não** são feriado (a menos que o cabeçalho diga "Feriado").

## Competência

O trecho precisa **caber** na competência (`periodoDoPonto`, ver `CALENDARIO_PONTO.md`). Se a competência do assistente não comporta o trecho, o Dashboard usa a do próprio
trecho e **avisa** ("Competência ajustada de X para Y com base nas datas da planilha"). Um trecho que atravessa o fechamento do ponto não cabe em nenhuma: erro `BLOQUEANTE`.

## Nomes

A planilha traz **primeiros nomes**. A conciliação (`lib/conciliacaoUsuarios.ts`) tenta, nesta ordem: login, apelido/nome completo cadastrado e — **só na matriz** — o **primeiro nome**,
entre usuários **ativos da equipe** e **só com correspondência única**. Dois "Carlos" ativos viram `CONFLITO_ALIAS` para o gestor escolher. Nome sem usuário vinculado é erro `BLOQUEANTE`
("Nome da planilha sem usuário vinculado") e **não** oferece cadastrar um login novo.

## Mesclagem do trecho (`lib/importacaoMatrizTurnos.ts`)

O Dashboard lê a escala que já existe da competência (**rascunho** primeiro; senão a **publicada**) e `mesclarTrechoNaBase` troca **só os dias do trecho**:

- os outros dias do período e as pessoas que **não** estão na matriz ficam como estavam (só viram rascunho);
- se **não existe** escala normal ainda, o rascunho só tem os dias do trecho e o Dashboard **avisa**: ao importar depois a escala normal, é preciso **reaplicar o arquivo de fim de
  ano por cima**, senão a escala normal apaga o trecho;
- se a escala existente **não puder ser lida**, nada é importado.

## Limites

- A matriz só é importada pelo **Dashboard** (o App recusa e orienta).
- Uma pessoa em dois turnos no mesmo dia é `BLOQUEANTE` (só o primeiro turno é mantido).
- O campo `seq` (posição no ciclo 6x1) não existe na matriz e fica omitido; a sequência de dias seguidos é calculada pelo sistema.
