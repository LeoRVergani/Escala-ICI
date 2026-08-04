# Escala ICI — Dashboard + App Web

Monorepo React/TypeScript com três formas de execução:

- `apps/dashboard`: SPA Vite independente para importação XLS/XLSX, correção,
  preview, rascunho, grade, usuários e publicação;
- `apps/app`: SPA Vite independente para Minha escala, Escala da equipe e Hoje,
  sempre em modo somente leitura;
- `packages/contrato`: parser SheetJS, tipos, normalização, totais e IDs
  compartilhados;
- host de compatibilidade nas rotas `/dashboard` e `/app`, preservado para que
  a versão publicada continue recuperável durante a separação;
- Firebase Auth e Cloud Firestore compatíveis com o plano Spark;
- modo demonstração funcional sem credenciais.

## Experiência do colaborador

A tela inicial do App é **Hoje** e responde de forma direta:

- se a pessoa trabalha no dia;
- horário de início e término;
- turno que está em andamento, inclusive após meia-noite;
- próximo turno encontrado no período publicado;
- colegas escalados no dia, usando o turno real daquele dia.

A competência não é fixa: no modelo SOC 26→25 ela muda automaticamente no dia
26, inclusive na virada de dezembro para janeiro. Períodos, meses e anos
mostrados na interface são derivados dos documentos publicados.

O mesmo App se adapta ao dispositivo:

- no celular, **Hoje** abre primeiro em cartões compactos, a semana cabe na
  largura da tela e a navegação inferior possui Hoje, Escala, Equipe e Perfil;
- no tablet, calendário e detalhe do dia usam o espaço sem reproduzir uma
  tabela de desktop reduzida;
- no desktop, a navegação roxa lateral, os cartões da jornada e o calendário
  completo seguem os mockups aprovados;
- Calendário e Agenda podem ser alternados manualmente em qualquer largura;
- Minha escala inicia no formato de Agenda no celular e Calendário em telas
  maiores;
- os temas claro e escuro mantêm a mesma hierarquia e contraste.

O App também é um PWA instalável:

- nome oficial **Escala ICI** e identidade baseada no símbolo oficial;
- instalação em Android, Windows, macOS e navegadores compatíveis;
- orientação livre para celular, tablet e desktop;
- shell do App disponível após a primeira visita;
- dados Firebase continuam usando a persistência local já existente;
- nenhuma resposta externa do Firebase é armazenada pelo service worker;
- atualizações são apresentadas ao usuário antes da ativação para evitar
  misturar arquivos de versões diferentes.

No iPhone e iPad, abra o App no Safari e use **Compartilhar → Adicionar à Tela
de Início**.

Ao entrar, o colaborador pode manter a sessão e a consulta offline em um
dispositivo confiável. Em computador compartilhado, a opção deve ser
desmarcada. A sessão válida é restaurada automaticamente ao reabrir o PWA.

## Requisitos

- Node.js 22 ou superior;
- um projeto Firebase;
- Authentication por e-mail/senha habilitado;
- banco Cloud Firestore criado.

## Executar localmente

Instale uma vez:

```bash
cp .env.example .env.local
npm install
```

Depois escolha o produto:

```bash
npm run dev:dashboard
# Dashboard: http://localhost:4173

npm run dev:app
# App do colaborador: http://localhost:4174
```

Os comandos devem ser executados em dois terminais para abrir os produtos ao
mesmo tempo. Sem credenciais Firebase, use **Entrar na demonstração**.

O host de compatibilidade original continua disponível com `npm run dev`,
usando `/dashboard` e `/app`.

## Laboratório Firebase em localhost

Antes de configurar ou publicar o Firebase real, use o laboratório da Fase 3J-C.
Ele executa Authentication, Firestore, regras e a interface do Emulator Suite
somente no computador. Os dados são fictícios e podem ser apagados sem risco.

O laboratório mantém o rascunho separado da escala publicada. Assim, salvar
uma nova importação não remove a escala que o colaborador já consulta. Cada
publicação gera uma revisão imutável; restaurar uma revisão anterior cria outra
revisão de rollback, sem apagar o histórico.

### Inicialização automática

No Windows, clique duas vezes em:

```text
executar-laboratorio-windows.bat
```

No Linux:

```bash
chmod +x executar-laboratorio-linux.sh
./executar-laboratorio-linux.sh
```

