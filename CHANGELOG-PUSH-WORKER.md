# Escala ICI — versões do push-worker

O worker roda na VM (`docker:push-worker:staging:*`) e envia as notificações para o celular. A versão fica em
`apps/push-worker/package.json` → `"version"`. Mesma regra dos outros changelogs (versionamento semântico):
**MENOR** (`0.3.0`) = tipo novo de notificação; **CORREÇÃO** (`0.2.1`) = ajuste sem novidade. Um teste de fronteira
confere que o número do `package.json` é o da primeira seção deste arquivo.

Depois de mudar o worker, na VM: `git pull`, `npm run docker:push-worker:staging:build` e
`npm run docker:push-worker:staging:up` (as Rules do Firestore não mudam por causa do worker).

## 0.5.2 — avisos do turno achando a escala também no ciclo novo 16→15 (patch 0109)
- O agendador de avisos do turno convertia cada data em UMA competência com a regra antiga (o dia 26 vira o mês seguinte) e
  buscava só ela. No ciclo novo, o rótulo é o mês em que o período termina e vira no dia **16**: de 16 a 25 de cada mês a escala
  certa estava no mês seguinte e **nenhum aviso de turno** sairia nesses dias. Agora busca o **mês anterior, o do calendário e o
  seguinte** (cobre o ciclo antigo, o novo e a transição) e funde as escalas da pessoa como o App faz — competência mais
  recente vence nas datas repetidas.

## 0.5.1 — imagem Docker bem mais leve e rápida de construir (patch 0107)
- O Dockerfile instalava o projeto INTEIRO (React, Vite, Firebase do navegador, planilhas…) e copiava ~800 MB de `node_modules`
  para a imagem final; o `npm prune` não ajudava (ele reinstala as dependências dos outros workspaces). O "exporting layers"
  levava de 6 a 13 minutos. Agora a imagem leva só as dependências de **produção do worker** (~83 MB, 157 pacotes): compila
  instalando só o workspace do worker, instala só produção num estágio à parte e copia só isso. Sem `npm prune`.
- Sem mudança de comportamento do worker. Conferido fora do Docker: todos os módulos do `dist` carregam só com esse
  `node_modules`, o ponto de entrada falha por configuração (como antes) e o healthcheck carrega.

## 0.5.0 — limpeza dos recados vencidos feita pelo worker (patch 0106)
- A cada hora (e ~1 min depois de subir) o worker **apaga os recados e as mensagens de grupo que venceram** e os **contadores
  diários com mais de 2 dias**, em lotes de 200 (teto de 5.000 por rodada). Não custa nada e mantém o armazenamento pequeno
  mesmo se ninguém abrir o App.
- **Substitui o TTL do Firestore**, que exige o plano pago: com o projeto no plano gratuito a publicação dos índices parava
  com "HTTP 403 — billing disabled" (e as Regras não eram liberadas). O arquivo de índices não declara mais TTL.

## 0.4.0 — mensagens para equipe e Plantão: o grupo todo é avisado (patch 0104)
- Mensagem para uma **equipe** ou um **Plantão**: **todos os integrantes** (menos quem enviou) recebem "Novo recado"; quem enviou
  recebe "Recado respondido" na **primeira** resposta. Uma vez por pessoa (`RG_<id>_<login>`) e uma vez por mensagem (`RGR_<id>`).
- Sem nome e sem conteúdo na tela bloqueada. Os integrantes são resolvidos no servidor (equipe: cadastro ativo; Plantão:
  participantes ativos).

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
