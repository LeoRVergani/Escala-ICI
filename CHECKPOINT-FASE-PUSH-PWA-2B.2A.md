# Checkpoint — Fase PUSH-PWA-2B.2A

Data da execução: 2026-08-13.

Escopo: auditoria sanitizada dos documentos `dispositivosPush` de `lvergani`
e diagnóstico local do PWA sem envio FCM real.

## Baseline

- Repositório: `/root/projetos/Escala-ICI-main`.
- Branch: `feature/push-fcm-staging`.
- HEAD inicial esperado e confirmado antes das alterações:
  `138a509f4db64f0c6eaf042c3511171273bd3e8f`.
- Upstream: `origin/feature/push-fcm-staging`, ahead/behind `0 0`.
- Árvore Git inicial: limpa.
- PWA publicado antes desta fase: deploy `e19d907a`, commit `138a509`,
  alias `https://staging.escala-ici-staging.pages.dev`.
- Último teste real anterior: `devicesFound=7`, `successCount=3`,
  `failureCount=4`; celular sem exibição; computador com duas notificações
  de conteúdos diferentes; clique sem navegação perceptível.
- Serviço permanente do push-worker: saudável, sem porta publicada,
  `PUSH_ENABLED=false`.

## Causa dos registros acumulados

O `deviceId` WEB do PWA é persistido em `localStorage` por login, usando a
chave `escala-ici-push-device-id-<login>`. Reinstalação do PWA, limpeza de
dados do site, troca de perfil do navegador ou remoção de `localStorage`
fazem a instalação perder esse identificador local. Na próxima adesão, o app
cria um novo `deviceId` `web-<uuid>`.

Isso preserva computador e celular simultaneamente, mas também acumula
documentos antigos quando o registro anterior deixa de representar a
instalação atual. Esta fase não desativa nenhum documento; apenas prepara a
identificação segura.

## Auditoria sanitizada de `lvergani`

Comando executado em modo somente leitura:

```bash
npm run devices:audit --workspace @escala-ici/push-worker -- --login=lvergani
```

Execução local usou as variáveis operacionais fixas do Compose e o caminho da
credencial, sem imprimir `.env` nem conteúdo da credencial. A CLI não envia
FCM e não faz escrita.

| Ordem | ID abreviado | Ativo | Plataforma | Ambiente | FID presente | Confirmação |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `9e4022` | não | WEB | STAGING | sim | 2026-08-13T14:16:47.125Z |
| 2 | `2b11c8` | não | WEB | STAGING | sim | 2026-08-13T14:15:38.004Z |
| 3 | `ee9565` | sim | WEB | STAGING | sim | 2026-08-13T13:32:19.384Z |
| 4 | `f349d2` | sim | WEB | STAGING | sim | 2026-08-13T13:09:16.173Z |
| 5 | `325638` | sim | WEB | STAGING | sim | 2026-08-13T13:03:05.965Z |
| 6 | `76e2e3` | sim | WEB | STAGING | sim | 2026-08-13T13:02:36.980Z |
| 7 | `a71532` | sim | WEB | STAGING | sim | 2026-08-11T22:54:06.552Z |

## Tabela de saneamento preliminar

Os IDs abreviados exibidos atualmente no card do computador e do celular
ainda precisam ser informados pelo usuário após publicar esta fase. Até lá,
nenhum documento pode ser classificado com segurança como preservado.

| ID abreviado | Classificação atual |
| --- | --- |
| `9e4022` | INCONCLUSIVO |
| `2b11c8` | INCONCLUSIVO |
| `ee9565` | INCONCLUSIVO |
| `f349d2` | INCONCLUSIVO |
| `325638` | INCONCLUSIVO |
| `76e2e3` | INCONCLUSIVO |
| `a71532` | INCONCLUSIVO |

## Arquitetura do teste local

O card de Notificações do Perfil passa a expor `Testar neste dispositivo`
somente quando o estado está `ATIVO`. O botão:

- exige gesto explícito;
- não chama Firebase Messaging;
- não chama FCM;
- não registra, renova nem remove FID;
- não grava em `dispositivosPush`;
- envia `postMessage` ao service worker controlador por `MessageChannel`;
- só mostra sucesso depois que o service worker responde que aceitou a
  solicitação de exibição.

