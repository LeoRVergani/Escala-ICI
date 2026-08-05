# Checkpoint — Fase 3K-D2A (Grade)

## Objetivo

Corrigir os problemas visuais/funcionais encontrados ao testar a Fase 3K-D2:
layout apertado/sobreposto na Grade, ausência de um fluxo explícito para
incluir/remover colaborador da escala de uma competência, falta de
agrupamento por período e cabeçalho de datas pouco legível.

Esta fase também absorveu, a pedido do usuário durante a mesma sessão, um
refinamento visual maior: padronizar cores por período de turno em todo o
PWA e no Dashboard, e um redesenho do login mobile. Ambos estão descritos
abaixo junto com a parte de Grade, já que compartilham os mesmos tokens de
cor (`--periodo-*`).

## Causa raiz

1. **Sem fluxo de membro da grade.** `novoUsuario()`/o cadastro de usuário
   (Fase 3K-D2) só criam o documento em `usuarios`. Não existia nenhuma
   função ou botão que criasse o documento correspondente em
   `rascunhosTurnosMes` para aquele usuário na competência aberta — por
   isso um usuário recém-cadastrado nunca aparecia na Grade, e não havia
   como tirar alguém da grade sem editar o Firestore.
2. **Toolbar sem quebra de linha.** `.toolbar` era `display:flex` sem
   `flex-wrap`, e os campos usavam `min-width` fixo (150–220px) em vez de
   `width` com `max-width:100%` — em telas estreitas ou com muitos filtros,
   os campos se espremiam ou vazavam da faixa da ferramenta.
3. **Modal sem limite de altura.** `.edit-modal` não tinha `max-height` nem
   `overflow-y`; um modal com conteúdo mais alto que a viewport (formulário
   de usuário com aliases, por exemplo) ficava cortado ou sobreposto pela
   própria borda da tela, sem scroll interno.
4. **Cabeçalho de data pouco legível.** `ScheduleGrid` mostrava só
   `dia/mês` sem o dia da semana, calculado manualmente sem `Intl`.
5. **Sem agrupamento por período.** A grade listava os colaboradores na
   ordem em que vinham do array, sem nenhuma organização por turno.

## O que foi implementado — Grade

### `lib/gradeMembros.ts` (novo, puro)

- `criarMembroGrade(colaborador, turnoPadrao, referencia, catalogo)`: monta
  um `TurnosMes` em branco (`dias: {}`, `status: 'RASCUNHO'`) para um
  usuário já cadastrado;
- `adicionarMembroGrade` / `removerMembroGrade`: inclui ou tira um
  documento de um array de documentos, sem tocar em `usuarios`;
- `membroJaNaGrade`: evita duplicar a mesma pessoa na grade;
- `agruparGradePorPeriodo`: agrupa por `turnoPadrao` na ordem fixa
  Madrugada → Manhã → Tarde → Noite; qualquer outro código aparece depois,
  em ordem alfabética — nunca quebra a ordem dos quatro primeiros.

Módulo sem SDK do Firestore e sem qualquer leitura/escrita em `usuarios` —
um teste de fronteira garante isso, deixando explícito que remover da grade
**não é** excluir o usuário do sistema.

### `lib/firebase/writeRepository.ts`

- `adicionarMembroRascunho(documento)`: `setDoc` em `rascunhosTurnosMes`
  para um único colaborador; recusa qualquer `documento.status !==
  'RASCUNHO'`. Reaproveita o `excluirRascunho()` já existente (Fase 3K-D2)
  para a remoção — nenhuma Firestore Rule nova foi necessária, porque
  `rascunhosTurnosMes` já permite `create`/`update`/`delete` ao gestor da
  própria equipe.

### Dashboard — tela Grade

- botão **Adicionar colaborador**: abre modal para escolher um usuário
  cadastrado (só lista quem ainda não está na grade) e o turno/período
  base; ao confirmar, cria o membro em branco e persiste imediatamente
  (mesmo padrão de "ação imediata" usado na Fase 3K-D2 para não deixar o
  Firestore e a tela dessincronizados);
- botão **Remover** por linha (ícone ao lado do nome): abre confirmação
  explicando que é uma ação local à competência e que o cadastro do usuário
  não é afetado; chama `excluirRascunho`, que já recusa remover documentos
  `PUBLICADA` — se a escala atual já estiver publicada, a remoção falha com
  mensagem clara em vez de apagar algo publicado;
  esse é o limite: **remover da grade só funciona em rascunho**, tirar
  alguém de uma escala já publicada exige reabrir como rascunho e publicar
  de novo — decisão deliberada para não violar "não apagar escala publicada
  sem confirmação" nem inventar um novo tipo de escrita administrativa;
