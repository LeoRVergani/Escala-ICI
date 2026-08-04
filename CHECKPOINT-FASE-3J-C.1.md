# Checkpoint — Fase 3J-C.1

## Objetivo

Refinar a experiência visual e corrigir três problemas encontrados durante os
testes reais da Fase 3J-C, sem alterar o fluxo Firebase já aprovado.

## Correções entregues

- a seta da conta abre um menu e não encerra mais a sessão imediatamente;
- o menu exibe a identidade atual e uma ação explícita **Sair**;
- clique fora e tecla `Esc` fecham o menu sem sair;
- o fundo do tema escuro foi elevado de preto profundo para grafite azulado;
- superfícies, cartões e barra lateral acompanharam a nova luminosidade;
- o ícone do card **Próximo turno** voltou ao centro do círculo;
- o seletor do horário foi limitado ao bloco de texto e não sobrescreve mais o
  layout do ícone;
- o comportamento foi protegido por teste de fronteira para evitar regressão.

## Funcionalidades preservadas

- atualização da escala em tempo real, sem `F5`;
- sino, contador e central de notificações;
- histórico com motivo e diferenças antes/depois;
- rascunho, publicação e rollback no laboratório local;
- regras de acesso e bloqueio de escrita no Firebase oficial.
