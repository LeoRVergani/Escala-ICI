# Escala ICI — versões do Dashboard

A versão aparece no **rodapé do menu** (ex.: `Dashboard 1.5.0`; passe o mouse para ver a data e o commit do
build) e fica em `apps/dashboard/package.json` → `"version"`. Na VM, depois do deploy:
`curl -s http://127.0.0.1:4173/versao.json`.

Regra (versionamento semântico), a mesma do App (`CHANGELOG.md`):

- **MAIOR** (`2.0.0`) — mudança grande de etapa do produto.
- **MENOR** (`1.6.0`) — funcionalidade nova.
- **CORREÇÃO** (`1.5.1`) — ajuste ou correção, sem funcionalidade nova.

**Cada patch sobe o número do que ele muda:** mexeu no Dashboard → sobe o Dashboard; mexeu no App
(`apps/app`) ou em arquivo que o App também usa (`components/`, `lib/`, `app/globals.css` com efeito no App)
→ sobe o App; mexeu nos dois → sobe os dois. Um teste de fronteira confere que o número do `package.json` é o da
primeira seção deste arquivo (e do `CHANGELOG.md`, no caso do App).

## 1.15.0 — "Inverter escalas": trocar a escala de duas pessoas de uma vez (patch 0114)
- Novo botão **"Inverter escalas"** (ao lado de "Adicionar colaborador"): escolha as duas pessoas e o período — padrão **todo o período**, com atalhos **Natal** e **Ano Novo** — e cada
  dia uma passa a ter o que a outra tinha. Para quando alguém combina de trocar a folga ("já combinei com o Daniel, eu folgo no Natal") e o coordenador não precisa mais trocar célula por célula.
- A janela mostra a **prévia dia a dia** ("de → para" de cada pessoa) e confere as **regras** antes de aplicar: "Nenhum problema novo" (e quantos já existentes a troca resolve) ou a lista do que
  ela cria, com o botão **"Inverter mesmo assim"**. A cobertura dos turnos não muda (é uma permuta).
- Aplicar só altera o **rascunho**; nada é gravado até "Salvar alterações". **"Desfazer inversão"** volta ao que era, enquanto nada mais tiver sido editado.
- Guia: `docs/spec/INVERSAO_ESCALAS.md`.

## 1.14.0 — importar a escala de fim de ano (matriz "turno × data") em trecho (patch 0113)
- O Dashboard agora importa a **escala em matriz** usada no fim de ano: turnos nas linhas, datas nas colunas, **primeiros nomes** nas células. É reconhecida pela estrutura
  (não pelo nome do arquivo) e a tabelinha de totais ao lado é ignorada. Guia: `docs/spec/IMPORTADOR_MATRIZ_TURNOS.md`.
- **Importação em trecho:** só os dias da planilha são trocados; se já existe escala da competência (rascunho, senão a publicada), os outros dias de janeiro e as pessoas
  que não estão na matriz são **preservados**. Sem escala normal ainda, o Dashboard **avisa** que ela, ao chegar, apagaria o trecho se o arquivo não for reaplicado por cima.
  Se a escala existente não puder ser lida, **nada é importado**.
- **Folgas:** feriado (cabeçalho com "Feriado") → FOLGA; sábado e domingo → DF; dia útil → DU. O ano vem do título e é confirmado pelo dia da semana; vira de dezembro para janeiro.
- **Nomes:** o primeiro nome liga ao usuário **só quando é único entre os ativos da equipe**; dois "Carlos" viram conflito para você escolher.
- A **competência** é ajustada pelas datas da planilha (e avisada) quando a do assistente não comporta o trecho.
- A lista de pendências da revisão ganhou "Ver as N pendências restantes": os avisos além dos 4 primeiros ficavam **escondidos**.

## 1.13.4 — correção: a publicação da escala não funcionava para o GESTOR_UNIDADE sem equipe (patch 0112)
- **Causa (achada com a ferramenta de diagnóstico do 1.13.3):** publicar começa lendo os turnos já publicados **sem fixar o status**.
  A Regra de leitura de `turnosMes` é `status == 'PUBLICADA' || souGestor()`, e `souGestor()` só vale para GESTOR_EQUIPE, SUPERVISOR_EQUIPE e
  administrador — **GESTOR_UNIDADE fica de fora**. Para quem administra a Jornada só pela Matriz (como o coordenador do SOC, que não tem equipe
  própria) a consulta era negada (o Firestore chegava a estourar o limite de 1000 expressões) e a publicação parava **antes de gravar qualquer
  coisa**, com a mensagem enganosa "as regras de escrita ainda não reconhecem a matriz operacional". Todas as gravações da publicação já passavam.
