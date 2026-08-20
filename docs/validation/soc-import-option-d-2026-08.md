# Implementação da opção D — Importação SOC

## Escopo

A prévia da Jornada 6x1 do SOC recebeu a composição visual escolhida pelo usuário: resumo executivo, lista de colaboradores, matriz mensal, detalhe do dia selecionado e painel de pendências da fonte.

A alteração foi aplicada ao fluxo real em que o XLS é carregado e o Dashboard abre diretamente a tela `grade`. O componente novo é `components/ScheduleImportReview.tsx`. A grade tradicional `ScheduleGrid` permanece disponível para o editor de rascunhos sem arquivo importado e para as telas que já a utilizavam.

## Dados exibidos

A implementação reutiliza os dados já calculados pelo domínio e pelo parser. No cenário validado com `/home/ubuntu/upload/Escala-SOC-Controle-Agosto(2).xls`, a tela exibiu 31 dias, 4 turnos, 9 colaboradores e a matriz de 26/07/2026 a 25/08/2026. Os códigos `MD`, `M`, `T`, `N`, `X`, `DF`, `DU` e `BH` são apresentados com diferenciação visual.

O painel de pendências deriva dos erros, avisos e linhas de conciliação já presentes no estado da importação. Nenhuma regra nova de parsing, validação, persistência ou publicação foi criada.

## Interações preservadas

A seleção de dia atualiza o painel de detalhe diário. Os botões anterior/próximo percorrem a janela da competência. O clique em uma célula continua abrindo o modal existente de edição. As ações Adicionar colaborador, Salvar alterações, Remover da grade e Voltar para Escalas continuam conectadas aos callbacks originais.

## Validação

A tela foi conferida no navegador com o XLS real. Foi validada a abertura da tela D, a seleção de 12/08/2026, a atualização do detalhe para 9 atribuições e a abertura do modal de edição a partir de uma célula.

A suíte completa passou: 54 arquivos de teste e 947 testes aprovados; typecheck, build e validação do artefato também foram aprovados. O lint terminou sem erros, mantendo seis avisos preexistentes em testes Firebase. Não foi realizado push nem deploy.
