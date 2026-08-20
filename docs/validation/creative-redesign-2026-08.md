# Redesign autoral do Dashboard — 18/08/2026

## Direção visual

A nova linguagem será um **painel operacional em duas camadas**. A navegação lateral deixa de ser uma superfície branca genérica e passa a funcionar como um rail institucional em azul-marinho profundo, com marca, navegação, status do sistema e ação de recolher menu organizados em uma única coluna visual. O item ativo será um módulo luminoso azul, com texto branco e indicador interno, para criar uma seleção claramente perceptível sem uma faixa que escape para fora do componente.

A área de trabalho será uma superfície quase branca levemente azulada, com o conteúdo respirando dentro de uma malha editorial mais ampla. O topbar será branco e elevado somente por uma linha inferior e um pequeno acento superior azul; não haverá um cartão atravessando a largura. Os controles de Escala atual e Competência formarão um pequeno deck contextual com rótulos, valores e gatilhos claramente separados, enquanto o Status funcionará como um marcador de estado, não como um campo.

## Intenção

A mudança precisa ser imediatamente visível mesmo sem conhecer o CSS: contraste entre rail e conteúdo, maior hierarquia entre navegação e operação, seleção ativa mais expressiva e uma tela Escalas com fundo de trabalho menos plano. A lógica de navegação, contexto, competência, status e ações permanece intocada; somente a linguagem de layout e superfície será redesenhada.

## Restrições

Não alterar handlers, contratos, Firestore, permissões ou fluxo de negócio. Preservar foco de teclado, menu móvel, tema escuro, responsividade e os componentes de contexto existentes.


## Validação visual inicial

O redesign já apresenta uma mudança claramente perceptível em runtime. No tema claro, a sidebar passou a ser um rail azul-marinho com gradiente sutil, marca separada por uma linha, navegação em módulos e item ativo azul com brilho e indicador interno. O workspace assumiu um fundo azul muito claro, enquanto cartões continuam brancos e mais destacados.

No tema escuro, o rail fica mais profundo, o item ativo mantém contraste e a área de trabalho continua legível sem depender de uma moldura pesada no topbar. Os controles de Escala atual e Competência continuam separados por divisórias discretas, sem formar um cartão contínuo.


## Validação técnica

A suíte completa foi concluída com sucesso: 54 arquivos de teste e 947 testes aprovados, lint sem erros, build verificado e artefato validado. Permanecem apenas seis avisos preexistentes em testes Firebase e o aviso conhecido de chunk JavaScript acima de 500 kB. Não foram alterados handlers, contratos, permissões, regras ou schema.