Os inicializadores verificam Node.js 22+, Java 21 e dependências npm. Quando
algo estiver ausente, tentam instalar automaticamente usando `winget` no
Windows ou `apt`, `dnf` ou `pacman` no Linux. Depois executam a validação
completa da Fase 3K-C (tipos, testes, regras, ciclo de publicação/rollback,
builds, PWA e contrato Firebase),
iniciam os emuladores, carregam os dados fictícios, abrem Dashboard e App e
mostram os endereços e contas de teste.

Se as portas 4173 ou 4174 já estiverem ocupadas, o inicializador verifica se o
servidor é a versão atual conectada ao Firebase local. Uma instância válida é
reutilizada; uma instância Vite antiga é encerrada e reiniciada. Um programa
que não seja Vite nunca é encerrado automaticamente. Se somente uma das portas
8080 ou 9099 estiver ocupada, o inicializador para com uma mensagem clara para
evitar misturar instâncias diferentes do Firebase Emulator.

### Inicialização manual

Pré-requisitos:

- Java 21 ou superior para o Firestore Emulator;
- quatro terminais abertos na raiz do projeto.

Execute, nesta ordem:

```bash
# Terminal 1 — Auth, Firestore e painel local
npm run firebase:lab

# Terminal 2 — recria os dados fictícios
npm run firebase:lab:seed

# Terminal 3 — Dashboard com escrita local
npm run dev:dashboard:emulator

# Terminal 4 — App do colaborador, somente leitura
npm run dev:app:emulator
```

Endereços:

- painel dos emuladores: `http://127.0.0.1:4000`;
- Dashboard: `http://127.0.0.1:4173`;
- App do colaborador: `http://127.0.0.1:4174`.

Contas locais criadas pelo seed:

- gestora do Dashboard: `marina.azevedo@teste.local`;
- colaborador do App: `caio.monteiro@teste.local`;
- senha local de ambas: `EscalaLocal#2026`.

Os campos de e-mail e senha somente ficam habilitados quando Dashboard e App
recebem o `.env.emulator` da raiz do projeto. Os inicializadores validam essa
condição antes de exibir `LABORATORIO PRONTO`. Se houver uma versão Vite antiga
nas portas 4173/4174, o inicializador a troca automaticamente pela versão da
pasta atual.

No Dashboard, a escala publicada do laboratório é carregada ao entrar. Edite
uma célula e salve o rascunho: o App deve continuar mostrando a revisão ativa.
Depois publique e confira a atualização no App. Na tela **Escalas**, restaure
uma revisão anterior; o Dashboard registra uma nova revisão de rollback e o
App passa a mostrar o conteúdo restaurado. O App nunca recebe métodos de
escrita nem acesso ao histórico administrativo.

O botão **Carregar exemplo** usa a própria equipe local e o seed associa a
primeira linha da planilha ao colaborador Caio, permitindo publicar e conferir
o resultado imediatamente no App. Em uma planilha externa, logins ainda não
cadastrados podem ser criados pelo botão **Cadastrar usuários faltantes**. Para
visualizar uma linha específica com a conta fictícia do App, corrija o login
dessa linha para `cmonteiro` antes de cadastrar os demais usuários.

### Atualização em tempo real e histórico inteligente

Depois de salvar um rascunho, o App continua exibindo a última publicação e não
recebe aviso. Ao publicar uma alteração, o Dashboard exige um motivo, calcula
o antes/depois de cada pessoa e grava eventos somente para os colaboradores
afetados. O App aberto acompanha o Firestore em tempo real: a escala muda sem
`F5`, o sino recebe um contador e a central mostra data, revisão, motivo e os
turnos anteriores e novos.

O histórico do Dashboard permite abrir cada revisão para conferir quem foi
afetado e quais dias mudaram. Uma tentativa de publicar conteúdo idêntico é
bloqueada. O rollback continua imutável e também produz seu próprio resumo e
suas notificações. A leitura das notificações fica salva localmente em cada
dispositivo; avisos do sistema podem ser ativados pelo usuário quando o
navegador oferecer a API de notificações.

O arquivo `.env.emulator` usa identificadores de demonstração, não contém
credenciais reais e mantém `VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false`. Mesmo
que `VITE_FIREBASE_USE_EMULATORS=true` seja colocado por engano em um site
hospedado, a escrita permanece bloqueada fora de localhost ou de um IPv4
privado explicitamente autorizado pelo modo Laboratório LAN.

## Builds independentes

```bash
npm run build:dashboard
npm run build:app
```

Os artefatos são gerados separadamente em `dist/apps/dashboard` e
`dist/apps/app`. Nenhum deles depende do roteamento do outro.

