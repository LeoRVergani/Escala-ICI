# Regras permanentes — Cascade e herança visual (App PWA + Dashboard)

Documento de regra de engenharia, não de estado de feature. Existe porque o
mesmo padrão de bug já causou retrabalho várias vezes durante a
implementação de Lembretes (Fases 4/4.1/4.2/4.2.1): um componente novo
recebe uma correção visual diretamente, o resultado não muda, e a causa real
está em outro nível — uma classe genérica compartilhada, um wrapper, um
elemento pai, um seletor mais específico (`.app-shell.product-app ...`) ou
uma media query.

**Esta regra é permanente e vale para toda alteração visual do projeto** —
App PWA, Dashboard, componentes React compartilhados, e a futura camada de
estilos equivalente quando a migração para React Native chegar (o raciocínio
sobre "quem realmente controla o layout" se aplica ali também, mesmo sem
CSS/cascade do DOM).

## Regra principal

**Antes de corrigir visualmente um componente, identifique a origem real do
comportamento no DOM/CSS. Não aplique a correção no filho antes de provar
que o filho é, de fato, a origem do problema.**

## Checklist obrigatório de investigação visual

Toda correção de UI/CSS deve responder, nesta ordem, antes de editar
qualquer arquivo:

1. Qual componente React renderiza o elemento?
2. Qual elemento HTML real é produzido?
3. Quais classes estão aplicadas diretamente a ele?
4. Qual é o pai imediato?
5. Quais classes existem no pai?
6. Quais ancestrais relevantes existem (painel, wrapper, `<article>`/`<aside>` externo)?
7. Existe um wrapper semântico entre o elemento e o ancestral com padding/estilo?
8. Existe uma classe genérica compartilhada envolvida?
9. Essa classe foi criada originalmente para **outro módulo/contexto**?
10. Existem seletores mais específicos, como `.app-shell.product-app ...`?
11. Existem media queries alterando o comportamento desse elemento?
12. Existem breakpoints mobile específicos (`≤480px`, `≤700px`, `≤780px`, outros)?
13. Qual seletor **realmente vence** no cascade (maior especificidade, ou empate resolvido por ordem no arquivo)?
14. Quais propriedades são herdadas do pai (não redeclaradas no filho)?
15. O problema vem de: filho / pai / wrapper / ancestral / media query / classe compartilhada / especificidade?
16. Corrigir **no nível responsável** — não necessariamente no elemento que "parece" ter o problema.
17. Conferir se a alteração impacta outro módulo que reutiliza a mesma classe.
18. Só depois de tudo isso, considerar criar uma classe semântica nova.

Quando houver navegador disponível, usar DevTools de verdade: inspecionar o
DOM, abrir "Computed Style", identificar o seletor vencedor de cada
propriedade suspeita, conferir media queries ativas e o box model (padding/
border/overflow) do elemento e do pai. **Nunca alegar que uma inspeção de
computed style foi feita sem ter sido feita de fato** — quando não houver
navegador disponível no ambiente, a alternativa é a auditoria estática
descrita no checklist acima (ler JSX, classes, wrappers, seletores, ordem no
arquivo CSS, media queries, especificidade), e isso deve ser declarado
explicitamente no relatório da fase, não apresentado como se fosse inspeção
real.

## Pai antes do filho

Se **múltiplos elementos** apresentam o mesmo sintoma — mesmo deslocamento,
mesma falta de padding, mesmo overflow, mesmo problema de largura, mesma
borda, mesmo alinhamento — suspeite primeiro do **container**: wrapper,
grid, flex, ou uma media query que atinge o pai. Não corrija cinco filhos
individualmente antes de auditar o pai; na prática, quando o sintoma se
repete em vários irmãos ao mesmo tempo, a causa quase sempre é uma só, e
está um nível acima deles.

## Reutilização: tokens sim, comportamento estrutural nem sempre

**Reutilizar tokens: sempre.** `--space-1`..`--space-10`, `--surface`,
`--surface-muted`, `--border`, `--border-strong`, `--primary`,
`--primary-soft`, `--primary-bright`, `--muted`, `--text`, radius e sombras
já estabelecidos — usar sempre que possível, nunca reinventar um valor
numérico arbitrário quando existe token correspondente.

**Reutilizar uma classe estrutural (não só os tokens que ela usa): somente
quando o contexto de uso for compatível.** Uma classe carrega não só cor e
espaçamento, mas também presunções sobre onde ela vive: se tem borda própria
ou não, se o pai já dá padding a ela ou se ela mesma precisa prover o
próprio, se foi pensada para ficar sozinha numa linha ou lado a lado com
outros elementos, se pode ficar condicionalmente ausente sem deslocar o
layout ao redor.

> **Reutilizar tokens preserva o Design System. Reutilizar comportamento
> estrutural incompatível propaga bugs de cascade.**

Exemplos do que evitar:

- Reutilizar uma classe criada para um chip/alias/tag num item que
  semanticamente é um card ou item de lista.
- Reutilizar um link textual solto (sem borda, padding zero, pensado para
  uma linha própria) dentro de uma toolbar/flex row de botões quadrados.
- Reutilizar um container que zera o próprio padding (esperando que **cada
  filho individual** proveja o seu, como acontece em `.selected-day-card`)
  sem replicar essa mesma compensação nos filhos novos que você está
  adicionando.

## Não empilhar overrides

Não é uma correção aceitável ir aplicando, em sequência, sem entender a
causa:

```
classe original
+ um override
+ um override de media query
+ um seletor ainda mais específico
+ !important
```

