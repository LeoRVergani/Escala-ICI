# Pesquisa visual para o Dashboard Escala ICI — 18/08/2026

## Referências consultadas

1. [Material 3 — Top app bar](https://m3.material.io/components/app-bars/overview)
2. [Material 3 — Navigation drawer](https://m3.material.io/components/navigation-drawer/overview)
3. [Preline — Dashboard sidebars](https://preline.co/blocks/navigation-layout/dashboard-sidebars/)
4. [Mintlify — Design matters: dashboard glow-up](https://www.mintlify.com/blog/design-matters)
5. [Linear](https://linear.app/)

## Achados aplicáveis

O Material 3 trata a barra superior como uma superfície de navegação e ação contextual, não como um grande cartão separado do conteúdo. O título/estado principal deve ter prioridade visual, enquanto ações e controles secundários ficam agrupados com espaçamento previsível. O Navigation drawer é uma estrutura persistente para trocar de destino em telas grandes, com seleção claramente marcada e adaptação para telas menores.

As referências de dashboards modernos convergem em uma linguagem de baixa ornamentação: sidebar estável, seleção ativa com uma superfície tonal discreta, topbar com separação por espaço e não por excesso de bordas, controles compactos com estados claros, e cartões de conteúdo com hierarquia tipográfica forte. A direção escolhida para o Escala ICI será uma **operação editorial clara**: fundo quase branco, sidebar branca levemente contrastada, azul institucional reservado para seleção e ações primárias, bordas finas somente onde ajudam a delimitar controles, e sombras suaves apenas em superfícies elevadas.

O cabeçalho do Escala ICI não deve receber uma caixa única atravessando o nav. Escala atual, competência e status devem funcionar como um grupo contextual leve, integrado ao topbar, com rótulos pequenos, valores legíveis, distância suficiente entre blocos e bordas apenas nos gatilhos clicáveis. A navegação lateral deve continuar persistente, sem competir com o conteúdo principal.

## Critérios de aceitação

| Critério | Resultado desejado |
|---|---|
| Hierarquia | Identidade, destino atual e contexto da escala devem ser reconhecíveis em poucos segundos. |
| Densidade | O nav não deve parecer uma faixa de formulários nem uma barra vazia; espaçamento deve separar grupos sem criar caixas excessivas. |
| Controles | Gatilhos clicáveis têm affordance e foco visível; rótulos e valores não recebem bordas artificiais. |
| Seleção | A seção ativa usa tonalidade azul clara e um indicador discreto, sem botão azul preenchido para toda a navegação. |
| Responsividade | Em largura menor, o sistema usa menu móvel e não força os controles do contexto a ocupar uma faixa ilegível. |
| Tema escuro | O mesmo vocabulário tonal deve manter contraste sem transformar o cabeçalho em um bloco pesado. |


## Observações adicionais

A página do Linear reforça o uso de uma sidebar persistente com grupos curtos e nomes diretos, separando navegação principal, favoritos e áreas de trabalho. A navegação não tenta transformar cada item em um cartão; o foco vem de agrupamento, tipografia e estado ativo.

A documentação e os exemplos do Preline mostram que sidebars modernas podem alternar entre modo completo, compacto e rail de ícones, mas o padrão precisa manter uma área de toque clara, um cabeçalho móvel separado e uma superfície de navegação estável. O Mintlify destaca duas decisões relevantes para este projeto: redesenhar o sistema visual como um conjunto coerente de cores, espaçamentos, fontes e ícones, e aplicar progressive disclosure para evitar que a interface exponha todas as informações ao mesmo tempo.

A direção final será um dashboard operacional claro com sidebar branca de 218–240px, estado ativo tonal azul-claro com indicador lateral discreto, topbar branco translúcido apenas com divisão inferior, contexto de escala apresentado como texto + gatilho individual e conteúdo principal em uma coluna ampla com cartões planos e sombras mínimas. O objetivo é parecer um produto operacional maduro, não uma sequência de caixas.


## Primeira validação em runtime

No Dashboard local, a nova direção já apresenta uma sidebar mais leve: largura reduzida, navegação com ritmo vertical mais compacto e estado ativo tonal com indicador interno, sem a barra azul extrapolando para fora do item. O topbar passou a usar uma superfície sólida e uma separação inferior discreta. O contexto de escala permanece integrado ao cabeçalho, mas agora com largura limitada e sem a moldura contínua rejeitada anteriormente.

A leitura visual ficou mais próxima de um produto operacional contemporâneo: conteúdo e ações ganham prioridade, enquanto a navegação fica estável e silenciosa. A próxima etapa é conferir o mesmo resultado no tema escuro e em largura menor antes de fechar a implementação.


A conferência em tema escuro mostrou que a sidebar e os cartões preservam contraste, enquanto o item ativo permanece identificável sem brilho excessivo. O topbar continua discreto e o azul fica concentrado em seleção, status e ações. Após voltar ao tema claro, não houve alteração funcional ou de navegação.