- **Correção:** `publicarEscalas()` e `reverterPublicacao()` agora fixam `status == 'PUBLICADA'` na consulta — igual às consultas de exibição.
  O resultado é o mesmo (`turnosMes` só aceita escalas publicadas) e **as Regras não mudam** (não precisa republicar nada).
- A ferramenta de diagnóstico passou a testar a consulta como a publicação faz agora (mostrando a antiga como "informativo"), e a pedir
  `--equipe=` quando o usuário não tem equipe própria. Testes de Regras novos cobrem esse perfil.

## 1.13.3 — ferramenta de diagnóstico da publicação recusada e testes de Regras do lote (patch 0111)
- A mensagem "as regras de escrita ainda não reconhecem a matriz operacional" aparece para **qualquer** recusa na publicação e não diz
  qual gravação foi negada. Dois comandos novos respondem isso com os **dados reais do staging** e as **Regras de verdade**, sem gravar
  nada no staging: `npm run staging:diagnosticar:publicacao:exportar -- --login=<login>` (só leitura) e, dentro do emulador,
  `node scripts/staging/simular-publicacao.mjs --login=<login>` (mostra cada passo, a linha de `firestore.rules` que negou e um
  veredito). Guia: `docs/operacao/DIAGNOSTICO_PUBLICACAO.md`.
- Testes de Regras novos (`PUBLICACAO-LOTE-1`): a publicação **em lote** (9 colaboradores com `turnosMes`, `versoesEscala`, `eventosEscala`,
  histórico e estado) por responsável da Matriz e pela ACL histórica de gestor, a recusa para quem não é responsável e o lote inteiro
  caindo quando `publicadoPor` não é a conta logada (o que acontece ao publicar simulando outro gestor). Antes só havia testes de uma
  coleção por vez.
- Sem mudança de comportamento no Dashboard nem nas Regras (não precisa reconstruir nem republicar nada para usar a ferramenta).

## 1.13.2 — calendário do ponto: períodos do assistente, rascunhos e avisos seguem o ciclo novo (patch 0110)
- O período de uma competência (assistente de criar escala, prévia do calendário, rascunhos de Plantão, "usar período anterior")
  agora vem do **calendário do ponto** (comunicado do RH de 10/11/2026): regular **17 a 16**, dezembro **17/11 a 15/12**, janeiro
  **16/12 a 16/01**; até novembro de 2026, o ciclo antigo (26→25). A competência "atual" que o Dashboard sugere também.
- Os avisos que citavam "26→25" passam a mostrar o **período real** ("de 17/11 a 15/12"): o de competência ajustada na
  importação do Plantão e o de "a data não pertence ao período desta competência" das Informações da escala.
- Importar uma escala de Jornada continuava certo (o período vem das datas do arquivo); o que muda é tudo o que parte só do
  rótulo da competência. Períodos de 32 dias (janeiro) não esbarram em nenhum limite.
- Se você criou **antes de hoje** um rascunho de Plantão para 2026-12 (que teria nascido como 26/11–25/12), recrie-o.

## 1.13.1 — publicar enquanto simula outro gestor: aviso claro em vez de erro enganoso (patch 0109)
- Publicar uma escala grava `publicadoPor` com o usuário **efetivo**; as Regras exigem que seja a **conta logada de verdade**.
  Durante **"Simular gestor"** os dois divergem e o Firestore recusava, com a mensagem enganosa "As regras de escrita ainda não
  reconhecem a matriz operacional". Agora o Dashboard avisa antes, com o motivo: "Você está simulando …. Saia da simulação para
  publicar: a publicação é gravada em nome da sua conta real."
- Sem mudança para quem não está simulando (a mensagem antiga continua para as outras negações).

## 1.13.0 — "Nova informação": janela larga, em duas colunas, que cabe inteira na tela (patch 0108)
- A janela de **Nova informação** / **Editar informação** foi refeita: mais larga (até 980 px), em **duas colunas**. À esquerda,
  **Quem**: a lista de colaboradores fica sempre à vista, com a pessoa escolhida destacada, e logo abaixo a opção de **mostrar
  para o colaborador no App**. À direita, **O que aconteceu** (os 4 tipos em cartões numa linha, com ícone colorido),
  **Quando** (dia, "dura mais de um dia" e "dia todo / em um horário") e **Detalhes**. Sem caixas numeradas dentro de caixas.
