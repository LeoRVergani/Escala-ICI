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