## Fase 3K-A — implantações independentes

O monorepo continua sendo a fonte única do parser, modelos e contratos, mas os
produtos agora possuem destinos de execução separados:

- App do colaborador: SPA/PWA estático compatível com Cloudflare Pages;
- Dashboard: imagem Docker multi-stage servida por Nginx sem privilégios;
- host `/app` e `/dashboard`: mantido somente como compatibilidade durante a
  transição.

### App no formato Cloudflare Pages

```bash
npm run build:app:pages
npm run preview:app:pages
```

O diretório publicável é `dist/apps/app`. O PWA independente usa `/` como
`id`, `start_url` e `scope`. A rota antiga `/app` usa
`manifest-app.webmanifest` e continua funcional no host de compatibilidade.

As configurações completas estão em `deploy/cloudflare-pages/README.md`. Esta
fase não executa deploy nem cria projeto externo.

### Dashboard em Docker

```bash
npm run docker:dashboard:build
npm run docker:dashboard:up
```

O Dashboard responde em `http://localhost:4173` e a saúde do contêiner em
`http://localhost:4173/health`. A imagem usa somente o build administrativo,
usuário sem privilégios, filesystem somente leitura, capabilities removidas e
fallback de SPA.

Para testar o Dashboard Docker contra o laboratório Firebase já ativo:

```bash
docker compose --env-file .env.emulator -f deploy/dashboard/compose.yaml up --build -d
```

Encerre com `npm run docker:dashboard:down`. Consulte
`deploy/dashboard/README.md` para os detalhes.

### Validação da separação

```bash
npm run check:phase3ka
```

O comando preserva toda a validação Firebase da Fase 3J-C e acrescenta os
contratos de implantação do Pages e do Docker. A escrita oficial continua
bloqueada.

## Fase 3K-B — homologação online protegida

A homologação usa Firebase separado, contas fictícias, App PWA em Pages
temporário e Dashboard Docker. A escrita oficial só é reconhecida quando
`VITE_FIREBASE_ENVIRONMENT=staging` e o Project ID termina em `-staging`,
`-hml` ou `-homolog`. Produção continua bloqueada.

```bash
cp .env.staging.app.example .env.staging.app
cp .env.staging.dashboard.example .env.staging.dashboard
npm run firebase:staging:preflight
npm run build:app:staging
npm run docker:dashboard:staging:build
```

O procedimento e o aceite online estão em
`deploy/firebase-staging/README.md`. Para validar o pacote sem acessar serviços
externos:

```bash
npm run check:phase3kb
```

## Fase 3K-C — Laboratório LAN na VM

Esta fase permite testar o fluxo completo pela rede interna sem túnel SSH. O
launcher liga Firebase Auth, Firestore, Dashboard e App nas interfaces da VM,
carrega apenas dados fictícios e pode abrir as portas necessárias no
`firewalld`:

```bash
chmod +x executar-laboratorio-lan-linux.sh
./executar-laboratorio-lan-linux.sh --host=172.31.6.111 --open-firewall
```

Endereços esperados:

- Dashboard: `http://172.31.6.111:4173`;
- App: `http://172.31.6.111:4174`;
- Firebase Emulator UI: `http://172.31.6.111:4000`.

Antes de iniciar, encerre qualquer laboratório antigo que ainda esteja usando
as portas 4000, 4173, 4174, 8080 ou 9099. O script exige Node 22.13+, Java 21,
IPv4 privado e correspondência exata entre o endereço aberto no navegador e
`VITE_FIREBASE_LAN_HOST`.

```bash
npm run check:phase3kc
npm run check:phase3kc1
```

O modo LAN não é aceito em staging ou produção e nunca habilita escrita
oficial. Quando houver DNS e Firebase de homologação, o Dashboard Docker usa o
procedimento protegido da Fase 3K-B.

### Acesso sem túnel e implantação interna

A Fase 3K-C.1 remove a dependência direta de `crypto.randomUUID()`. Com isso, o
Dashboard do laboratório pode ser acessado diretamente pelo IPv4 privado em
HTTP, sem túnel SSH, inclusive para editar a Grade e salvar rascunhos. O App
aberto por HTTP em um IP privado serve para o fluxo integrado, mas instalação
PWA, service worker e APIs protegidas do navegador devem ser validados na URL
HTTPS do Cloudflare Pages.

