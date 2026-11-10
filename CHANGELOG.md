# Escala ICI — versões do App

A versão aparece no fim do **Perfil** (ex.: `3.0.0`) e fica em
`apps/app/package.json` → `"version"`. Regra (versionamento semântico):

- **MAIOR** (`4.0.0`) — mudança grande de etapa do produto.
- **MENOR** (`3.1.0`) — funcionalidade nova.
- **CORREÇÃO** (`3.0.1`) — ajuste ou correção, sem funcionalidade nova.

Cada patch que muda o App sobe o número. O App confere `/versao.json` ao abrir,
ao voltar para a tela e a cada 15 minutos; se a versão publicada for outra,
mostra **"Nova versão disponível · Atualizar"**.

## 3.1.0 — lembretes que avisam e se repetem
- Lembretes da Agenda viram push: "Avisar" no modal (sem aviso, no horário,
  5 min antes — padrão —, 15 min, 1 h, 1 dia antes; dia inteiro às 08:00).
- Lembrete atribuído pelo gestor avisa na hora em que é criado.
- "Repetir": todo dia, seg a sex, dias escolhidos (D S T Q Q S S) ou datas
  específicas, até uma data final (padrão 3 meses; até 180 por vez).

## 3.0.2 — troca de conta sem erro
- Sair e entrar com outra conta não mostra mais "A conexão com o Firestore foi
  reiniciada" (os ouvintes ignoram o encerramento do logout e os erros da
  sessão anterior são apagados ao entrar).

## 3.0.1 — modal de lembrete
- Modal de lembrete redesenhado: Salvar sempre visível (só o meio rola), título
  em destaque, "Em um horário | Dia inteiro", "Das … até …", descrição e
  repetição recolhidas; no celular, folha presa embaixo que cabe na tela.

## 3.0.0 — notificações no celular
- Push ligado: trocas 6x1 e de Plantão, escala publicada/alterada.
- Avisos do turno: "Você trabalha hoje", ponto de entrada/saída, intervalo por turno.
- Avisos de folga (véspera e no dia); aviso para quem aprova a troca 6x1.
- Conta do setor (ex.: celular do NOC); previsão do tempo no turno.
- Versão numerada e aviso de atualização confiável; aviso de instalar só uma vez.

## 2.x — App do colaborador e da coordenação
- Agenda, Trocas (6x1 e Plantão), Plantão multi-posto, visão do coordenador,
  aprovação de trocas e importação de Plantão pelo App.

## 1.x — Escala 6x1 e Dashboard
- Importação e publicação da escala 6x1, Dashboard de administração, regras do Firestore.