O service worker exibe a notificação local usando o mesmo helper interno que
o `onBackgroundMessage` usa para o push FCM. Na fonte do worker existe
somente uma chamada própria a `self.registration.showNotification(...)`.

Conteúdo do diagnóstico local:

- título: `Teste local — Escala ICI`;
- corpo: `Este dispositivo consegue exibir notificações.`;
- destino do clique: Perfil, com `?pushDiagnostico=1`.

## Protocolo página ↔ service worker

Mensagens aceitas:

- `ESCALA_ICI_SW_STATUS`: retorna `ok`, versão pública
  `push-pwa-2b2a`, origem controlada e horário local da consulta.
- `ESCALA_ICI_LOCAL_NOTIFICATION_TEST`: solicita a notificação local e
  retorna `ok` somente depois de aceitar a chamada de exibição.

O protocolo não expõe Firebase config, VAPID, FID, token, payload FCM,
e-mail, UID, user-agent ou IP.

## Segurança do clique

O `notificationclick` aceita somente dois destinos internos enumerados:

- troca real: exige `trocaId` e navega para `?trocaId=<id>`;
- diagnóstico local: exige `tipo: DIAGNOSTICO_LOCAL` e navega para
  `?pushDiagnostico=1`.

O worker constrói a URL sempre com `self.location.origin`. Campos como URL,
`click_action`, `link`, `fcmOptions` e pathname arbitrário são ignorados. O
fluxo tenta navegar uma janela existente da mesma origem, focar essa janela e
usa `clients.openWindow()` como fallback.

## Diferença entre canais de notificação

- Atualização de escala: canal foreground do App, via
  `new Notification('Escala ICI atualizada', ...)`, gerado por novo evento de
  escala observado no Firestore. Conteúdo diferente do FCM e do diagnóstico.
- Teste local: canal diagnóstico do PWA, via service worker, sem FCM, título
  `Teste local — Escala ICI`.
- Push FCM de troca: canal do push-worker, payload somente `data`, exibido
  pelo service worker com título/corpo vindos de `data`.

Não existe no código rastreado texto literal semelhante a `rodando em segundo
plano`; a notificação adicional observada no computador permanece pendência
de teste do navegador/SO ou de origem externa ao código rastreado.

## Roteiro posterior de identificação

1. Publicar o PWA corrigido no alias `staging`.
2. Abrir o PWA no computador.
3. Conferir no card o ID abreviado e a versão `push-pwa-2b2a`.
4. Executar `Testar neste dispositivo`.
5. Confirmar uma única notificação com título `Teste local — Escala ICI`.
6. Clicar e confirmar abertura do Perfil.
7. Repetir no celular com o PWA fechado.
8. Comparar os IDs abreviados do computador e celular com a auditoria.
9. Somente depois classificar dois registros como `PRESERVAR`.
10. Somente depois sanear registros antigos em fase própria.
11. Somente depois executar novo FCM real.

## Confirmações desta fase

- Nenhum dispositivo foi desativado.
- Nenhum documento real de Firestore foi alterado por esta fase.
- Nenhum push FCM real foi enviado.
- `PUSH_ENABLED=true` não foi usado.
- `PUSH_ACTIVATED_AT` não foi alterado.
- Dashboard e Android nativo permaneceram fora do escopo.

## Próxima fase recomendada

`PUSH-PWA-2B.2B — deploy, diagnóstico local em computador/celular e
saneamento controlado`.

## Nota de estado posterior

O roteiro posterior de identificação listado acima (passos 1-11) foi
executado nas fases seguintes, registradas em `CHECKPOINT-FASE-PUSH-PWA-2B.md`:
deploy do PWA corrigido, diagnóstico local confirmado em computador e
celular, saneamento reversível dos registros antigos (sem apagar
documentos) e um teste FCM real controlado (2 dispositivos, 2/2 sucesso, com
ressalva no comportamento do clique). Estado atual consolidado:
`PROJECT_STATUS.md` (raiz do repo).
