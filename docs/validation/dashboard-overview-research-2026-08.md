# Pesquisa — Visão geral unificada SOC + Plantão

**Data:** agosto de 2026  
**Objetivo:** orientar alternativas visuais para um dashboard operacional que permita ao coordenador acompanhar Jornada 6x1/SOC e Plantão em uma única visão, sem alterar as telas já aprovadas.

## Síntese aplicada ao Projeto Escala ICI

A pesquisa reforça que uma visão operacional deve colocar os sinais mais importantes no topo, usar hierarquia visual clara, limitar a quantidade de grupos simultâneos e manter as cores com significado estável. Para o projeto, isso significa começar com o estado de SOC e Plantão lado a lado, mostrar competência/status/cobertura antes de detalhes, reservar alertas para exceções acionáveis e permitir que cada card leve diretamente à tela correspondente.

A referência da ThoughtSpot recomenda usar espaço em branco como mecanismo de foco, organizar a tela por hierarquia visual, manter uma paleta consistente e colocar os KPIs críticos primeiro. Também sugere separar perguntas de negócio em grupos lógicos e limitar a quantidade de visualizações por grupo para evitar sobrecarga [1].

A referência da Shyft trata especificamente de gestão de turnos e reforça que o dashboard precisa organizar a informação pela decisão do gestor, combinando visão de cobertura, distribuição de carga e exceções. Esse princípio é aplicável ao resumo de duas escalas: o coordenador deve conseguir ver rapidamente se SOC e Plantão estão completos, quais pessoas/intervalos exigem atenção e qual ação deve ser tomada [2].

## Princípios que entrarão nos mockups

| Princípio | Aplicação proposta |
|---|---|
| Hierarquia de decisão | Topo com competência/contexto; segunda faixa com dois cards operacionais: SOC e Plantão. |
| Comparação direta | Mesmos campos nos dois cards: status, pessoas, período, cobertura/horas e alertas. |
| Cor com semântica | Azul institucional para navegação; cores de turno preservadas; amarelo/vermelho somente para pendências. |
| Ação contextual | Cada card oferece uma ação curta: “Revisar SOC” ou “Abrir Plantão”. |
| Exceções primeiro | Alertas e pendências aparecem em uma faixa inferior resumida, sem dominar a tela quando não há risco. |
| Densidade controlada | Evitar dezenas de métricas; usar poucos KPIs com significado operacional e cards compactos. |
| Não duplicar telas aprovadas | A Visão geral resume; o clique leva para Grade SOC, Importação SOC ou Calendário Plantão já existentes. |
| Assimetria funcional | Dar maior área ao resumo comparativo SOC + Plantão e reservar uma faixa menor para ações/alertas. |
| Cor limitada e acessível | Manter neutros como base, usar azul institucional para ação e reservar amarelo/vermelho para exceções; nunca depender somente da cor. |
| Ícones como reforço | Usar ícones ao lado de métricas e ações para reduzir texto e acelerar reconhecimento, sem substituir os rótulos. |

## Referências

[1]: https://www.thoughtspot.com/data-trends/dashboard-design-examples-best-practices "ThoughtSpot — Dashboard Design: Examples and Best Practices"

[2]: https://www.myshyft.com/blog/dashboard-layout-principles/ "Shyft — Essential Dashboard UX Design for Powerful Shift Management"

[3]: https://insightsoftware.com/blog/the-dos-and-donts-of-dashboard-design/ "insightsoftware — Dashboard Design Guide: Trends, Examples, + Best Practices"

A terceira referência recomenda assimetria funcional para conduzir o olhar, paleta limitada com cores reservadas a destaques e ícones como pistas visuais ao lado de métricas e navegação [3].
