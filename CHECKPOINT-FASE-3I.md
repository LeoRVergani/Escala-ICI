# Checkpoint — Fase 3I

## Objetivo

Validar o ciclo completo sem acessar o Firebase oficial: autenticação local,
regras, rascunho, publicação, leitura do colaborador e atualização da escala.

## Implementado

- Authentication Emulator em `127.0.0.1:9099`;
- Firestore Emulator em `127.0.0.1:8080`;
- Emulator Suite UI em `127.0.0.1:4000`;
- configuração Vite exclusiva `.env.emulator`, sem segredos;
- escrita administrativa liberada apenas no emulador em host local;
- escrita oficial preservada como `false`;
- seed idempotente com pessoas, logins e e-mails fictícios;
- COSI/SOC isolado de CODB/NOC nos testes de segurança;
- Dashboard carregando documentos existentes do laboratório;
- App do colaborador limitado a documentos `PUBLICADA`;
- teste integrado com Firebase Authentication e Firestore reais emulados;
- teste do fluxo rascunho → invisível ao colaborador → publicação → leitura →
  atualização;
- demonstração pública sem nomes ou logins reais.

## Comandos

```bash
npm run firebase:lab
npm run firebase:lab:seed
npm run dev:dashboard:emulator
npm run dev:app:emulator
npm run test:firebase-integration
npm run check:phase3i
```

## Critério de promoção

Somente depois de todos os testes locais e da aprovação visual, preencher as
variáveis do projeto real. A promoção não exige alterar o App do colaborador e
não autoriza habilitar escrita oficial automaticamente.
