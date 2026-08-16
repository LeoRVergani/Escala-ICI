# Checkpoint — Fase PLANTÃO-2 (preview no Dashboard + conciliação nome→login)

Data: 2026-08-16. Escopo: experiência de importação segura de Plantão no
Dashboard — detecção automática 6x1/Plantão/desconhecida, preview em
memória, conciliação obrigatória de cada nome do XLS para um login real.
**Nenhuma persistência de Plantão. Nenhuma alteração em Firestore/Rules/
writeRepository/Auth/Push. Nenhuma alteração de comportamento da escala
6x1.** Detalhe técnico completo em `docs/spec/PLANTOES.md`, seção 19 —
este documento resume o que foi feito e registra baseline/testes/riscos.

## Baseline (precheck)

```
pwd                              /home/vergani/projetos/Escala-ICI
git branch --show-current        main
git status --short               (vazio, exceto .sites-runtime gitignored)
git fetch origin                 ok
git status --branch --short      ## main...origin/main [ahead 2]
git rev-parse HEAD                03e9f9408474917a7395fe877bdf132bef594f92
git rev-parse origin/main         0c119e17f67ebf012d0b9fde398ac6199162190e
```

`ahead 2` confirmado como esperado (Fases PLANTÃO-0 e PLANTÃO-1). Nenhum
avanço remoto inesperado. Working tree limpa no início.

## Fluxo do importador

Ponto único de entrada continua sendo o mesmo dropzone/input da tela
"Importar escala" (`receberArquivo`). Agora ele chama
`processarArquivoImportado(buffer, opcoes6x1)`
(`lib/importadorPlanilha.ts`, novo, puro), que usa `detectarTipoPlanilha`
do pacote `@escala-ici/contrato` e delega:

```
XLS selecionado
      │
detectarTipoPlanilha()
   ┌──┴───────────┬──────────────┐
ESCALA_6X1      PLANTAO      DESCONHECIDA
   │                │               │
interpretar()   interpretarPlantao() mensagem de erro,
(inalterada)    (novo — preview)     nenhum parser tentado
```

- **ESCALA_6X1**: zero mudança de comportamento — `interpretar()` é a
  mesma função de antes, corpo idêntico. Confirmado por diff (nenhuma
  linha dela foi tocada) e por teste (`parsePlanilhaEscala` sobre a
  fixture 6x1 real continua `ok:true`, 9 documentos).
- **PLANTAO**: `interpretarPlantao()` popula `resultadoPlantao` e o
  estado inicial de vínculos — nunca escreve nada.
