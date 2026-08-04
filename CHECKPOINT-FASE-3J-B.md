# Checkpoint — Fase 3J-B

## Objetivo

Validar no Firebase Emulator o fluxo completo de uma competência antes de
qualquer homologação oficial: importar, validar, salvar rascunho, publicar,
ler no App do colaborador, publicar uma alteração e executar rollback.

## Implementado

- rascunhos isolados em `rascunhosTurnosMes`, sem substituir a escala ativa;
- escala visível ao App mantida em `turnosMes` somente como `PUBLICADA`;
- ponteiro da revisão ativa em `publicacoesEscala`;
- histórico imutável em `historicoPublicacoes`;
- cópia completa de cada colaborador e revisão em `versoesEscala`;
- rollback seguro: restaura uma revisão anterior criando uma nova revisão;
- histórico e confirmação de rollback no Dashboard;
- colaborador impedido pelas regras de ler rascunhos, histórico ou versões;
- COSI/SOC preservado separado de CODB/NOC;
- carga inicial fictícia registrada como revisão 1;
- inicializadores Windows e Linux atualizados para a validação da Fase 3J-B;
- detecção do Java 21 no Windows compatível com PowerShell, inclusive quando o
  Temurin já está instalado mas ainda não entrou no `PATH` do terminal;
- executor do Firebase Emulator independente de `firebase.cmd` e compatível
  com caminhos do Windows e Node.js 24, mantendo mensagens explícitas de erro;
- lint, build e validação do artefato executados pelo Node, sem depender do
  Bash do WSL/Git Bash durante o laboratório Windows;
- smoke test vivo que sobe o Firebase Emulator, carrega o seed e exige que
  Firebase, Dashboard e App respondam simultaneamente com o ambiente local
  realmente injetado nas duas interfaces;
- Dashboard e App carregam o `.env.emulator` da raiz do repositorio por meio de
  `envDir`, evitando que o login fique desabilitado;
- os inicializadores recusam portas antigas ou interfaces abertas sem o modo
  Firebase local e aguardam a interface do Emulator na porta 4000;
- a planilha XLS de exemplo é interpretada com a equipe autenticada, sem usar
  o identificador isolado da demonstração;
- os usuários ausentes são cadastrados atomicamente na equipe da gestora
  autenticada, com bloqueio contra mistura de equipes;
- a consulta individual do App inclui UID, equipe, competência e status,
  atendendo às regras de leitura do Firestore;
- documentos com UID vazio ou importação ainda inconsistente não podem ser
  publicados, e erros do Firebase são apresentados de forma curta;
- teste integrado dedicado executa o XLS incluído do parser até a leitura pelo
  App, cobrindo cadastro, rascunho, publicação e regras;
- escrita no Firebase oficial mantida bloqueada.

## Fluxo de teste manual

1. iniciar `executar-laboratorio-windows.bat` ou
   `executar-laboratorio-linux.sh`;
2. entrar no Dashboard com a gestora fictícia;
3. importar uma planilha, validar e salvar o rascunho;
4. confirmar no App que a revisão publicada anterior continua visível;
5. publicar o rascunho e confirmar a atualização no App;
6. voltar ao histórico do Dashboard e restaurar a revisão 1;
7. confirmar que o App recebeu a escala restaurada e que o histórico ganhou
   uma nova revisão do tipo `ROLLBACK`.

## Validação

```bash
npm run check:phase3jb
```

## Limite de segurança

Esta fase não autoriza credenciais reais, escrita oficial, publicação de regras
ou alteração do projeto Firebase de produção. A promoção continua dependendo
de uma homologação controlada posterior.
