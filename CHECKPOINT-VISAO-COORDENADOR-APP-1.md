# CHECKPOINT — VISAO-COORDENADOR-APP-1 (coordenador enxerga as equipes no App)

Somente leitura; montar/editar escala continua no Dashboard. Analista comum: App igual.

- Quem: perfis de coordenação (coordenador, supervisor, gestor de unidade, admin). Equipes 6x1 pelo
  mesmo resolvedor de escopos do Dashboard (Matriz, unidade, coordenador). Plantões: SÓ os que a
  pessoa administra (não os que apenas consulta), achados pela consulta de grupos que o App já usa
  (`listarGruposPlantaoPermitidos`) para cada equipe que ela organiza.
- Tela Hoje: "Hoje nas suas equipes" — por equipe 6x1, pessoas em cada turno (MD/M/T/N), folga,
  ausentes (férias, BH...) e alerta de turno descoberto; por Plantão, quem está agora (período no
  formato padronizado) e o próximo. Botão "Ver equipes".
- Aba Equipe: "Suas equipes" com abas (6x1 / Plantão). 6x1: grade da semana (pessoas x dias, chips
  coloridos, HE com selo, hoje destacado, ‹ › semanas). Tocar no nome abre o mês da pessoa com
  resumo (dias trabalhados, horas, folgas sábado/dia de semana/domingo, feriado, HE). Plantão:
  próximos plantões com o período.
- Lógica pura em apps/app/src/visaoCoordenador.ts (4 testes); UI em apps/app/src/VisaoCoordenador.tsx.
- Regras de arquitetura do App respeitadas (sem símbolos administrativos de Plantão, sem
  publicar/rascunho). Sem mudança em firestore.rules.
- vitest 1531 ok · typecheck ok · lint 0 erros · test:boundaries 512/512 · build:apps ok.
