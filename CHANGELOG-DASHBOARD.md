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
