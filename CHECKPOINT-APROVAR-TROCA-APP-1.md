# CHECKPOINT — APROVAR-TROCA-APP-1 (coordenador aprova troca de 6x1 pelo App)

- Quem tem perfil de coordenação (coordenador, supervisor, gestor de unidade, admin) acompanha no App
  as trocas de 6x1 das próprias equipes (equipeId + equipesPermitidas), mês atual e próximo.
- Tela Trocas: painel "Para aprovar" (com contador) acima das trocas pessoais. Tela Hoje: aviso
  "N trocas aguardando sua aprovação" que leva direto para lá.
- Decisão: os dois lados da troca (ou os dois dias, na troca de folga), a mensagem, e os alertas que a
  troca deixaria (6x1 / 11h / 35h) — mesmo cálculo do Dashboard (`alertasHipoteticosDaTroca`, em
  lib/trocaFolga.ts). "Aprovar troca" aplica na escala publicada e notifica; "Recusar" exige motivo.
- A própria troca nunca aparece para a pessoa decidir como coordenadora (as Rules também negam).
- Repositório: aprovar/recusar aceitam `{ origemApp: true }` (o App não tem a escrita administrativa
  do Dashboard); o App usa `aprovarTrocaPeloApp` / `recusarTrocaPeloApp`. A autorização continua
  nas Rules (`podeAdministrarJornada`), igual à aprovação de Plantão pelo App.
- Sem mudança em firestore.rules.
- vitest 1527 ok (2 novos) · typecheck ok · lint 0 erros · test:boundaries 512/512 · build:apps ok.
