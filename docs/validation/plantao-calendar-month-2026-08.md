# Validação visual do calendário mensal — 18/08/2026

A prévia real foi atualizada no Dashboard local com o arquivo `/home/ubuntu/upload/Relatorio-PlantaoCOSI(1).xls`.

A importação passou a exibir uma única grade mensal, iniciando em **Agosto de 2026**, com o botão **Hoje**, controle de mês anterior e controle de próximo mês. O botão de mês anterior foi acionado e exibiu **Julho de 2026**; em seguida, o controle de próximo mês retornou para agosto. Os dados da fonte permaneceram inalterados durante a navegação.

O calendário exibe chips compactos com as iniciais dos plantonistas (`CF`, `JR`, `BB`), horários de turno, plantões de 24h e a duração atípica. O painel lateral apresenta a legenda dos plantonistas, os exemplos de turno noturno, diurno e 24h e a nota sobre a madrugada do plantão noturno.

A captura foi feita no runtime real. O viewport efetivo do navegador durante a validação foi de 1280×1100 CSS px, com `devicePixelRatio=1`. O CSS inclui empilhamento do painel de legenda abaixo de 1080px e ajuste adicional abaixo de 780px.
