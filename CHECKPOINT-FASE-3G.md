# Checkpoint Fase 3G — prontidão Firebase somente leitura

## Objetivo concluído

O projeto está preparado para receber a configuração pública de um Firebase de
validação sem liberar gravações oficiais por engano.

## Proteções adicionadas

- confirmação das quatro variáveis obrigatórias do Firebase Web;
- validação do formato de API key, Project ID, Auth Domain e Web App ID;
- verificação de coerência entre Project ID e domínio `firebaseapp.com`;
- booleanos aceitos somente como `true` ou `false`;
- reprovação automática quando a escrita oficial está habilitada;
- emuladores aceitos somente em `localhost` ou `127.0.0.1`;
- saída de diagnóstico sanitizada, sem exibir API key ou App ID;
- modo JSON seguro para uso em integração contínua.

## Comandos

Com uma `.env.local` configurada:

```bash
npm run preflight:firebase
npm run preflight:firebase -- --json
npm run check:phase3g
```

O preflight deve informar `firebase-somente-leitura` e
`Escrita oficial: bloqueada`.

## Evidências automatizadas

`tests/firebase-preflight.test.mjs` cobre:

- configuração real válida em leitura;
- variáveis ausentes;
- formatos inválidos;
- projeto e Auth Domain divergentes;
- domínio personalizado;
- bloqueio de escrita;
- isolamento dos emuladores;
- ausência de credenciais na saída segura.

As regras reais do Firestore continuam verificadas no emulador isolado pela
suíte `test:firestore-rules`.

## Validação real ainda externa

Para concluir a integração real, é necessário configurar no ambiente:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false
VITE_FIREBASE_USE_EMULATORS=false
```

Depois disso, validar sem compartilhar senha:

1. login de um gestor no Dashboard;
2. login de um colaborador no App;
3. leitura de uma escala com status `PUBLICADA`;
4. bloqueio de rascunhos para o colaborador;
5. restauração da sessão em dispositivo confiável;
6. abertura offline depois de ao menos uma consulta online;
7. logout e limpeza dos dados locais.

Nenhum dado real, conta, senha ou gravação oficial foi criado neste checkpoint.
