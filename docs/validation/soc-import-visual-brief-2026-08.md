# Brief visual da importação SOC — 18/08/2026

## Fonte real analisada

Arquivo: `/home/ubuntu/upload/Escala-SOC-Controle-Agosto(2).xls`.

A planilha possui as abas `Escala` e `Escalistas`. A aba `Escala` contém 31 dias de cobertura entre 26/07/2026 e 25/08/2026, distribuídos em quatro turnos presenciais: Madrugada, Manhã, Tarde e Noite, além de uma coluna de férias/observações. A aba `Escalistas` possui uma matriz de 34 colunas com datas diárias, dias da semana, colaboradores e códigos de jornada como `DF` (DSR — final de semana), `DU` (DSR — dia útil), `X` (férias), números de escala e observações de compensação.

A escala usa nomes de usuário curtos/IDs (`aleilima`, `ivcarvalho`, `alamancio`, `altaborda`, `lvergani`, `cestradioto`, `thaisvribeiro`, `dschlottag`, `luizneto`) e situações que precisam ser legíveis na prévia, como férias, DSR, folga, folga de aniversário, hora extra, afastamento e compensação BH.

## Fluxo atual observado

O Dashboard mantém o cabeçalho azul-marinho com SOC, competência e status. A tela Escalas ainda apresenta o cartão de rascunho e as ações Importar escala/Nova escala. O wizard unificado apresenta Jornada 6x1 e Plantão como dois cards de escolha. A partir da seleção de Jornada 6x1, a prévia deverá continuar preservando a matriz diária, os turnos e os códigos da fonte, mas pode receber uma composição visual mais editorial e legível para o cenário SOC.

## Conceitos A e B revisados

O conceito A preserva a matriz atual como núcleo, mas organiza a grade com faixas por turno, células compactas coloridas, filtros no topo e métricas laterais. É a opção de menor ruptura para quem precisa continuar trabalhando com a lógica de planilha.

O conceito B transforma a leitura em um calendário operacional, mantendo os quatro turnos em cada dia e adicionando um painel lateral de alertas da fonte. É mais visual e mais fácil de ler por dia, porém exige uma mudança maior na composição da prévia atual.

## Conceitos C e D revisados

O conceito C apresenta quatro faixas horizontais por turno, com cards diários e um drawer de pendências da fonte. É o mais rápido para leitura operacional por turno e deixa as anomalias mais visíveis, mas pode exigir rolagem vertical em telas menores.

O conceito D combina resumo executivo, lista de colaboradores, faixa mensal compacta, detalhe do dia selecionado e tabela de alertas. É o mais completo para validação antes da publicação, mas também é o layout com maior densidade e maior mudança em relação à tela atual.

As quatro imagens foram geradas como conceitos visuais independentes. Nenhuma alteração foi aplicada ao código do projeto.

## Implementação em validação

O componente `ScheduleImportReview` foi integrado somente à prévia de importação de Jornada 6x1 (`tela === 'importar'` com `resultado.documentos`), mantendo a grade `ScheduleGrid` para o editor e para as demais telas. O fluxo do navegador foi reaberto até o wizard de seleção de tipo, pronto para carregar o XLS real do SOC.

## Ajuste descoberto no fluxo real

No runtime real, ao selecionar o XLS na etapa Arquivo do wizard, o aplicativo abre diretamente a tela `grade` com `resultado` carregado. Portanto, a composição D precisa ser aplicada ao estado importado da grade, e não apenas à seção `tela === 'importar'`. A prévia importada deve manter a possibilidade de revisão/edição existente, enquanto a tela de importação sem arquivo continua exibindo o wizard.

## Primeira validação runtime do painel D

Com o XLS real carregado, a tela `grade` exibiu o novo painel D com os dados corretos: 31 dias, 4 turnos, 9 colaboradores e a matriz com os códigos da fonte. O detalhe diário abriu em 18/08/2026 e listou 9 atribuições distribuídas entre Madrugada, Manhã, Tarde e Noite. O painel de pendências preservou os 9 erros do parser e o aviso associado, totalizando 10 itens apresentados na revisão visual.

A captura de runtime confirmou que a matriz, o roster, os controles de dia, as ações Adicionar colaborador/Salvar alterações e o painel de pendências cabem no fluxo real sem substituir a lógica de importação.

A interação foi validada: selecionar 12/08/2026 atualizou o detalhe diário para essa data, e clicar na célula de `aleilima` abriu o modal existente `Editar célula` com os códigos de turno atuais. A edição continua conectada ao callback original do Dashboard.
