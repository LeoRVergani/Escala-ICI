# CHECKPOINT — PLANTAO-MULTIPOSTO-APP-1 (App suporta Plantão com vários postos)

Planilha de referência: Relatorio-PlantaoCODB (DBA, Linux, Telecom, Windows). O importador do
Dashboard já lia o formato (128 plantões, 32 por posto, 0 erros) e grava `funcao` em cada
atribuição; o App tratava tudo como um plantonista por vez (mostrava 1 dos 4).

App (só leitura, sem mudança em regras):
- Calendário do mês: em cada dia, uma linha por posto (sigla DBA/LNX/TEL/WIN + iniciais, na cor de
  identidade do plantonista; no celular só as iniciais). Seus plantões com contorno.
- Tela Plantão e card cheio da tela Hoje: "De plantão agora" com um card por posto — selo do posto
  (cor fixa por função), quem está, até quando, início → fim, contatos tocáveis e "Depois: …".
- Resumo de uma linha da tela Hoje: "DBA Bruno · LNX Alex · TEL José · WIN André".
- Janela do dia: lista ordenada por posto, com o selo do posto.
- Visão do coordenador: card de hoje por posto; Totais com coluna "Posto"; Próximos com selo.
- Plantão de posto único (COSI): sem nenhuma mudança (nenhuma atribuição tem `funcao`).

Funções novas (apps/app/src/plantaoApp.ts, testadas): ehPlantaoMultiposto, ordenarPorPosto,
resolverPlantaoAgoraPorPosto, funcaoPrincipalDoPlantonista, SIGLA_FUNCAO_PLANTAO.
vitest 1534 ok · typecheck ok · lint 0 erros · test:boundaries 512/512 · build:apps ok.
