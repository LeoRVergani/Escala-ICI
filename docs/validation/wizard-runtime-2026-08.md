# Validação runtime — Wizard Preparar escala

**Ambiente:** Dashboard local `http://127.0.0.1:4173/`  
**Data:** agosto de 2026

Após entrar na demonstração, a tela Escalas exibiu os botões `Importar escala` e `Nova escala` no cabeçalho. O fluxo segue sendo aberto pelos handlers existentes da tela Escalas; nenhum caminho paralelo foi criado.

A validação do modal continuará verificando a ausência do stepper artificial, a ausência de hiperlinks, a resolução dinâmica do destino e o comportamento de Nova/Importar.

O modal Nova escala foi aberto. A tela inicial mostra apenas os dois cards Jornada 6x1 e Plantão. Após selecionar Jornada, o modal exibiu o resumo `Criar nova escala`, a descrição da operação, o botão `Alterar`, a seleção de equipe e a competência, sem os textos `1 Tipo`, `2 Destino` ou `3 Editor`. A equipe aparece como seleção real (`COSI > SOC` e `COSI > Plantão` no demo), confirmando que a operação não está hardcoded como SOC. Depois da seleção, o resumo passou a mostrar `COSI > SOC` e o status `Destino pronto`. O modal foi fechado pelo botão de ícone sem alterar a tela Escalas.

O fluxo Importar escala abriu com a instrução específica de revisão. Após escolher Plantão, o resumo exibiu `Importar escala`, `Plantão`, `Destino pronto`, o grupo resolvido e a competência. O bloco de arquivo apareceu somente depois de tipo, destino e competência, e o CTA passou a ser `Continuar para revisão`. A tela não exibiu stepper nem hiperlink sublinhado.