- **Cabe inteira na tela, sem rolagem**: conferido em 1915×919, 1920×1080, 1440×900, 1536×864, 1366×768, 1280×720 e 1366×650,
  em todos os tipos e nos casos mais altos (vários dias + horário + aviso do CID). Em telas de até 880 px de altura ela fica um pouco
  mais compacta (ícone ao lado do nome, Título e Observações lado a lado).
- Os **erros aparecem no rodapé**, ao lado dos botões, sem fazer a janela crescer.
- No **celular** vira uma coluna só (Quem → O que aconteceu → Quando → Detalhes → visibilidade), com rolagem no corpo e o
  rodapé fixo.
- Só visual: o que a janela grava, as regras e as permissões não mudam.

## 1.12.2 — correção da publicação: TTL do Firestore removido (patch 0106)
- O `firestore.indexes.json` declarava limpeza automática (TTL) para `recados` e `recadosGrupo`. O TTL exige o plano pago do
  Firebase; no plano gratuito o deploy falhava com **HTTP 403 "billing disabled"** e parava **antes de liberar as Regras**.
  O TTL saiu; a limpeza dos recados vencidos agora é feita pelo worker (0.5.0) e ao abrir a tela.
- **Requer republicar as Rules e os índices** (`npm run firebase:staging:deploy`) e subir o worker novo.

## 1.12.1 — correção nas Regras: transferir colaborador de equipe voltava a ser negado (patch 0105)
- A checagem do cargo de liderança (patch 0099) ficava no começo da regra de atualização de `usuarios` e, em toda
  atualização que não é promoção — como **transferir alguém de equipe** —, gastava expressões do limite de 1000 do Firestore
  e a regra estourava ("maximum of 1000 expressions to evaluate"): a transferência seria **negada**. Agora a checagem do
  cargo é a **última** condição da promoção, e só é paga numa promoção de verdade.
- Descoberto ao rodar os testes de Regras na VM (503 de 504 passavam); um teste de fronteira trava a ordem.
- **Requer publicar as Rules** (504 testes de regra esperados na VM). Só Dashboard (App e worker não mudam).

