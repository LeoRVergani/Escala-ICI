# Checkpoint — Fase 3K-C.1

## Objetivo

Permitir que o Dashboard do laboratório funcione diretamente pelo IPv4
privado da VM, sem túnel SSH, e preparar a implantação definitiva do Dashboard
atrás do proxy HTTPS interno.

## Causa raiz

`crypto.randomUUID()` só está disponível em contextos seguros. Ao abrir o
Dashboard em `http://172.31.6.111:4173`, o navegador mantém
`crypto.getRandomValues()`, mas pode omitir `crypto.randomUUID()`. As chamadas
diretas em `salvarRascunho()` e `novoUsuario()` provocavam
`TypeError: crypto.randomUUID is not a function`.

## Correção

- `lib/uuid.ts` centraliza a geração de UUID v4;
- usa `randomUUID()` quando disponível;
- usa `getRandomValues()` como fallback criptograficamente seguro;
- não usa `Math.random()`, timestamp ou contador previsível;
- as duas chamadas administrativas agora usam `gerarUuid()`;
- testes validam formato, versão, variante, unicidade, preferência pela API
  nativa e erro controlado sem Web Crypto API;
- contrato de fronteira impede a reintrodução de chamadas diretas.

## Laboratório sem túnel

O launcher LAN continua publicando Dashboard, App e emuladores nas interfaces
da VM. O fluxo de importação, edição da Grade, rascunho e publicação pode ser
testado diretamente em:

- Dashboard: `http://172.31.6.111:4173`;
- App: `http://172.31.6.111:4174`;
- Emulator UI: `http://172.31.6.111:4000`.

O fallback de UUID corrige o Dashboard nesse contexto. A instalação do PWA,
service worker e APIs de navegador restritas a contexto seguro continuam sendo
testadas pela URL HTTPS do Cloudflare Pages.

O launcher também deixa de falhar com a saída isolada `not running` quando
`--open-firewall` é usado e o `firewalld` está instalado, porém inativo.

## Dashboard definitivo na VM

O Compose publica `127.0.0.1:4173` por padrão. Para o laboratório Docker LAN,
`.env.emulator-lan.example` define explicitamente
`DASHBOARD_BIND_ADDRESS=0.0.0.0`.

Na implantação definitiva:

1. o Dashboard Docker permanece em `127.0.0.1:4173`;
2. o proxy reverso da VM publica somente HTTPS/443;
3. o proxy usa certificado da PKI corporativa e DNS interno;
4. o Dashboard usa Firebase remoto por HTTPS;
5. Authentication e Firestore Emulator não são publicados.

O exemplo para Caddy instalado no host está em
`deploy/dashboard/Caddyfile.intranet.example`. Se já existir proxy em
contêiner na VM, deve-se reutilizá-lo por rede Docker compartilhada, sem tentar
ocupar novamente as portas 80/443.

## Validação automatizada

Comando consolidado:

`npm run check:phase3kc1`

Resultado registrado em 3 de agosto de 2026:

- 46 testes unitários aprovados;
- 28 testes de fronteira aprovados;
- 14 testes de preflight Firebase aprovados;
- 16 testes integrados com Auth, Firestore e regras aprovados;
- 3 testes de contrato de staging aprovados;
- 5 testes de contrato LAN aprovados;
- seed, smoke simultâneo, lint, builds do Dashboard/App e build geral aprovados;
- artefato, PWA, contrato Firebase, implantações e staging validados.

Os testes manuais na VM permanecem necessários porque esta cópia de trabalho
não acessa a rede corporativa.

## Teste manual de aceite

1. iniciar o launcher LAN com o IPv4 privado;
2. abrir o Dashboard diretamente pelo IP, sem túnel;
3. entrar com a gestora fictícia;
4. importar a planilha fictícia;
5. editar uma célula da Grade;
6. salvar o rascunho sem erro de UUID;
7. publicar com motivo;
8. confirmar atualização em tempo real no App;
9. abrir os detalhes da revisão;
10. executar rollback.

## Itens preservados

- parser XLS/XLSX;
- contratos e regras Firestore;
- autenticação e permissões;
- rascunho, publicação, histórico e rollback;
- notificações em tempo real;
- visual do Dashboard e do App;
- separação entre Dashboard Docker e App/PWA Pages;
- bloqueio de escrita oficial por padrão.
