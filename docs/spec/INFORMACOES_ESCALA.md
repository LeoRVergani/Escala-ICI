# Especificação — Informações da Escala (dia/pessoa-dia)

Fase FASE-MATRIZ-DEFINITIVA-E-INFORMACOES-DIA-1, Parte B — status desta
entrega: **B1 concluída** (domínio, persistência, Rules). B2 (Dashboard),
B3 (App) e B4 (importação assistida da planilha) ainda não implementadas.

## 1. Por que isto existe

A planilha real carrega anotações soltas fora da grade de turnos:
"Feriado", "SOC durante o treinamento", "DU - alamancio",
"férias - cestradioto". Hoje isso não tem lugar estruturado na Escala
ICI — vira texto perdido ou comentário informal.

Este domínio dá nome e identidade estável a essas anotações, sem:

- criar uma nova opção principal "Observações" na sidebar (informação
  pertence à Escala: `Escalas → SOC → Setembro → Grade → Dia/pessoa →
  Informações`, nunca uma tela paralela);
- duplicar a nota dentro de cada `TurnosMes.dias` (isso multiplicaria o
  mesmo dado por pessoa/dia e tornaria a edição inconsistente);
- inventar uma segunda ACL paralela à Matriz (`ESCOPO_OPERACIONAL_MATRIZ.md`)
  — quem escreve aqui é exatamente quem já administra a Jornada/Plantão.

## 2. Dois escopos, nunca misturados no mesmo item

- **DIA**: pertence à data/operação inteira. `usuarioLogin` é sempre
  `null`. Exemplos: Feriado, Treinamento SOC, Reunião, Operação especial.
- **PESSOA_DIA**: pertence a uma pessoa específica naquela data.
  `usuarioLogin` é sempre um login não vazio. Exemplos: Férias — Carlos,
  DU — Alamancio, Curso individual.

Identidade nunca é o texto do título — é sempre `infoId` (gerado por
`gerarUuid()`), localizado por `tipoEscala` + `alvoId` + `competencia` (+
`usuarioLogin` quando PESSOA_DIA).

## 3. Modelo de dados

Domínio puro em `lib/informacoesEscala.ts` (sem React/DOM/Firebase, mesmo
espírito de `lib/lembretes.ts`). Tipo `InformacaoEscala`:

```
schemaVersion: 1
infoId: string
tipoEscala: 'JORNADA' | 'PLANTAO'
alvoId: string                  // Equipe.id para JORNADA, GrupoPlantao.grupoId para PLANTAO
competencia: string              // AAAA-MM
data: string                     // AAAA-MM-DD, dia civil real
escopo: 'DIA' | 'PESSOA_DIA'
usuarioLogin: string | null       // null <=> escopo == 'DIA'
categoria: 'GERAL' | 'TREINAMENTO' | 'FERIADO' | 'FERIAS' | 'COBERTURA_DU'
         | 'CURSO' | 'REUNIAO' | 'OPERACAO_ESPECIAL' | 'OUTRO'
titulo: string
descricao: string | null
visibilidade: 'EQUIPE' | 'PESSOAS_AFETADAS' | 'GESTORES'
status: 'RASCUNHO' | 'PUBLICADA' | 'CANCELADA'
criadoPorLogin: string
criadoEm: string                 // ISO, nunca Timestamp/serverTimestamp()
atualizadoPorLogin: string
atualizadoEm: string
publicadoPorLogin: string | null
publicadoEm: string | null
canceladoPorLogin: string | null
canceladoEm: string | null
motivoCancelamento: string | null
```

Todos os campos opcionais são sempre gravados (como `null` quando não se
aplicam) — nunca omitidos —, então tanto a Rule (`hasOnly` com lista fechada)
quanto o mapper defensivo do repository trabalham com um schema estável.

### Sobre `competencia`/`data`

`validarEntradaInformacaoEscala()` valida, nesta ordem:

