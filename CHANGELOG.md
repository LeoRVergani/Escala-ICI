# Escala ICI — versões do App

A versão aparece no fim do **Perfil** (ex.: `3.0.0`) e fica em
`apps/app/package.json` → `"version"`. Regra (versionamento semântico):

- **MAIOR** (`4.0.0`) — mudança grande de etapa do produto.
- **MENOR** (`3.1.0`) — funcionalidade nova.
- **CORREÇÃO** (`3.0.1`) — ajuste ou correção, sem funcionalidade nova.

Cada patch que muda o App sobe o número. O App confere `/versao.json` ao abrir,
ao voltar para a tela e a cada 15 minutos; se a versão publicada for outra,
mostra **"Nova versão disponível · Atualizar"**.

## 3.5.0 — importar a escala 6x1 pelo App
- Equipe › 6x1 › "Importar planilha do mês": Planilha → Conferir → Publicar,
  com escolha do mês (atual ou próximo). Mesmo processo do Dashboard: nomes
  conciliados com cadastros e apelidos, erros que impedem publicar, avisos.
- Sem pendências: publica para a equipe (quem teve mudança recebe o aviso).
  Com pendências: salva o rascunho para resolver no Dashboard.

## 3.4.0 — lembrete com aviso para a equipe
- Em Equipe, o coordenador cria lembrete para alguém da 6x1 (no mês da pessoa)
  ou do Plantão (sino em Totais e Próximos), com Avisar e Repetir; a pessoa
  recebe "Novo lembrete do seu gestor" e o alarme no horário.
- Regra: pode criar quem administra a 6x1 da equipe do destinatário ou o
  Plantão de que ele participa (plantonista de outra equipe).

## 3.3.0 — tela da coordenação
- Hoje do coordenador: números do dia (trabalhando agora, na escala, folga,
  ausentes, de plantão agora, trocas para aprovar); por equipe 6x1,
  Ontem | Hoje | Amanhã por turno com previsão do tempo e o "Agora"; por
  Plantão, Antes · Agora · Depois de cada posto (tocar abre os telefones).
- Trocas: "Histórico da equipe" com aprovadas, recusadas e canceladas.
- Agenda do coordenador sem equipe fixa: Lembretes. Perfil sem avisos do turno.

## 3.2.0 — Hoje do plantonista
- "Seu plantão": de plantão agora (progresso e quanto falta) ou o próximo
  (quanto falta para começar), com a previsão do tempo no horário.
- "Passagem do plantão": antes · agora · depois no meu posto; tocar abre os
  telefones para ligar.
- "Minha semana de plantão": os 7 próximos dias.
- Sem o aviso "Nenhuma jornada 6x1" para quem é plantonista.

## 3.1.1 — previsão com lua no turno da noite
- A previsão já usava só as horas do turno; o ícone agora mostra a lua quando a
  maior parte do turno é de noite (Noite, Madrugada), em vez do sol.

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
