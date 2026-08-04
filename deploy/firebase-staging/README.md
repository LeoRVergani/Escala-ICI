# Firebase de homologação — Fase 3K-B

Este ambiente serve apenas para dados e contas fictícias. O ID do projeto
precisa terminar em `-staging`, `-hml` ou `-homolog`; o código bloqueia escrita
administrativa em qualquer outro nome, inclusive quando a flag de escrita for
ligada por engano.

## 1. Criar o projeto

1. Crie um projeto Firebase novo, sem dados reais, como
   `escala-ici-staging`.
2. Ative Authentication por e-mail/senha e crie o Cloud Firestore.
3. Registre um Web App e copie somente sua configuração pública.
4. Não crie Service Account e não baixe chave privada nesta fase.

## 2. Preparar os ambientes

```bash
cp .env.staging.app.example .env.staging.app
cp .env.staging.dashboard.example .env.staging.dashboard
```

Preencha os quatro valores `VITE_FIREBASE_*` nos dois arquivos. Mantenha
`VITE_FIREBASE_ENVIRONMENT=staging` e
`FIREBASE_STAGING_CONFIRMATION=ESCALA_ICI_STAGING_ONLY`. O App continua com
escrita `false`; somente o Dashboard usa `true`.

```bash
npm run firebase:staging:preflight
npm run preflight:firebase -- --target=staging --env-file=.env.staging.app --json
```

## 3. Contas fictícias

Crie no Authentication, usando uma senha exclusiva para homologação:

- `marina.azevedo@example.com` — gestora fictícia;
- `caio.monteiro@example.com` — colaborador fictício.

Use o fluxo de bootstrap de `seed/README.md` para cadastrar o perfil inicial
da gestora. Depois publique imediatamente as regras finais. Nunca importe
planilhas, e-mails ou nomes reais neste ambiente.

## 4. Regras e índices finais

O comando abaixo modifica o projeto remoto e exige confirmação literal:

```bash
npm run firebase:staging:deploy -- --confirm=DEPLOY_STAGING
```

Ele publica somente `firestore.rules` e `firestore.indexes.json` no projeto
declarado em `.env.staging.dashboard`.

## 5. Teste online obrigatório

1. Entre no Dashboard com a gestora fictícia.
2. Importe ou carregue uma escala totalmente fictícia.
3. Salve rascunho e confirme que o App não muda.
4. Publique com um motivo claro.
5. Confirme no App, sem F5, a escala atualizada e o contador do sino.
6. Abra a notificação e confira antes/depois.
7. Restaure a revisão anterior e confirme o novo evento em tempo real.
8. Tente acessar outra equipe e confirme `PERMISSION_DENIED`.
9. Repita no computador e no celular.

Somente depois deste roteiro o ambiente pode ser considerado aprovado. A
produção permanece fora do escopo da Fase 3K-B.