1. `competencia` no formato `AAAA-MM`;
2. `data` como dia civil real (`validarDataCivil`, reaproveitado de
   `lib/lembretes.ts`);
3. **`data` pertence ao período real da competência** (26→25, rótulo
   `AAAA-MM` sempre igual ao mês em que o período termina) — só checado
   quando os dois formatos acima já são válidos, reaproveitando
   `dataPertenceCompetencia()`/`periodoDaCompetencia()` de
   `lib/montagemRascunhoPlantao.ts` (**nenhum segundo cálculo 26→25** —
   ver dívida técnica abaixo sobre o nome do arquivo).

Exemplo: competência `2026-09` cobre `2026-08-26` até `2026-09-25`. `2026-08-25`
e `2026-09-26` são rejeitados; `2026-08-26` e `2026-09-25` (as bordas) são
aceitos. Vira-ano funciona pela mesma aritmética: competência `2027-01` cobre
`2026-12-26` até `2027-01-25`.

`criarInformacaoEscalaRascunho()`/`atualizarInformacaoEscala()`
(repository) sempre passam pela validação de domínio antes de qualquer
`setDoc`/`updateDoc` — nunca confiam só na futura UI para barrar uma data
fora do período.

**Por que a Rule não repete esse cálculo**: a aritmética 26→25 (mês/ano
anterior, dias variáveis por mês, bissexto) é seguramente expressável em
CEL, mas frágil de manter em dois lugares — qualquer ajuste futuro na regra
teria que ser replicado nas Rules manualmente, sem o tipo-checker/testes do
TS para pegar divergência. A proteção primária desse invariante fica no
domínio/repository (client autorizado); a Rule continua responsável por
tipos, status, campos permitidos, imutabilidade, transições e autorização —
nunca por cálculo de calendário.

**Dívida técnica registrada**: `periodoDaCompetencia()`/
`dataPertenceCompetencia()` vivem em `lib/montagemRascunhoPlantao.ts`, um
arquivo com nome específico de Plantão, embora a regra 26→25 seja universal
(Jornada e Plantão compartilham a mesma competência operacional). Não
extraídas para um módulo neutro nesta fase porque
`tests/plantao-limites-competencia-boundaries.test.mjs` prende a
implementação, por regex, ao texto-fonte exato desse arquivo — extrair
exigiria reescrever esse boundary test, escopo maior do que esta correção
pediu. Reaproveitadas como estão, import direto de `lib/informacoesEscala.ts`.

## 4. Estrutura Firestore

```
informacoesEscala/{contextoId}/itens/{infoId}
```

`contextoId = criarIdContextoInformacoesEscala(tipoEscala, alvoId, competencia)`
— concatenação simples (`${tipoEscala}_${alvoId}_${competencia}`), mesmo
padrão de `criarIdEscopoOperacional()` (`lib/escoposOperacionaisMatriz.ts`).
A Rule usa a mesma concatenação, sem sanitizar; o `.replace()` do lado
cliente é só rede de segurança defensiva.

### Por que subcoleção, e não coleção top-level

Considerado e descartado: uma coleção `informacoesEscala/{infoId}` plana
(como `lembretesAtribuidos`), filtrando por `tipoEscala`/`alvoId`/
`competencia` em toda query. Escolhida a subcoleção porque:

- "todas as informações da operação/competência" (Dashboard, uso
  administrativo) vira uma leitura da subcoleção inteira, sem nenhum
  `where()` — mais simples e mais barato que filtrar uma coleção global;
- o agrupamento por path é auto-explicativo para quem inspeciona o banco
  (útil em diagnóstico, como o incidente da Parte A mostrou ser valioso);