No Dashboard Docker definitivo, a porta 4173 fica vinculada a `127.0.0.1` por
padrão. Um proxy reverso HTTPS da VM publica o serviço na rede corporativa.
Consulte `deploy/dashboard/README.md` e
`deploy/dashboard/Caddyfile.intranet.example`. Authentication e Firestore
Emulator continuam exclusivos do laboratório; a implantação definitiva usa
Firebase remoto por HTTPS.

## Configurar o Firebase

1. No console Firebase, crie um projeto no plano Spark.
2. Ative **Authentication → E-mail/senha**.
3. Crie o Cloud Firestore.
4. Registre um aplicativo Web e copie os valores para `.env.local`.
5. Crie o gestor e os nove usuários no Authentication.
6. Siga [seed/README.md](seed/README.md) para executar a carga inicial com as
   regras temporárias de bootstrap.
7. Publique imediatamente as regras finais e os índices:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

Não são usados Cloud Functions, Admin SDK ou Cloud Storage.

## Variáveis

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false
VITE_FIREBASE_USE_EMULATORS=false
VITE_FIREBASE_LAN_MODE=false
VITE_FIREBASE_LAN_HOST=
VITE_DASHBOARD_URL=http://localhost:4173
VITE_EMPLOYEE_APP_URL=http://localhost:4174
```

Os dados públicos do Firebase Web SDK não são segredos. A autorização efetiva
está em `firestore.rules`. A escrita oficial permanece bloqueada por padrão,
inclusive com login real. Para a validação integrada, confirme a configuração
sem exibir credenciais:

```bash
npm run preflight:firebase
npm run preflight:firebase -- --json
```

O diagnóstico valida formatos, a coerência entre projeto e domínio, impede
emuladores remotos não autorizados e reprova escrita oficial por padrão. A saída JSON é
sanitizada: não contém API key nem App ID.

## Validação

```bash
npm run typecheck
npm run typecheck:apps
npm run test:unit
npm run test:boundaries
npm run lint
npm run build:apps
npm run build
npm run validate:artifact
```

Para executar toda a validação da separação:

```bash
npm run check:phase3a
```

Para validar o ciclo completo do laboratório com histórico e rollback:

```bash
npm run check:phase3jc
```

Para validar o laboratório e também as implantações independentes da Fase
3K-A:

```bash
npm run check:phase3ka
```

Para validar também a competência e a jornada dinâmica:

```bash
npm run check:phase3b
```

Para validar a experiência adaptativa do colaborador:

```bash
npm run check:phase3c
```

Para validar o PWA, os ícones e a atualização segura:

```bash
npm run check:phase3d
```

Para validar sessão, bloqueio operacional e regras reais em um Firestore
emulado isolado:

```bash
npm run check:phase3e
```

Para validar também o contrato visual responsivo:

```bash
npm run check:phase3f
```

Para validar a prontidão do Firebase real mantendo somente leitura:

```bash
npm run check:phase3g
```

Para validar também a convergência visual responsiva com a referência
“Semana + Agenda”:

```bash
npm run check:phase3h
```

Para validar Auth + Firestore, isolamento COSI/SOC × CODB/NOC, regras,
rascunho, publicação e leitura do colaborador no laboratório local:

```bash
npm run test:firebase-integration
npm run check:phase3i
```

Os roteiros e as evidências dos checkpoints mais recentes estão em
[`CHECKPOINT-FASE-3G.md`](CHECKPOINT-FASE-3G.md) e
[`CHECKPOINT-FASE-3H.md`](CHECKPOINT-FASE-3H.md).

Os testes do parser usam a planilha binária real e cobrem período 26→25, nove
colaboradores, células mescladas, férias, descansos, totais, `vd` e erros de
importação.

## Segurança e persistência

- O arquivo XLS/XLSX é lido em memória no navegador e nunca é enviado.
- O dashboard é o único aplicativo que chama operações de escrita.
- Todas as mutações administrativas exigem laboratório local/LAN autorizado ou
  `VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=true`; o valor oficial padrão é `false`.
- A separação é verificada por teste estrutural: o App importa apenas
  autenticação e leitura, enquanto as mutações ficam em `writeRepository`.
- O app do colaborador consulta somente documentos `PUBLICADA`.
- A persistência offline usa `persistentLocalCache` com suporte a múltiplas
  abas quando o usuário mantém a sessão em um dispositivo confiável.
- Os emuladores só podem ser conectados por localhost ou pelo IPv4 privado
  exatamente autorizado, com modo LAN e ambiente local explícitos.
- Importações com `ok === false` são bloqueadas antes de qualquer `writeBatch`.
- Lotes são automaticamente fatiados respeitando o limite de 500 operações.