- **DESCONHECIDA**: mensagem explícita ("Estrutura de planilha não
  reconhecida... formatos suportados: escala 6x1/Plantão"); nenhum dos
  dois parsers é chamado "na sorte".

## Arquitetura da conciliação

`lib/conciliacaoPlantoes.ts` (novo, puro — sem SDK do Firestore, sem
React). Peça central: `VinculoPlantao { participanteNomeOriginal; login:
string | null; status; sugestao }`. Fluxo:

1. `consolidarParticipantesPlantao(resultado)` une nomes das atribuições
   brutas com a contabilidade informada.
2. `iniciarVinculosPlantao(participantes, usuarios)` cria o estado
   inicial — **nunca** com `login` preenchido, mesmo em correspondência
   exata de nome (só vira `sugestao`).
3. `confirmarVinculoPlantao(vinculos, nome, usuario)` — única forma de um
   vínculo ganhar `login`; recebe o `Usuario` inteiro, nunca uma string
   solta, e o valor gravado é sempre `usuario.login`.
4. `desfazerVinculoPlantao` reverte.
5. `recalcularConflitosPlantao` (interno) roda a cada mudança — dois
   participantes no mesmo login viram `CONFLITO` até um ser desfeito.
6. `aplicarVinculosNasAtribuicoes` propaga o vínculo confirmado para
   **todas** as atribuições do mesmo plantonista de uma vez.

Deliberadamente mais estrita que `lib/conciliacaoUsuarios.ts` (6x1): lá
uma correspondência única de nome já vincula sozinha; aqui não — o máximo
automático é uma sugestão clicável, nunca uma vinculação silenciosa.

## Regra nome → login

Identidade gravada é sempre `login` (chave de `usuarios/{login}`), nunca
UID do Firebase Authentication, nunca e-mail, nunca índice de linha —
garantido estruturalmente: `confirmarVinculoPlantao` só aceita um
`Usuario` real como parâmetro, e o campo que ele preenche é
`usuario.login`. Testado explicitamente (`VinculoPlantao` só tem as
chaves `participanteNomeOriginal`/`login`/`status`/`sugestao` — sem
`uid`).

## Comportamento de sugestões

Uma correspondência única de nome normalizado entre o participante do XLS
e um usuário cadastrado aparece como `sugestao: { login, nome }` — visível
na UI como um botão "Sugestão: {nome}" clicável, mas o vínculo **não** é
aplicado até o coordenador clicar. Zero correspondências: `sugestao: null`
e `status: 'USUARIO_NAO_ENCONTRADO'` (não bloqueante — o coordenador ainda
pode buscar e escolher manualmente qualquer usuário). Mais de uma
correspondência: `sugestao: null` (ambíguo demais para sugerir uma única
pessoa).

## Login inexistente / usuário não encontrado

Quando nenhum usuário casa por nome, o participante fica
`USUARIO_NAO_ENCONTRADO` — a UI mostra a busca normalmente (o coordenador
pode digitar e encontrar por outro critério, ex.: login) e um atalho
"Ir para Usuários" (reaproveita a tela existente de cadastro, sem duplicar
formulário). Nenhum cadastro automático é criado.

## Participante com 0 plantões

Preservado — `consolidarParticipantesPlantao` inclui qualquer nome
presente na seção de contabilidade informada mesmo com
`quantidadeInformada: 0`/`minutosInformados: 0`; testado explicitamente
(`Daniela Rocha`, fixture da PLANTÃO-1) e visível na aba Contabilidade e
na aba Vínculos ("Consta na contabilidade informada (0 plantões)").

## Divergência 504h vs. 468h

Continua **não reconciliada** — o resumo mostra os dois números lado a
lado ("Duração bruta dos intervalos: 504:00" / "Horas informadas no
relatório: 468:00"), e quando divergem aparece um painel de aviso
("Divergência de conferência... nenhum valor foi corrigido
automaticamente"). Nenhuma função altera nenhum dos dois valores para
forçar coincidência — a conciliação de login é inteiramente independente
dessa contabilidade (não lê nem escreve `contabilidadeInformada`/
`totalBrutoCalculado`).

## Limites desta fase / ausência de persistência

- Botão final é **"Validar prévia"**, nunca "Publicar"/"Salvar escala" —
  ao clicar, só muda um estado local (`previaPlantaoValidada`) e mostra a
  mensagem "Prévia validada. Nenhum dado de Plantão foi publicado nesta
  fase." Não chama `salvarRascunho`, `publicarEscalas`, nenhuma escrita.
- Nenhuma coleção nova, nenhuma Rule nova — `firestore.rules` e
  `lib/firebase/writeRepository.ts` seguem sem qualquer menção a Plantão
  (testado).
- Contatos telefônicos, Central de Plantões, calendário completo, nova
  escala/rotação, overrides/trocas — nada disso foi tocado, como previsto.

## Achado durante a implementação (e correção)

O Dashboard já tinha um `useEffect` que recarrega a escala de
demonstração automaticamente sempre que `resultado` fica `null` (modo
demo). Como o fluxo de Plantão zera `resultado` de propósito (para não
misturar com o preview 6x1), esse efeito recarregava a demonstração por
baixo do preview de Plantão, fazendo o grid 6x1 aparecer simultaneamente
com o preview de Plantão na mesma tela. Corrigido com um único guard
(`tipoArquivoDetectado !== 'PLANTAO'`) ao redor de todo o bloco de preview
6x1 antigo (erros/avisos/conciliação 6x1/grade/legenda) — nem o efeito nem
o fluxo 6x1 em si foram alterados. `carregarDemo()` também passou a
resetar explicitamente o estado de Plantão (`tipoArquivoDetectado`,
`resultadoPlantao`, `vinculosPlantao`) para o mesmo cenário não se repetir
ao clicar "Carregar exemplo" depois de importar um Plantão.

## Cascade/CSS (duas correções, mesma disciplina de PLANTÃO-0)

- `.plantao-resumo-grid`: `.import-summary` tem `grid-template-columns:
  repeat(3, 1fr)`, mas o resumo de Plantão tem 4 indicadores. Em vez de
  reescrever a classe compartilhada com o preview 6x1, o card de Plantão
  usa as duas classes juntas (`import-summary plantao-resumo-grid`) e só
  a coluna é redefinida, nos mesmos dois breakpoints (1180px/780px) já
  usados por `.import-summary` — border/tipografia continuam vindo dela.
- `.plantao-busca-linha`: `.search-control` só recebe borda/fundo/padding
  quando é descendente de `.toolbar` (`.toolbar label`) — usá-la sozinha
  dentro de uma célula de tabela renderizaria sem nenhum estilo. Criada
  uma classe própria, com os mesmos tokens (`--border`/`--surface`), para
  o contexto de célula de tabela — `.search-control` não foi alterada.

## Arquivos criados

- `lib/importadorPlanilha.ts` / `lib/importadorPlanilha.test.ts`
- `lib/conciliacaoPlantoes.ts` / `lib/conciliacaoPlantoes.test.ts`
- `tests/plantao-preview-boundaries.test.mjs`
- `CHECKPOINT-FASE-PLANTAO-2-PREVIEW-CONCILIACAO.md`

## Arquivos alterados

- `apps/dashboard/src/DashboardApp.tsx` — roteamento no `receberArquivo`,
  novo componente `PreviewPlantao`, novo estado/handlers de Plantão, guard
  de isolamento do preview 6x1 antigo, reset em `carregarDemo`.
- `app/globals.css` — `.plantao-resumo-grid`, `.plantao-busca-linha`,
  `.plantao-vinculo-celula`, `.plantao-busca-resultados`,
  `.plantao-conflito-aviso`, `.plantao-validado-nota`.
- `package.json` — `test:boundaries` passou a incluir
  `tests/plantao-preview-boundaries.test.mjs`.
- `docs/spec/PLANTOES.md` — seção 19 nova, além de ajustes pontuais nas
  seções 15/17/título/intro para refletir o que já foi implementado.

Nenhum outro arquivo foi alterado. `packages/contrato/src/parser.ts`,
`packages/contrato/src/parserPlantao.ts`, `firestore.rules`,
`lib/firebase/writeRepository.ts` seguem com diff zero nesta fase.

## Testes

24 testes novos:

- `lib/conciliacaoPlantoes.test.ts` — **21 testes**, cobrindo os 16 itens
  pedidos (consolidação de nomes repetidos, participante só na
  contabilidade, zero plantões preservado, nome original preservado,
  sugestão sem vínculo automático, login sempre de um `Usuario` real,
  usuário inexistente vira pendente informativo, UID nunca usado,
  conflito de login duplicado + resolução ao desfazer, prévia validável
  só com tudo vinculado, propagação de vínculo a todas as atribuições,
  32/504h/468h inalterados pela conciliação) mais testes de
  `buscarUsuariosPlantao`.
- `lib/importadorPlanilha.test.ts` — **3 testes** (roteamento 6x1/
  Plantão/desconhecida com as fixtures reais das Fases PLANTÃO-0/1).
- `tests/plantao-preview-boundaries.test.mjs` — **5 testes** de
  fronteira, registrados em `test:boundaries`: módulos puros de Plantão
  sem escrita administrativa; sem catálogo/regras 6x1; parser isolado
  (PLANTÃO-1) continua sem catálogo/regras 6x1; `writeRepository.ts`/
  `firestore.rules` sem menção a Plantão; Dashboard roteando pelos
  módulos puros.

Resultados finais:

```
npm run typecheck          OK
npm run typecheck:apps     OK (dashboard + app-web)
npm run typecheck:worker   OK (push-worker)
npm run test:unit          573/573 passou (45 arquivos) — era 549, +24 novos
npm run test:boundaries    107/107 passou (era 102, +5 novos)
npm run lint               0 erros, 5 warnings pré-existentes
                            (mesmos 2 arquivos de teste não tocados nesta
                            fase: lib/firebase/authRepository.test.ts,
                            lib/firebase/lembretesRepository.test.ts)
npm run build:app:pages    OK
npm run validate:pwa       OK
npm run validate:artifact  OK
npm run build:dashboard    OK (extra, não exigido pela baseline, mas o
                            Dashboard foi o alvo principal desta fase)
git diff --check           limpo
```

## Validação visual

**Auditoria estática, não inspeção real de navegador/DevTools** — este
ambiente não tem browser disponível para abrir o Dashboard e testar a
fixture ao vivo, exatamente como nas fases anteriores. A revisão acima
(cascade de `.plantao-resumo-grid`/`.plantao-busca-linha`, containment de
overflow via `.table-scroll` já existente, tokens de tema já usados em
todo o CSS novo — nenhuma cor hardcoded) foi feita lendo JSX/CSS, não
abrindo o navegador. Isso é declarado explicitamente, como pede
`docs/spec/UI_CASCADE_E_HERANCA.md`.

A validação visual real (abrir o Dashboard, importar a fixture sanitizada,
conferir light/dark e as larguras 360/390/412/tablet/desktop) fica a
cargo do usuário, como de costume neste projeto.

## Confirmações de escopo

- Nenhum dado de Plantão foi persistido — só prévia validada em memória.
- `firestore.rules`/`lib/firebase/writeRepository.ts` sem qualquer menção
  a Plantão (testado).
- Nenhum cargo/perfil novo foi criado para gatear a importação — o
  preview de Plantão herda a mesma proteção que a tela "Importar escala"
  já tinha para 6x1.
- Parser 6x1/catálogo SOC/regras 6x1 (`lib/alertasEscala.ts`) não são
  usados por nenhum módulo de Plantão (testado).
- Zero PII real: busca automatizada pelos 4 nomes reais confirma zero
  ocorrências em qualquer arquivo novo/alterado desta fase.

## Riscos conhecidos

- Busca de usuário reaproveita `<select>` (mesmo padrão da conciliação
  6x1) em vez de um combobox de busca ao vivo — aceitável para o tamanho
  de equipe atual, pode precisar evoluir com equipes muito maiores.
  Documentado em `docs/spec/PLANTOES.md`, seção 17.
- Sugestão automática não se atualiza sozinha se um usuário for
  cadastrado depois da importação (a busca manual funciona normalmente).
- Decodificação de célula de data/hora puramente numérica sem formatação
  (`.w` ausente) continua não implementada (herdado da PLANTÃO-1).

## Próxima fase prevista

PLANTÃO-3 — persistência real: coleções de Grupo de Plantão/Turno de
Plantão/Contato, Firestore Rules, e a regra "não publica com plantonista
sem login conciliado" ganhando um estado real de publicação (hoje só
existe como `previaPlantaoValidavel` em memória).

## Git

Commit local criado (mensagem `feat(plantao): adiciona preview e
conciliacao de usuarios`). **Nenhum push. Nenhum deploy. Nenhuma
persistência de Plantão. Firebase não foi alterado. Produção não foi
tocada.**