- cada item ainda guarda `tipoEscala`/`alvoId` como campos próprios — não
  para autorização adicional (a Rule usa só `podeAdministrarJornada()`/
  `podeAdministrarEscalaPlantao()`), mas porque a Rule de `list` só aprova
  uma consulta cujos `where()` já bastam, sozinhos, para provar a condição,
  sem olhar documento por documento (mesma lição de
  `listarLembretesAtribuidosDoGestor()`, `lembretesRepository.ts`) — por
  isso toda query do repository inclui `where('tipoEscala', '==', ...)` e
  `where('alvoId', '==', ...)` mesmo já estando dentro do path certo.

Nenhuma query implementada nesta fase precisa de `orderBy` combinado com
range em campo diferente das igualdades — só filtros de igualdade, então
nenhum índice composto novo em `firestore.indexes.json` foi necessário.

## 5. Rules

`firestore.rules`, coleção `informacoesEscala/{contextoId}/itens/{infoId}`:

- **Nenhuma ACL paralela.** Escrita reaproveita 100%
  `podeAdministrarJornada(alvoId)` (JORNADA) e
  `podeAdministrarEscalaPlantao(alvoId)` (PLANTAO) — as mesmas funções que
  já governam a Jornada/Plantão em si.
- **Leitura**: administrador da operação sempre lê (qualquer
  status/visibilidade — precisa ver RASCUNHO e itens privados para
  gerenciar). Fora disso, só `PUBLICADA`, e conforme `visibilidade`:
  - `EQUIPE`: quem tem acesso de consulta à operação
    (`podeOperarNaEquipe()` para Jornada, `podeLerEscalaPlantao()` para
    Plantão);
  - `PESSOAS_AFETADAS`: só `usuarioLogin == loginDoAuth()`;
  - `GESTORES`: nunca fora do primeiro ramo (administrador) — o App do
    analista nunca lê isto.
- **Identidade imutável para sempre**: `tipoEscala`/`alvoId`/`competencia`/
  `data`/`escopo`/`usuarioLogin`/`criadoPorLogin`/`criadoEm` nunca mudam
  depois de criados — nem enquanto `RASCUNHO`. Errou a data/pessoa/alvo de
  um rascunho? Cancela e cria de novo, nunca edita (mesmo modelo de
  correção de um item já publicado, seção 7).
- **Conteúdo mutável só enquanto RASCUNHO**: `categoria`/`titulo`/
  `descricao`/`visibilidade` só podem mudar num update que MANTÉM
  `status == 'RASCUNHO'`. **Uma vez `PUBLICADA`, o item é imutável por
  completo** — nenhum update pode alterar conteúdo, nem sequer um "no-op"
  (`PUBLICADA -> PUBLICADA` não tem branch nenhuma que aceite; é
  rejeitado categoricamente).