Isso deixa o CSS mais frágil a cada rodada, não mais correto. **Evitar
`!important` como solução padrão.** Primeiro corrigir na ordem: estrutura →
wrapper → classe semântica → especificidade → contexto de reutilização. Só
usar `!important` se o projeto já usar esse padrão exatamente naquele ponto
e houver uma justificativa real documentada (hoje o projeto já usa
`!important` em pouquíssimos pontos pontuais, ex.: `.checkbox-row`, para
vencer o `display: grid` genérico de `.admin-form-grid label` — isso não é
licença para generalizar o padrão).

## Casos reais registrados (Fases 4.2 / 4.2.1)

### Caso 1 — Botão "Hoje" colado à navegação mensal

**Sintoma:** o botão "Hoje" do calendário de Lembretes aparecia colado ao
botão de avançar mês, sujeito a clique acidental, e deslocava o cabeçalho ao
aparecer/desaparecer (layout shift).

**Causa real:** a classe `.today-back-to-today` foi criada para a tela Hoje
(Fase 1) — um link textual, sem borda, `padding: 0`, pensado para ficar
sozinho numa linha abaixo de um parágrafo. Foi reaproveitada dentro do
cabeçalho do calendário de Lembretes, um flex row ao lado de dois
`.icon-button` de 38px, e era renderizada condicionalmente (só existia fora
do mês atual).

**A classe não estava "errada"** — ela continua correta e intocada na tela
Hoje. **O contexto de reutilização estava errado.**

**Correção:** não alterar `.today-back-to-today`. Criar estrutura própria da
navegação de Lembretes: cabeçalho em duas linhas (navegação de mês / ação
Hoje), com "Hoje" como `.secondary-button.compact-button` **sempre
renderizado** (só `disabled` quando já no mês atual) — nunca mais
condicional, nunca mais layout shift.

### Caso 2 — "Próximos lembretes" como chip

**Sintoma:** cada item de "Próximos lembretes" aparecia como um chip/tag
solto, abaixo do padrão visual dos cards de lembrete de verdade.

**Causa real:** uma classe pill (`border-radius: 999px`, padding compacto de
chip) foi usada para representar um conteúdo que semanticamente é um
card/item de lista, só porque "parecia parecido" o suficiente no primeiro
rascunho.

**Correção:** remover a classe de chip (CSS morto, não um override).
`LembreteCard` ganhou uma prop `compacto` — mesma estrutura (título +
horário + badge), só menor — e "Próximos lembretes" passou a usar o mesmo
componente da lista do dia. Tokens preservados; comportamento de pill não.

### Caso 3 — Padding de "Próximos lembretes" (o mais instrutivo)

**Sintoma:** os textos "PRÓXIMOS LEMBRETES", a data do grupo, e o card
ficavam encostados na borda esquerda do painel — mesmo depois do Caso 2
corrigido.

**Uma correção superficial seria:** adicionar `margin-left` em cada texto
individualmente. Isso teria sido errado — e teria precisado ser repetido a
cada novo bloco adicionado ali no futuro.

**Causa real:** o componente reutiliza `.selected-day-card` (compartilhada
com `DetalheDia`, da escala). A regra `.app-shell.product-app
.selected-day-card { padding: 0; ... }` zera o padding do card **inteiro**,
de propósito: no `DetalheDia` original, cada bloco interno (`.selected-day-date`
e os demais) já tem o próprio padding compensando isso, em dois breakpoints
diferentes. Os blocos novos de Lembretes (lista do dia, botão "Novo
lembrete", "Próximos lembretes") nunca receberam essa compensação — por
isso ficavam colados na borda zerada.

**Correção:** criar um wrapper semântico único, `.lembretes-day-content`,
envolvendo os três blocos, com o **mesmo** padding horizontal que
`.selected-day-date` já usa nos **mesmos dois breakpoints** (`--space-5`/20px
no desktop, `--space-4`/16px em `≤780px`) — nunca `margin-left` individual.
Resultado: título, data e card alinham na mesma linha vertical do cabeçalho,
e `.selected-day-card`/`.selected-day-date` (usadas por `DetalheDia`, fora
do escopo do bug) não foram tocadas.

**Lição geral:** quando vários filhos apresentam o mesmo desalinhamento ao
mesmo tempo, investigue primeiro o container pai — é exatamente o cenário
descrito em "Pai antes do filho", acima.

## Regra para novas features visuais

Toda nova feature com componente visual deve, nesta ordem:

1. Identificar o Design System existente (tokens, classes, componentes já maduros equivalentes).
2. Reutilizar tokens.
3. Mapear os componentes compartilhados que pretende reaproveitar.
4. Verificar se essas classes compartilhadas carregam comportamento estrutural (não só tokens) — e se esse comportamento é compatível com o novo contexto.
5. Criar uma classe semântica específica do módulo quando o comportamento estrutural reutilizado não for compatível.
6. Validar desktop.
7. Validar mobile.
8. Validar tema claro.
9. Validar tema escuro.
10. Verificar a cascade (checklist acima) antes de adicionar qualquer override.

## Instrução obrigatória para agentes de código (Claude/Codex)

Antes de alterar CSS/layout em qualquer tela do Escala ICI, leia este
documento (`docs/spec/UI_CASCADE_E_HERANCA.md`). Não aplique uma correção
visual antes de mapear: o componente React, o DOM real, as classes diretas,
o pai, os ancestrais relevantes, as classes compartilhadas envolvidas, as
media queries ativas, e o seletor que realmente vence no cascade. Corrija no
nível responsável — não no elemento que só "parece" ter o problema. Declare
explicitamente se a validação foi feita por inspeção real de DevTools ou por
auditoria estática do CSS; nunca apresente uma como se fosse a outra.

Esta instrução deve ser referenciada nos futuros prompts de desenvolvimento
visual do projeto, tanto para o App PWA quanto para o Dashboard.
