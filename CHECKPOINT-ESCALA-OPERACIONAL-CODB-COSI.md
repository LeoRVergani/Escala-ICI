# Retomada operacional — CODB / COSI

Data: 2026-09-09. Base: `main`, `ee2634aa0f80ec00337406978194664c2889dce0`.
Branch: `fix/escala-operacional-codb-cosi`.

## Correções

- Administração de Plantão: ao abrir participantes, carrega os candidatos
  elegíveis do próprio grupo e guarda a lista por `grupoId`. Antes, um gestor
  pesquisava em `usuarios`, que pertencia à última equipe/escala aberta.
  Não exige abrir uma escala antes de montar a equipe. A consulta usa o
  repositório de elegibilidade existente; nenhuma permissão foi ampliada.
- App: seleciona a competência publicada por `periodoInicio` / `periodoFim`,
  não exclusivamente por `competenciaOperacional()` (corte 26). Teste reproduz
  uma publicação mensal de agosto que cobre o dia 26, mas não era encontrada
  pela busca exclusiva de setembro. O período 26→25 continua coberto.
  Na sobreposição de períodos, prefere o início mais recente, seguido da
  atualização mais recente e do ID, de forma determinística.
- App: acompanha publicações do grupo selecionado com listener Firestore.
  Uma publicação nova ou revisada atualiza o detalhe, inclusive quando não
  havia escala publicada ao entrar. Cancela a assinatura ao trocar de grupo,
  sessão ou data e ignora respostas antigas. Não grava nada no App.
- Editor: título e orientação agora descrevem edição de Plantão também na
  criação manual, sem mandar o gestor importar um arquivo desnecessariamente.

## Evidência e limites

Os defeitos acima foram identificados no código; o cenário de data foi
reproduzido por teste. Não foi lida a base real de staging: isso não prova que
sejam as únicas causas dos relatos históricos de CODB/COSI. Cadastros e
permissões da instalação real ainda precisam ser conferidos no reteste.

Validação no navegador, em demonstração sem Firebase: Nova escala → Plantão
COSI → Abrir editor → adicionar Lia Vilar em 26/07, 19h–07h → Salvar rascunho
→ Publicar Plantão. A tela exibiu publicação e revisão 1. Não houve escrita
em staging. O ambiente de demonstração não prova persistência entre clientes.

A abertura do App pelo link do Dashboard foi recusada pela política de URL
do navegador de teste. Não foi contornada. O teste visual do PWA e o fluxo
completo Dashboard → PWA com identidades reais não foram concluídos.

## Validações automáticas

Todos os comandos abaixo concluíram com código 0:

| Comando | Resultado |
| --- | --- |
| `npm run test:unit` | 1.306 testes, 69 arquivos |
| `npm run test:boundaries` | 475 testes |
| `npm run test:firestore-rules` | 339 testes no emulador, incluindo consulta publicada por grupo |
| `npm run typecheck` e `npm run typecheck:apps` | Aprovados |
| `npm run lint` | Sem erros; 6 avisos preexistentes em testes não alterados |
| `npm run build:apps` | Dashboard, App e service worker gerados |
| `npm run build` | Host de compatibilidade gerado e validado |
| `npm run validate:pwa` | Aprovado |
| `npm run validate:artifact` | Aprovado |
| `npm run validate:deployments` | Aprovado |
| `git diff --check` | Sem erros |

Os testes de fronteira tiveram duas expectativas de import ajustadas para o
novo nome do leitor. Nenhuma asserção de autorização foi removida. Os novos
testes comportamentais cobrem data de corte, limites de período, isolamento
por grupo e acompanhamento/cancelamento de publicações.

## Preservações de escopo

Sem alteração de Firestore Rules/índices, seed, credenciais, dependências,
lockfile, autenticação, push, Docker, nginx, Cloudflare, Android ou EscalaSOC.
Sem deploy, FCM real ou escrita externa de escalas. A branch histórica
`feature/push-fcm-staging` permanece em `7a9b55c`, já presente no remoto.
Não havia PR aberto na consulta inicial.

O número de versão do pacote foi preservado: esta entrega é uma correção
em branch, sem release ou atualização de APK (não há Android neste repo).

## Reteste de staging após autorização de deploy

1. Entrar como coordenador CODB, abrir participantes diretamente e procurar
   duas pessoas da equipe sem visitar previamente a Jornada SOC.
2. Adicionar participantes, importar o XLS real ou criar a escala, salvar,
   reabrir e publicar.
3. Manter o PWA aberto no grupo e confirmar a chegada da publicação/revisão.
4. Conferir Plantão COSI, Hoje e Agenda, inclusive nos dias 25/26 e na virada
   de mês; comparar os dados com a planilha de origem.
5. Conferir Jornada 6x1 de outro colaborador, folgas e turnos noturnos.

Nenhum desses passos reais está marcado como concluído nesta entrega.