- badge **Rascunho não publicado / Revisão publicada** no cabeçalho da
  tela, para deixar claro o estado atual;
- `ScheduleGrid` passou a agrupar por período (`agruparPorPeriodo`),
  mostrando um separador de seção colorido pelo token do período antes de
  cada grupo, e a primeira coluna herda a cor do período do colaborador.

### `components/ScheduleGrid.tsx`

- cabeçalho de data em duas linhas (`SEG` / `03/08`), via `formatarData` do
  pacote `contrato` (mesma função já usada no App, elimina o cálculo manual
  anterior);
- suporte a `onRemover` (mostra um botão por linha) e `agruparPorPeriodo`
  (separadores de seção), ambos opcionais — a tela de importação
  (`compacta`) continua sem eles, sem mudança de comportamento;
- correções de layout: `.sticky-name` com `max-width` (antes só tinha
  `min-width`, podia esticar demais), `min-width:0` nos containers flex
  internos, cabeçalho com `white-space:nowrap` e `overflow:hidden`.

### Robustez geral de layout

- `.edit-modal`: `max-height: min(88vh, 780px)` + `overflow-y:auto` — todo
  modal do Dashboard agora rola internamente em vez de vazar da tela;
- `.modal-backdrop`: `overflow-y:auto` como reforço;
- `.toolbar`: `flex-wrap:wrap`; campos passaram de `min-width` fixo para
  `width` + `max-width:100%`, então encolhem em vez de vazar;
- `.login-field-input`/`.alias-editor-add input`: `min-width:0` explícito
  (armadilha clássica de flexbox — sem isso, um input dentro de um flex
  container não encolhe abaixo do seu conteúdo intrínseco).

Sem captura de tela específica do problema relatado, priorizei as causas
mais prováveis e verificáveis (modal sem limite de altura, toolbar sem
quebra, `min-width` implícito do flexbox). Se algum ponto específico
continuar estranho, uma captura de tela ajuda a apontar exatamente onde.

## O que foi implementado — cores por período (pedido à parte, mesma sessão)

Criei tokens `--periodo-{md,m,t,n,x,df,du,bh}-{bg,border,text,icon}` em
`app/globals.css` (claro e escuro), aplicados via seletor de atributo
`[data-code="X"] { --periodo-bg: ...; }` — como propriedades customizadas
herdam por qualquer descendente, um único `data-code` no elemento-pai já
colore chip, ícone e texto dos filhos, sem repetir por componente.

- `.shift-chip[data-code]` ficou **igual** no Dashboard e no App (antes
  eram duas paletas quase idênticas, uma delas com o roxo antigo de
  Madrugada) — unificação that elimina duplicação e mantém consistência
  entre os dois produtos, como pedido;
- "Seu turno hoje", "Próximo turno", o ícone da agenda/turno seguinte,
  "dia selecionado" e os ícones da lista de agenda agora usam a cor do
  período em vez de uma cor institucional fixa;
- preservei a codificação de cor por turno já existente nos `shift-chip`
  específicos do App (Fase 3J-A) — são o mesmo mecanismo, só que agora
  peco a partir do token único em vez de hex duplicado;
- índigo/roxo só aparece para Madrugada (`--periodo-md-*`), como semântica
  do período — a identidade institucional (botão, foco, badges, sidebar)
  continua azul (`--primary`/`--cyan`, já ajustados em fase anterior);
- corrigi dois roxos residuais que passaram despercebidos na fase anterior:
  o gradiente e o glow decorativo do `.login-showcase` ainda usavam hex
  antigo (`#22164a`, `rgba(124,92,252,...)`).
- logo/ícone institucional: fundo transparente no tema claro (só a borda
  suave), superfície azul translúcida discreta no escuro, hover com tingido
  azul muito claro — corrigido tanto na sidebar quanto no login.

## O que foi implementado — login mobile (pedido à parte, mesma sessão)

Redesenho completo do mobile a partir de uma referência visual enviada:
tela cheia com gradiente azul (`#0B1220 → #172554 → #1D4ED8`), logo
centralizado no topo (sem nenhum texto institucional embaixo — a versão
anterior desta mesma sessão ainda tinha uma linha de subtítulo), card
branco **sempre claro** (mesmo com o app em tema escuro, via variáveis
sobrescritas localmente em `.login-card`) centralizado no espaço restante
da tela via `flex:1` — nunca mais "caído" no fim. Inputs com ícone
(envelope/cadeado) e alternância mostrar/ocultar senha. O banner de
instalação do PWA sobe de posição enquanto a tela de login estiver montada
(`.login-page ~ .pwa-messages`), sem tocar em `PwaProvider.tsx`.

