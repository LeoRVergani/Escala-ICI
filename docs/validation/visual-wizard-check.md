# Validação visual do wizard de Escalas

Em 18/08/2026, o Dashboard local em modo emulador abriu diretamente na tela **Escalas**, com os CTAs **Importar escala** e **Nova escala** visíveis; não houve upload prematuro na entrada.

Ao clicar em **Nova escala**, o primeiro passo mostrou somente os tipos **Jornada 6x1** e **Plantão**. Ao escolher **Jornada 6x1**, o segundo passo exibiu a competência 2026-08, a equipe única `COSI > SOC` como resolvida automaticamente e uma mensagem neutra quando a hierarquia de áreas não estava carregada no modo demo. O botão **Abrir editor** levou à mesma `Grade da equipe` já existente.

A Grade abriu com 9 colaboradores, período 26/07/2026 → 25/08/2026, células vazias editáveis com `+`, botão de adicionar colaborador, filtros e **Salvar alterações**. Não houve componente de editor paralelo nem scroll horizontal global; apenas a grade possui rolagem horizontal própria para as colunas.


No ramo de **Plantão**, o wizard mostrou a mesma estrutura e a ação contextual **Criar Plantão** quando nenhum Grupo administrável foi encontrado na área. A competência e as ações **Usar período anterior** / **Abrir editor** permaneceram no mesmo fluxo, sem abrir uma aba ou modal paralelo.