- **Transição de status**: só `RASCUNHO -> PUBLICADA`, `RASCUNHO ->
  CANCELADA`, ou `PUBLICADA -> CANCELADA`. `CANCELADA` é terminal (nenhuma
  transição sai dela). Toda transição preserva conteúdo intacto
  (`conteudoInformacaoEscalaPreservado()`) — publicar/cancelar nunca é
  aproveitado para também editar título/descrição/categoria/visibilidade
  na mesma escrita. Os campos `publicadoPorLogin`/`publicadoEm`/
  `canceladoPorLogin`/`canceladoEm` só podem ser preenchidos NA transição
  correspondente — qualquer outra escrita tem que preservar o valor
  anterior desses campos, nunca reescrevê-los. (Bug pego pelo próprio
  teste de Rules durante esta fase: a primeira versão exigia
  `publicadoPorLogin == loginDoAuth()` toda vez que `status ==
  'PUBLICADA'`, o que forjaria a autoria/data de publicação a cada edição
  de conteúdo subsequente — corrigido antes mesmo de existir uma segunda
  rodada de revisão, ao ligar os pontos entre "conteúdo mutável" e "campos
  de transição".)
- **Delete**: sempre `if false`, mesmo para `ADMIN_SISTEMA` — cancelamento
  (`status -> CANCELADA`) é a única forma de encerrar um item, preservando
  o documento e o histórico.

## 6. Repository

`lib/firebase/informacoesEscalaRepository.ts`:

- `criarInformacaoEscalaRascunho`, `atualizarInformacaoEscala`,
  `cancelarInformacaoEscala` — CRUD administrativo, sempre atrás de
  `exigirEscritaAdministrativaHabilitada()`. `atualizarInformacaoEscala()`
  lança se `informacaoAtual.status !== 'RASCUNHO'` — nunca tenta editar
  conteúdo de um item `PUBLICADA`/`CANCELADA` (a Rule bloquearia de
  qualquer forma; o repository falha antes, com mensagem clara, em vez de
  deixar a UI descobrir só pelo `permission-denied`).
- `publicarInformacoesDaCompetencia(tipoEscala, alvoId, competencia,
  publicadoPorLogin)` — serviço de publicação em lote (`writeBatch`
  atômico), promove todos os `RASCUNHO` da operação/competência para
  `PUBLICADA`. Antes de montar o batch, verifica
  `LIMITE_PUBLICACAO_EM_LOTE_INFORMACOES_ESCALA` (400 — folga sob o teto
  real de 500 operações/batch do Firestore) e lança erro claro se
  excedido, **sem publicar nenhum item** e **sem dividir silenciosamente
  em vários batches** (isso quebraria a garantia de atomicidade que a
  função promete). **Não é chamado automaticamente por nada nesta fase** —
  a Parte B2/B3 decide quando/onde acionar (ex.: junto do botão "Publicar"
  da Jornada/Plantão), para não acoplar prematuramente nem alterar o fluxo
  de publicação existente.
- `obterInformacaoEscala`, `listarInformacoesDaCompetencia`,
  `listarInformacoesDoDia`, `listarInformacoesDaPessoa` — leituras
  administrativas (Dashboard).
- `listarInformacoesPublicadasDaEquipe`,
  `listarInformacoesPublicadasDaPessoa` — leituras do App, sempre só
  `PUBLICADA`. Propositalmente duas funções separadas (nunca uma query
  única misturando `EQUIPE` e `PESSOAS_AFETADAS`) — juntar as duas
  exigiria a Rule provar um `OR` que a query não restringe, quebrando a
  prova de `list` (mesmo motivo de
  `listarLembretesAtribuidosDoGestor()`).
- Sem `observarInformacoes*` (realtime) nesta fase — B2/B3 acrescenta
  quando a UI precisar, espelhando os `listar*` acima (mesmo par
  `listar*`/`observar*` de `lembretesRepository.ts`).

## 7. Publicação e correção (comportamento, não só mecanismo)

- `RASCUNHO` nunca aparece no App, independentemente de visibilidade.
- `PUBLICADA` aparece conforme `visibilidade`, e é **imutável a partir
  daí** — conteúdo e identidade congelados para sempre (seção 5).
- `CANCELADA` nunca aparece como ativa (nem para o App, nem nas listagens
  "publicadas" do Dashboard) — mas o documento nunca é apagado, e seu
  conteúdo permanece idêntico ao da `PUBLICADA` que a originou (auditoria).
- Uma escala já publicada recebendo uma informação nova é tratada como
  revisão — nada publica silenciosamente uma informação nova só porque a
  Jornada/Plantão em si já está publicada. Quem decide "publicar agora as
  informações pendentes desta competência" é uma ação humana explícita
  (B2/B3), usando `publicarInformacoesDaCompetencia()`.

### Corrigir uma informação já publicada

Como `PUBLICADA` é imutável, a única forma de corrigir uma informação que
já foi disponibilizada é:

```
informação publicada incorreta
        ↓
cancelarInformacaoEscala(antiga, ...)      // PUBLICADA -> CANCELADA, preserva histórico
        ↓
criarInformacaoEscalaRascunho(nova, ...)   // novo infoId, RASCUNHO
        ↓
publicarInformacoesDaCompetencia(...)      // quando pronta
```

Nenhuma UI para esse fluxo nesta fase (B2/B3) — só a infraestrutura que o
suporta: `atualizarInformacaoEscala()` lança se o item não estiver mais
`RASCUNHO`, e a Rule nega qualquer update de conteúdo fora de
`RASCUNHO -> RASCUNHO`. Testado em `lib/firebase/informacoesEscalaRepository.test.ts`
("correção de informação já publicada — cancelar + recriar") e no Emulator
(`tests/firebase/firestore.rules.test.ts`, testes A–F).

## 8. O que a Parte B1 NÃO faz (por decisão, não por esquecimento)

- Nenhuma UI: sem drawer, sem indicador na grade, sem card no App, sem tela
  para o fluxo de correção "cancelar + recriar" (seção 7).
- Sem `observarInformacoes*` (realtime).
- Sem integração com a importação da planilha (Parte B4).
- Sem push/notificação (só arquitetura preparada: `criadoPorLogin`/
  `publicadoPorLogin` já identificam quem agiu, para uma notificação
  futura direcionada).
- Sem cálculo de calendário 26→25 nas Firestore Rules (deliberado — ver
  "Sobre `competencia`/`data`" na seção 3; reaproveita
  `dataPertenceCompetencia()` só no domínio/repository).
- Sem wiring automático no botão "Publicar" da Jornada/Plantão existente.

## 9. Testes

- `lib/informacoesEscala.test.ts` — domínio puro: validação de DIA/
  PESSOA_DIA, formato de competência/data, **data dentro do período 26→25
  da competência** (borda inicial, borda final, dia anterior/posterior à
  borda, virada de ano, competência já inválida não duplica o erro),
  transições de status, publicar/cancelar (incluindo rejeitar
  republicar/recancelar).
- `lib/firebase/informacoesEscalaRepository.test.ts` — persistência via
  fake Firestore em memória (mesmo padrão de `lembretesRepository.test.ts`):
  path da subcoleção, nunca grava `undefined`, publicação em lote,
  listagens filtradas, rejeita `data` fora do período antes de escrever,
  rejeita editar conteúdo fora de `RASCUNHO`, rejeita publicar acima do
  limite do lote sem publicar nenhuma, fluxo cancelar+recriar.
- `tests/firebase/firestore.rules.test.ts`, describe
  `'informacoesEscala — Rules (Parte B1)'` — Emulator real: responsável de
  Jornada/Plantão cria/atualiza/publica; consulta (`equipesConsulta`) e
  colaborador comum não escrevem; leitura por visibilidade (`EQUIPE`,
  `PESSOAS_AFETADAS`, `GESTORES`) incluindo negação para terceiros;
  `CANCELADA` some da query "Publicadas"; **`PUBLICADA -> PUBLICADA`
  mudando título/descrição/visibilidade é sempre negado, mesmo sem
  qualquer mudança de conteúdo**; `PUBLICADA -> CANCELADA` com metadados
  corretos é permitido e preserva conteúdo idêntico; `CANCELADA` nunca
  aceita nenhuma transição; imutabilidade de identidade (incluindo
  `data`) mesmo enquanto `RASCUNHO`; delete sempre negado mesmo para
  `ADMIN_SISTEMA`; forjar autoria em qualquer transição é negado.

## 10. Próximas fases

- **B2** — Dashboard: indicador no cabeçalho da data e na célula
  pessoa×dia, drawer "Informações do dia", modal de criação, resumo no
  cabeçalho do editor, chamada de `publicarInformacoesDaCompetencia()`
  integrada ao fluxo de publicação.
- **B3** — App: card "Informações para hoje" na tela Hoje, marcador na
  Agenda, detalhe do dia.
- **B4** — Importação assistida: detectar textos candidatos na planilha
  (ex.: "Feriado", "DU - alamancio") e oferecer confirmação explícita
  (data/categoria/pessoa) — nunca inferência silenciosa.