## Arquivos criados

- `lib/gradeMembros.ts` + `lib/gradeMembros.test.ts`

## Arquivos alterados

- `lib/firebase/writeRepository.ts` — `adicionarMembroRascunho`
- `components/ScheduleGrid.tsx` — agrupamento, cabeçalho, remoção, robustez
- `apps/dashboard/src/DashboardApp.tsx` — fluxo adicionar/remover, badge de
  status, dois modais novos
- `components/LoginPanel.tsx` — inputs com ícone, alternância de senha,
  remoção do texto institucional mobile
- `components/BrandMark.tsx` — sem alteração de código (só CSS)
- `app/globals.css` — tokens de período, unificação de chip, robustez de
  layout, redesenho do login mobile, correção do logo institucional
- `tests/app-boundaries.test.mjs` — 2 testes novos, 1 assert desatualizado
  substituído (a paleta duplicada do App em `shift-chip[data-code="MD"]`
  não existe mais)

## Firestore Rules

**Não alteradas nesta fase.** O fluxo de adicionar/remover membro da grade
usa exclusivamente `rascunhosTurnosMes`, cujas regras (Fase 3K-C) já
permitem `create`/`update`/`delete` ao gestor da própria equipe.

## Validação automatizada

Executado em 5 de agosto de 2026:

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run typecheck:apps` | ✅ Dashboard + App |
| `npm run test:unit` | ✅ 116 testes (9 novos: `gradeMembros`) |
| `npm run test:boundaries` | ✅ 34 testes (2 novos, 1 assert substituído) |
| `npm run firebase:staging:preflight` | ✅ `escala-ici-staging` |
| `npm run build:app:pages` | ✅ |
| `npm run build:dashboard` | ✅ |
| `npm run validate:deployments` | ✅ |
| `npm run validate:pwa` | ✅ |
| `npm run lint` | ✅ |

`npm run test:firestore-rules` não foi executado nesta fase porque as
regras não mudaram (confirmado via `git status --short firestore.rules`:
sem diferenças desde a Fase 3K-D2).

## Testes manuais recomendados

1. Dashboard → **Usuários** → cadastrar um colaborador novo;
2. **Grade** → **Adicionar colaborador** → selecionar o colaborador novo e
   um período → confirmar → ele aparece no grupo certo, sem dias
   preenchidos;
3. clicar em uma célula do colaborador novo e preencher alguns dias;
4. **Remover** um colaborador de um grupo diferente → confirmar → ele some
   da grade, mas continua em **Usuários**;
5. confirmar visualmente: grupos na ordem Madrugada/Manhã/Tarde/Noite,
   cabeçalho de data em duas linhas (`SEG` / `03/08`), coluna de nome
   tingida pela cor do período;
6. abrir um modal de edição de usuário (com vários aliases) numa tela baixa
   e confirmar que ele rola internamente em vez de vazar;
7. login mobile: confirmar card centralizado, tema claro e escuro, PWA
   instalado, banner de instalação não cobrindo os botões.

## Pendências

- Sem captura de tela do problema visual original relatado — corrigi as
  causas mais prováveis (modal sem altura máxima, toolbar sem quebra,
  `min-width` de flexbox); se algo específico persistir, uma captura ajuda
  a mirar exatamente o elemento;
- remover da grade só funciona em rascunho (por decisão, ver acima);
- arquivamento de escala publicada e exclusão física de usuário continuam
  fora do escopo (Fase 3K-D2);
- troca de escala continua só como contrato/validações puras (Fase
  3K-D1/D2), sem tela nem escrita.

## Riscos

- `adicionarMembroRascunho`/remoção via `excluirRascunho` são ações
  imediatas (persistem antes de "Salvar alterações"), igual ao padrão já
  usado na Fase 3K-D2 para usuários — mantém Firestore e tela sempre
  sincronizados, mas significa que "Cancelar" no modal de adicionar não
  desfaz nada porque a escrita só ocorre ao confirmar (comportamento
  esperado, não um bug);
- nenhuma alteração em produção; nenhum `.env` tocado; nenhum secret
  commitado; todos os arquivos novos em LF.
