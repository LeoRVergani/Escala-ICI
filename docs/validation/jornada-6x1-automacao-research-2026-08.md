## Referência NIOSH/CDC

A página do National Institute for Occupational Safety and Health informa que trabalho em turnos e jornadas longas podem aumentar estresse, fadiga e riscos de segurança, além de reduzir o tempo de descanso e de responsabilidades fora do trabalho. A fonte observa que turnos noturnos e vespertinos apresentam riscos superiores aos turnos diurnos em comparação apresentada no material. Essa referência será usada como princípio de produto: o preenchimento assistido deve acelerar a montagem sem esconder conflitos, permitir edição individual e sinalizar riscos; não deve publicar automaticamente nem impedir a revisão do coordenador.

Fonte consultada: https://www.cdc.gov/niosh/learning/safetyculturehc/module-2/9.html — “Shiftwork, Long Work Hours, Fatigue”, NIOSH/CDC, última revisão indicada na página: 28 de abril de 2022.

## Referência HSE

A Health and Safety Executive orienta que escalas mal desenhadas devem equilibrar demanda de trabalho, descanso e recuperação. A página recomenda tratar fadiga como risco, avaliar mudanças de horário, consultar trabalhadores, definir limites para horas, horas extras e trocas, registrar horas/trocas e considerar duração, horário, direção da rotação e pausas. A fonte também destaca que não existe uma única escala ideal para todos os ambientes; por isso, o produto deve oferecer automação assistida, conflitos visíveis e edição manual em vez de uma regra rígida e invisível.

Fonte consultada: https://www.hse.gov.uk/humanfactors/topics/fatigue.htm — “Fatigue”, Health and Safety Executive.

## Validação de layout em runtime

Após a correção, a grade da demonstração manteve a janela completa de 26/07/2026 a 25/08/2026 mesmo com células preenchidas, em vez de reduzir-se ao primeiro dia com conteúdo. A coluna “Colaborador” permaneceu com largura fixa e sticky, enquanto as datas ficaram em colunas estreitas com rolagem horizontal. O fluxo de adicionar colaborador também abriu a linha vazia sem remover a grade da competência.

## Validação do assistente em runtime

No Dashboard local, Lia Vilar foi removida apenas da cópia da competência e reincluída como linha vazia. Ao abrir 26/07/2026, o modal exibiu **Preencher ciclo inicial 6x1** ativado. A escolha de `MD` aplicou o código em 26/07, 27/07, 28/07, 29/07, 30/07 e 31/07, sem preencher o sétimo dia. A mensagem exibida foi: “MD aplicado em 6 dias do ciclo inicial. Você pode editar cada dia separadamente.” A coluna Colaborador permaneceu fixa e os 31 cabeçalhos de data continuaram renderizados.
