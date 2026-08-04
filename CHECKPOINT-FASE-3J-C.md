# Checkpoint — Fase 3J-C

## Objetivo

Fechar o ciclo de comunicação entre Dashboard e App: uma publicação precisa
explicar o que mudou, atualizar o App sem recarregar a página e avisar somente
os colaboradores afetados.

## Entregue

- comparação determinística entre a escala ativa e a nova publicação;
- bloqueio de publicação sem mudanças;
- motivo obrigatório a partir da segunda revisão;
- totais de colaboradores e dias afetados no histórico;
- detalhes por pessoa e data, com valores anteriores e novos;
- eventos imutáveis em `eventosEscala`, separados por usuário;
- regras que limitam cada evento ao colaborador afetado e aos gestores da equipe;
- listeners Firestore para escala e eventos, sem necessidade de `F5`;
- sino com contador, central de atualizações e leitura persistida no dispositivo;
- aviso do navegador quando a permissão já tiver sido concedida;
- rollback também gera diferenças e notificações;
- testes unitários, de fronteira, regras e integração em tempo real.

## Comportamento esperado no laboratório

1. Salvar rascunho não altera nem notifica o App.
2. Publicar exige um motivo e cria uma nova revisão somente se houver mudanças.
3. O App aberto atualiza a escala automaticamente.
4. O sino recebe apenas eventos referentes ao usuário autenticado.
5. O histórico do Dashboard informa motivo, impacto e antes/depois.
6. Restaurar uma revisão cria novo evento de rollback, sem apagar o histórico.

## Limite deste checkpoint

Avisos em segundo plano com o PWA totalmente fechado dependem da futura camada
de Web Push/FCM e de um remetente confiável. A sincronização Firestore, o sino e
as notificações com o App aberto funcionam no laboratório local.
