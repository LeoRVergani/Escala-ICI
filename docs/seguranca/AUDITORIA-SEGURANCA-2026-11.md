# Auditoria de segurança — Escala ICI (novembro/2026)

**Método:** revisão estática do código (Regras do Firestore, autenticação, cabeçalhos, Docker, dependências,
segredos) e `npm audit`. **Não** foram feitos ataques reais, nem testes contra o ambiente publicado, a VM ou o
projeto Firebase — o que depende de configuração do console está marcado como "a confirmar".

## Resumo

| # | Gravidade | Achado | Situação |
|---|---|---|---|
| 1 | **ALTA** | Identidade nas Rules = texto antes do `@`, sem domínio nem e-mail verificado | **A confirmar** (depende do console) · correção proposta |
| 2 | **ALTA** | XSS na janela de impressão da escala (`document.write` com dado cru) | **Corrigido** neste patch (Dashboard 1.8.1) |
| 3 | **ALTA** | `xlsx@0.18.5`: prototype pollution e ReDoS (sem correção no npm) | Aberto |
| 4 | MÉDIA | Sem Content-Security-Policy (nginx e `_headers`) | Aberto · política proposta abaixo |
| 5 | MÉDIA | Login por senha sem MFA, CAPTCHA ou App Check (força bruta / credential stuffing) | Aberto |
| 6 | MÉDIA | Dashboard servido em HTTP na VM (porta 4173) | A confirmar |
| 7 | MÉDIA | Dependências com vulnerabilidades (`next` crítico, não implantado) | Parcial |
| 8 | BAIXA | `app/chatgpt-auth.ts`: código morto que confiava em cabeçalhos | **Removido** neste patch |
| 9 | BAIXA | Leitura de estrutura organizacional por qualquer conta autenticada | Cai de nível quando o #1 for fechado |
| 10 | BAIXA | Botão "Entrar na demonstração" no ambiente real; cache offline no aparelho | Observação |

## 1. Identidade fraca nas Rules (ALTA — a confirmar)

`firestore.rules`: `autenticado()` é só `request.auth != null` e `loginDoAuth()` é
`request.auth.token.email.lower().split('@')[0]`. Não há checagem de domínio, de `email_verified` nem do provedor.
Consequência: uma conta `fulano@qualquer-dominio.com` é tratada como `fulano` da empresa — inclusive se `fulano` for
gestor ou administrador. O cliente restringe o tenant da Microsoft só no navegador (parâmetro `tenant`), o que **não é
uma barreira** (quem chama a API do Firebase direto ignora o cliente).

**Quando é explorável:** se o projeto Firebase aceitar cadastro por e-mail/senha por conta própria (opção
"Enable create (sign-up)" do Authentication, ligada por padrão) **ou** se o provedor Microsoft aceitar contas de
outros diretórios. A chave de API do Firebase é pública por desenho — não é segredo.

**Como confirmar (sem atacar nada):**
1. Console Firebase → Authentication → Settings → User actions: "Enable create (sign-up)" precisa estar **desligado**.
2. Authentication → Sign-in method → Microsoft: usar o **Tenant ID** da empresa e, no Entra ID, registrar o app como
   *single tenant*.
3. Rodar na VM a auditoria (só leitura): `npm run staging:auditar:contas-auth` — lista contas de outro domínio, com
   e-mail não verificado ou sem cadastro.

**Correção proposta nas Rules** (precisa de teste no emulador antes de publicar, para não bloquear ninguém):
`identidadeConfiavel()` = e-mail terminado no domínio da empresa **e** (`email_verified == true` **ou**
`firebase.sign_in_provider == 'microsoft.com'`), usada dentro de `autenticado()`. Os testes de regra hoje usam
e-mails `@teste.local`, então a mudança vem com atualização dos testes.

## 2. XSS na impressão (ALTA — corrigido)