## 1.12.0 — Mensagens para uma pessoa, a equipe, o Plantão ou todos (patch 0104)
- A tela agora é **Mensagens**. **Nova mensagem** (janela refeita, mais simples): **Para** = Uma pessoa, Equipe X, Plantão Y ou Todos.
- Para **equipe ou Plantão** é **uma mensagem só**; as respostas de cada pessoa chegam **juntas no mesmo cartão** ("2 de 9
  responderam"). O limite diário conta uma mensagem por pessoa ou por grupo.
- Cartões em **balões de conversa**; formulário e cartões compartilhados com o App.
- As mensagens vermelhas de erro (Informações e Mensagens) agora dizem o que fazer, em linguagem simples.
- **Requer publicar as Rules e os índices** (nova coleção `recadosGrupo` com limpeza automática; 504 testes de regra esperados na VM).

## 1.11.0 — Recados com mensagem e resposta livres (patch 0103)
- A tela "Recados" agora usa **texto livre** na mensagem e mostra a **resposta livre** da pessoa (antes eram só
  "Posso / Não posso"). Sem "tipo" de recado: você escreve e envia.
- O recurso é o mesmo do App, usado pelos colaboradores entre colegas da equipe e do Plantão; a liderança continua
  mandando para as equipes que gerencia, escolhendo uma ou várias pessoas (ou "Selecionar todos", até 10).
- Formulário e cartões passam a ser **compartilhados** com o App (`components/RecadoModal.tsx`, `RecadoCartoes.tsx`).
- **Requer publicar as Rules** (colegas da mesma equipe e participantes do mesmo Plantão passam a poder enviar; a resposta
  é livre; 492 testes de regra esperados na VM). Recados antigos do modelo anterior são ignorados (duram no máximo 3 dias).

## 1.10.1 — ajuste interno na barra de navegação (patch 0102)
- O menu lateral aceita uma bolinha de contador por item (usada só no App). Sem mudança visível no Dashboard.
- Só um ajuste em `components/AppFrame.tsx` (que o App também usa) → App 3.10.0.

## 1.10.0 — Recados: um recado curto, a resposta de um toque e o recado some (patch 0101)
- Nova tela "Recados" (menu, abaixo de Informações): a liderança escolhe uma ou mais pessoas (até 10), diz se quer
  **uma resposta** ("Posso" / "Não posso") ou **só avisar** ("Entendi") e escreve o texto livre (até 300 caracteres).
  Serve para "pode trocar comigo no dia 20?" ou "pode atender este chamado?".
- **Sem histórico nem conversa**: você vê "aguardando" ou a resposta (com a nota curta, se houver) e apaga com
  "Ok, apagar"; o que vence é apagado sozinho (3 dias sem resposta; 24 h depois de respondido) — pela limpeza ao
  abrir e pelo TTL do Firestore, para não ocupar armazenamento.
- **Limite diário de 30 recados por remetente**, aplicado nas Regras do Firestore (o servidor recusa o 31º): protege a
  cota gratuita de erro ou abuso. O medidor "N de 30 enviados hoje" aparece na tela.
- Só remetente e destinatário leem o recado; o destinatário só consegue responder.
- **Requer publicar as Rules e os índices** (coleções `recados` e `recadosLimite`, TTL em `expiraEm`; 489 testes de
  regra esperados na VM). Sem notificação no celular por enquanto: o colaborador vê ao abrir o App.
- App 3.9.0 (cartão "Recados da liderança").

## 1.9.1 — mais respiro no fim das janelas (patch 0100)
- Nas janelas "Nova regra" e "Nova informação", o último item não fica mais colado na linha do rodapé: a folga
  passou de 14px para 32px (no celular, 28px). Só estilo; sem mudança de comportamento.
- Só Dashboard (App continua na 3.8.2).

## 1.9.0 — liderança só por cargo, administrador sem equipe e textos mais naturais (patch 0099)
- **Só cargo de liderança vira liderança**: coordenador, supervisor, líder, gestor (e gerente, diretor, chefe…).
  Analista e técnico não. "Tornar liderança" só aparece para quem tem cargo de liderança, e "Nova liderança" exige
  um cargo de liderança. Vale também nas **Regras do Firestore** (`cargoDeLideranca`) — **requer publicar as Rules**
  (474 testes de regra esperados na VM). Não é automático de propósito: dar permissão a partir de um texto livre
  de cargo deixaria quem edita o cargo se promover sozinho.
- **Administrador sem equipe**: em Colaboradores não há "Minha equipe" nem "Sua equipe" para o administrador do
  sistema (ele administra tudo), e o papel sob o nome dele é "Administrador do sistema" (antes, "Coordenador").
- **Textos em português mais natural** no assistente de regras ("Muitos dias seguidos sem folga", "Turno muito
  longo", "Alerta grave", "Sobre o que você quer ser avisado?") e "ocorrência" no lugar de "caso".
- **Janelas sem corte**: nova regra e nova informação têm cabeçalho e rodapé fixos; só o miolo rola.
- **Informações**: o aviso vermelho agora diz a causa (Regras ou índice ainda não publicados, ou sem conexão).
- A auditoria de contas explica como dar a permissão de leitura à conta de serviço.
- App 3.8.2 (rótulo do administrador, em `lib/sessao.ts`).

## 1.8.1 — correção de segurança na impressão da escala + auditoria (patch 0098)
- Corrige um XSS: a janela "Imprimir escala" montava HTML com login, equipe e competência sem escapar; agora tudo
  é escapado e o documento impresso proíbe script (CSP).
- Remove `app/chatgpt-auth.ts` (código morto que confiava em cabeçalhos da requisição).
- Novo `npm run staging:auditar:contas-auth` (somente leitura): lista contas do Firebase Auth de outro domínio, com
  e-mail não verificado ou sem cadastro.
- Relatório em `docs/seguranca/AUDITORIA-SEGURANCA-2026-11.md` (achados, como confirmar e ordem de correção).
- Só Dashboard (App continua na 3.8.1).

## 1.8.0 — Informações marcadas na grade da escala (patch 0097)
- Na Grade da equipe, a célula do dia que tem informação (atestado, afastamento por horário, curso, anotação)
  ganha um pontinho colorido embaixo; o tooltip mostra o que é, e uma legenda explica as cores.
- Ao clicar numa célula para editar, o modal avisa "Esta pessoa tem uma informação neste dia" antes de mexer na
  escala.
- Não muda Rules nem índices (usa a mesma leitura da tela Informações). Tocou `components/ScheduleGrid.tsx`
  (usada também no App) → App 3.8.1.

## 1.7.0 — Informações: atestado, afastamento por horário, curso e anotações (patch 0096)
- Nova tela "Informações" (menu, abaixo de Escalas): o chefe de equipe escolhe o colaborador, o tipo (afastamento
  por horário, atestado, curso ou treinamento, outra informação), o dia ou período, "dia todo" ou um horário, e
  escreve um título e observações (opcionais).
- Cada informação pode ser liberada (ou não) para o colaborador ver no App; por padrão só a liderança vê.
- Consulta: calendário do mês com pontos coloridos por tipo, painel do dia, lista do mês agrupada por dia, busca,
  filtros (pessoa, tipo, quem pode ver) e números do topo (hoje, no mês, atestados, o colaborador vê).
- Atestado: o formulário lembra de não registrar diagnóstico nem CID.
- **Requer publicar as Rules e os índices do Firestore** (coleção `informacoesDia`; 456 testes de regra na VM).
- O App passa a mostrar o que for liberado (App 3.8.0).

## 1.6.0 — criar regra em 3 passos, para qualquer pessoa (patch 0095)
- "Nova regra" agora é um passo a passo: 1) escolher o que vigiar (dias demais seguidos, pouco descanso, turno
  comprido, dia da semana), 2) ajustar UM número numa frase ("…trabalhar mais de [5] dias seguidos") e 3) dizer
  quão sério é e para quem vale — sem termos técnicos.
