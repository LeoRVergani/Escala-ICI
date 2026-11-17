# Escala ICI — versões do push-worker

O worker roda na VM (`docker:push-worker:staging:*`) e envia as notificações para o celular. A versão fica em
`apps/push-worker/package.json` → `"version"`. Mesma regra dos outros changelogs (versionamento semântico):
**MENOR** (`0.3.0`) = tipo novo de notificação; **CORREÇÃO** (`0.2.1`) = ajuste sem novidade. Um teste de fronteira
confere que o número do `package.json` é o da primeira seção deste arquivo.

Depois de mudar o worker, na VM: `git pull`, `npm run docker:push-worker:staging:build` e
`npm run docker:push-worker:staging:up` (as Rules do Firestore não mudam por causa do worker).

## 0.3.0 — recados entre colegas: aviso do recado e da resposta (patch 0103)
- O recado agora é entre colegas (equipe e Plantão), então o aviso é neutro: **"Novo recado — Você recebeu um recado.
  Abra o app para responder."** (antes dizia "da liderança"). Continua **sem nome e sem conteúdo** na tela bloqueada.
- **Novo aviso para quem enviou**: quando a resposta chega, **"Recado respondido — Alguém respondeu o seu recado."**
  (uma vez por recado, reserva `RR_<id>`; também sem nome e sem a resposta).
- **Correção importante**: no 0.2.0 o clique no aviso de recado **não abria o App** (o tipo `RECADO` não estava na lista
  de prefixos do service worker). Corrigido no App 3.11.0.

## 0.2.0 — push do recado novo (patch 0102)
- Quando a liderança envia um **recado**, o colaborador recebe a notificação no celular: "Nova mensagem da
  liderança — Você recebeu um recado que espera sua resposta" (ou "um aviso", se for só aviso).
- **Texto fixo**: o push nunca leva o nome de quem enviou nem o texto do recado (a tela bloqueada não revela nada).
- **Uma vez por recado** (reserva `RC_<id>` em `pushSinosEnviados`), só para recado criado depois da ativação do
  push, só enquanto espera resposta e antes de vencer; respeita `PUSH_ENABLED` e quem não tem dispositivo ativo.
- Cuidado com a data: em `recados` o `criadoEm` é um **Timestamp** do Firestore (nas outras coleções é texto ISO);
  a data de ativação é convertida para Timestamp — comparar com texto nunca acharia nenhum recado (há teste).

## 0.1.0 — ponto de partida
- Push das trocas de escala 6x1, das trocas de Plantão e da escala publicada/alterada, alertas de turno e lembretes.