`imprimirEscala()` montava HTML com `login`, equipe e competência sem escapar, numa janela do mesmo domínio (que
herda a sessão). Um login com markup executaria script com a sessão de quem imprimiu (ex.: administrador) — uma
escalada de privilégio entre perfis. Corrigido: `lib/escaparHtml.ts` escapa tudo e o documento impresso leva uma CSP
que proíbe script. 4 testes, inclusive com login malicioso.

## 3. `xlsx@0.18.5` (ALTA — aberto)

Prototype pollution (CVE-2023-30533) e ReDoS (CVE-2024-22363). O pacote do npm parou em 0.18.5; as versões
corrigidas (0.20.x) são distribuídas pelo site da SheetJS. A importação de planilhas roda no navegador da liderança.
Mitigações: atualizar pela distribuição oficial da SheetJS (ou migrar para `exceljs`), limitar o tamanho do arquivo e
aceitar planilhas só de fontes conhecidas até lá.

## 4. Content-Security-Policy ausente (MÉDIA)

Há `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` e `Permissions-Policy`, mas não CSP — a principal contenção
de um XSS. Proposta, para ligar primeiro em modo **Report-Only** (só reporta no console, não bloqueia) e depois
exigir: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net;
frame-src https://*.firebaseapp.com https://login.microsoftonline.com; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'none'`. Ajustar o `connect-src` com os serviços externos que o App usa (ex.:
previsão do tempo) ao observar o relatório.

## 5. Força bruta e senhas (MÉDIA)

Não há tela de login própria a "atacar": quem tenta senhas usa a API do Firebase Auth, e a chave é pública. O Google
limita tentativas (`TOO_MANY_ATTEMPTS_TRY_LATER`), mas isso **atrasa**, não impede; não há MFA, CAPTCHA nem App Check.
Se o acesso normal é pela Microsoft, o vetor some desligando e-mail/senha. Se a senha ficar: política de senha forte,
MFA, App Check (com reCAPTCHA) e restringir a chave de API por origem e por APIs.

## 6. HTTP na VM (MÉDIA — a confirmar)

O Dashboard sai do container em HTTP. Em rede interna confiável é aceitável; se for acessível de fora, ou por Wi-Fi
não confiável, a página pode ser adulterada no caminho e capturar credenciais. Recomendado: HTTPS (proxy reverso com
certificado) e HSTS.

## 7. Dependências (MÉDIA)

`npm audit --omit=dev`: 26 (1 crítica, 12 altas). O `next` (crítica) e `postcss`/`sharp` vêm do modelo inicial: o
App e o Dashboard são builds Vite estáticos e **nenhum script inicia o servidor Next**, então não estão expostos —
mas são peso morto (remover a dependência quando o scaffold `app/` for aposentado). As avisos do `firebase`/`grpc`
são do lado Node; **não aceitar** a correção automática que sugere *rebaixar* o `firebase` para 9.14.0. Rodar
`npm audit fix` (sem `--force`) em branch de teste e a bateria completa.

## O que já está bom

- Rules cuidadosas: autoatualização só do `nome`; promoção de liderança controlada; escrita validada campo a campo;
  Admin SDK só em scripts; 456 testes de regra.
- Containers sem root (`USER 101`/`node`), `server_tokens off`, cabeçalhos básicos.
- Nenhum segredo versionado (`.gitignore` cobre `.env*` e `*.pem`; testes de fronteira proíbem chave privada em scripts).
- Sem `dangerouslySetInnerHTML`/`eval`; o único `document.write` era o do item 2.
- Opção "manter conectado" desligável e aviso para computador compartilhado.

## Ordem sugerida

1. Console: desligar sign-up, tenant único da Microsoft, e rodar `staging:auditar:contas-auth`. (minutos)
2. Rules de identidade (#1) com testes no emulador. (1 patch)
3. Atualizar/substituir `xlsx` (#3). 4. CSP em Report-Only (#4). 5. MFA/App Check/senha (#5). 6. HTTPS (#6).
