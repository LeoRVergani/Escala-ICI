# Validação runtime — Visão geral operacional

**Data:** agosto de 2026  
**Ambiente:** Dashboard local `http://127.0.0.1:4173/`

## Evidências coletadas

A Visão geral exibiu os cards SOC e Plantão, os cards de resumo Colaboradores, Dias no período, Saúde das escalas e Pendências, além dos cards Publicação, Alertas por operação e Trocas pendentes.

Na viewport de validação, foram confirmados dois cards de operação com 474px de largura cada, presença dos botões `Nova escala` e `Importar escala`, largura principal de 968px e ausência de overflow horizontal (`horizontalOverflow = false`).

O botão `Nova escala` abriu o wizard existente com as opções Jornada 6x1 e Plantão. Nenhuma regra nova de criação foi introduzida.

O clique no card Plantão alterou o seletor superior de `SOC` para `Plantão`, manteve a competência Agosto de 2026 e levou à tela `Escalas` com a mensagem `Nenhuma escala criada para Agosto de 2026`, pois o demo não possuía uma competência Plantão criada. Esse comportamento é intencional: o dashboard não cria escala automaticamente.

O clique em `Gerenciar trocas` levou à tela `Trocas`, com os filtros Pendentes, Aprovadas, Recusadas e Histórico visíveis. Como o demo não possuía solicitações, a tela exibiu zero pendências sem quebrar o card.

A captura final foi salva após retornar à Visão geral, contendo os dois cards de operação, os botões `Nova escala` e `Importar escala`, Saúde das escalas e Trocas pendentes. O arquivo é `Escala-ICI-visao-geral-runtime.webp`.