- O efeito aparece ao vivo ("3 pessoas seriam avisadas na escala…") enquanto se ajusta o número.
- Última tela com o resumo numa frase; o texto do aviso pode ser mudado, mas já vem pronto.
- A tela anterior (SE/ENTÃO) continua, como "Preciso de algo diferente"/"Ajustes avançados", para quem já conhece.
- Regras criadas pelo passo a passo reabrem nele ao editar; as de desenho livre abrem no modo avançado.
- Saiu o menu "Começar de um exemplo" (o passo 1 faz o mesmo papel).
- Só Dashboard (App continua na 3.7.6).

## 1.5.0 — regras da escala salvas valem de verdade (patch 0093)
- Administração › Regras: o administrador salva, liga/desliga, edita e exclui regras da empresa; só ele grava
  (Rules da coleção `regrasEscala`, com testes de regra).
- Um motor para tudo: sino, alertas, contadores, células, prévia de mudança e publicação usam as regras em vigor
  (legais + salvas). Regra marcada "bloquear a publicação" impede publicar.
- Regras legais com a gravidade que o sistema já mostrava e as sugestões de hoje.
- **Requer publicar as Rules do Firestore** (443 testes de regra na VM) além do build do Dashboard.

## 1.4.0 — construtor visual de regras (patch 0092)
- Construtor SE/ENTÃO: escolher o que medir, a comparação e o valor; E/OU; gravidade; mensagem com campos.
- "▶ Testar nesta escala" roda a regra na escala aberta sem gravar; exemplos prontos; grupo "Em teste".

## 1.3.0 — alertas melhores ao ajustar a escala (patch 0091)
- Painel "Problemas desta escala" por pessoa, com "Ver na escala"; células marcadas com a mensagem da regra.
- Aviso antes de confirmar uma mudança de turno que cria problemas.
- Tocou `components/ScheduleGrid.tsx` (usada também no App) → App 3.7.6.

## 1.2.0 — regras da escala: motor e painel (patch 0090)
- Motor de regras "SE … ENTÃO …" e Administração › Regras com as 3 regras legais, provado equivalente ao motor
  anterior em 300 escalas aleatórias.

## 1.1.1 — equipe de um Plantão não é equipe 6x1 (patch 0089)
- Corrige a aba duplicada "Plantão COSI 6x1" na Minha equipe; Administração › Equipes e Conferência passam a
  reconhecer a equipe de um Plantão; script `staging:corrigir:equipe-plantao`.

## 1.1.0 — vistoria do Dashboard (patches 0085 a 0088)
- Início enxuta, uma cor por estado, seletor do topo só onde faz sentido (lote 1).
- Minha equipe com ações claras e "+ Nova"; Trocas sem repetição (lote 2).
- Linguagem simples, "Descartar rascunho" no "⋯", demonstração sem erros (lote 3).
- Administração: Coordenações em lista e Conferência (lote 4).

## 1.0.0 — ponto de partida
- O Dashboard até a vistoria: Escala do Plantão reformulada (conferir, publicar, ajustar), Administração
  (Equipes, Plantões), Lideranças, Colaboradores, importação e publicação da escala.
