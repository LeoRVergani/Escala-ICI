# Auditoria visual inicial — agosto de 2026

A inspeção visual do modo de demonstração mostrou dois ambientes principais.

## Login

A tela de login usa uma composição dividida, com hero azul escuro à esquerda e cartão claro à direita. A marca, o título e o formulário estão legíveis, mas a densidade vertical do cartão é alta e o tratamento visual dos campos, checkbox e botões pode ser uniformizado com o restante do produto. O botão Microsoft, o botão de demonstração e o botão de entrada também usam hierarquias diferentes.

## Dashboard

O Dashboard autenticado tem sidebar branca, topbar translúcida, cabeçalho de página e cartões de conteúdo. A tela Escalas mostra hierarquias funcionais, porém há sinais de inconsistência que devem ser tratados pelo sistema visual: múltiplos raios e alturas de controles, densidade de bordas, CTAs com pesos diferentes, uso irregular de textos auxiliares e contraste entre o topbar e o conteúdo principal. A sidebar também precisa manter a mesma linguagem de estados ativos, hover e foco em todas as larguras.

## Direção inicial

A padronização deve preservar a paleta azul institucional e o conteúdo existente, mas consolidar tokens de raio, sombra, altura mínima de controles, espaçamento, tipografia de títulos e tratamento de superfícies. As mudanças devem priorizar Login, AppFrame/topbar/sidebar, cabeçalhos de página, cartões de métricas, botões, inputs/selects, modais e estados responsivos.


Após a primeira rodada de padronização, a tela Escalas ficou mais coesa: os cartões passaram a compartilhar raio e sombra, os botões têm alturas e estados mais consistentes, e o modal do wizard usa o mesmo tratamento de superfície e overlay. A hierarquia visual entre o título, o resumo da competência e os CTAs ficou mais clara no viewport desktop utilizado na inspeção.


O tema escuro foi validado no mesmo fluxo. A hierarquia de superfícies, texto, badges e botões permaneceu legível; os novos raios e sombras não criaram halos excessivos. O controle de tema também expõe corretamente a ação inversa de voltar ao modo claro.


O popover de conta foi revisado no modo claro. O raio, a borda, a sombra e o botão de saída agora seguem a mesma linguagem dos demais popovers e controles compactos.


A tela de login foi revisitada após o ajuste. O cartão mantém a composição split-screen original, mas agora os campos e botões compartilham altura, raio, foco e largura; o cartão utiliza o mesmo raio modal e a mesma sombra de superfície do Dashboard.


## Validação técnica

A validação completa posterior às mudanças visuais foi concluída com sucesso: 54 arquivos de teste e 947 testes unitários aprovados, build verificado e artefato validado. O lint terminou sem erros e manteve apenas seis avisos preexistentes em arquivos de teste Firebase. O build continua emitindo somente o aviso conhecido de chunk JavaScript acima de 500 kB.
