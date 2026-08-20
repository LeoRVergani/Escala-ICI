# Comparação visual da Grade 6x1 — agosto de 2026

A captura local `Escala-ICI-jornada-ciclo-runtime.webp` registra uma grade com card branco, filtro de turnos, grupos coloridos por período, coluna `Colaborador` sticky, chips de turno e legenda inferior. A spec `JORNADA_6X1_ASSISTENTE_CICLO.md` formaliza as medidas da tabela: coluna de colaborador com 220px no desktop, datas com 58px e `table-layout: fixed`.

A tela atual mantém esses elementos e também exibe o novo botão compacto `Escalas`. A busca no repositório não encontrou uma imagem ou spec adicional que registre outro mockup aprovado especificamente para a composição da Grade 6x1. O redesign mais amplo em `REDESIGN_WORKSPACE_ESCALAS.md` descreve um workspace futuro com roster lateral e toggle Grade/Lista, mas a implementação atual continua usando a tabela `ScheduleGrid` existente.

Antes de alterar a composição visual, é necessário confirmar se o usuário está apontando para esse workspace futuro (roster lateral + Grade/Lista) ou para outra referência visual não presente nos arquivos locais. Não alterar regras de domínio, ciclo 6x1, persistência ou largura fixa até essa confirmação.
