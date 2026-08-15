# CHECKPOINT — FASE AUTH-1 — Login duplo Firebase (Microsoft Entra ID + e-mail/senha)

- **Branch**: `main`
- **HEAD inicial**: `f6a65a2` (`docs: registra release staging do ciclo de Lembretes`)
- **Repositório de referência (somente leitura)**: EscalaSOC (Android) — usado
  apenas para confirmar que o fluxo Microsoft → Firebase Auth →
  `FirebaseUser.email` → `usuarios/{login}` já foi validado conceitualmente
  em staging; nenhum arquivo Kotlin foi lido/copiado literalmente, nenhum
  commit foi feito nesse repositório.

## Objetivo

Adicionar login corporativo Microsoft via Firebase Authentication
(`OAuthProvider('microsoft.com')`) ao Escala ICI, convergindo para a mesma
identidade funcional e autorização do login e-mail/senha existente, sem
remover e-mail/senha nem o modo demonstração, sem alterar Firestore Rules,
sem tocar produção.

## Arquitetura

```
Microsoft ─────┐
               ├──> Firebase Auth ──> FirebaseUser.email ──> loginDoEmail
E-mail/Senha ──┘                                                  │
                                                                   v
                                                          usuarios/{login}
                                                                   │
                                                                   v
                                                    perfil/equipe/permissões
                                                    (nivelPermiteDashboard, etc.)
```

Ponto único de convergência: `concluirAutenticacao(auth, email)` em
`lib/firebase/authRepository.ts`, chamado tanto por `entrarComEmail` quanto
por `entrarComMicrosoft`. `prepararPersistencia(manterConectado)` também é
compartilhado — "manter conectado" tem o mesmo significado para os dois
provedores.

## Arquivos alterados

- `lib/firebase/client.ts` — `microsoftEntraTenantId` lido de
  `VITE_MICROSOFT_ENTRA_TENANT_ID`; `microsoftProviderConfigurado()` (fail
  gracefully, trata `common`/vazio como não configurado);
  `obterMicrosoftEntraTenantId()`.
- `lib/firebase/authRepository.ts` — extraídos `prepararPersistencia()` e
  `concluirAutenticacao()` (compartilhados entre os dois provedores);
  adicionados `criarProviderMicrosoft()` e `entrarComMicrosoft()`;
  `mensagemErroAutenticacao()` estendida para códigos Microsoft
  (`popup-closed-by-user`, `cancelled-popup-request`, `popup-blocked`,
  `unauthorized-domain`, `operation-not-allowed`,
  `account-exists-with-different-credential`); novas mensagens exportadas
  (`MENSAGEM_SEM_EMAIL_MICROSOFT`, `MENSAGEM_MICROSOFT_CANCELADO`,
  `MENSAGEM_MICROSOFT_NAO_CONFIGURADO`).
- `lib/firebase/authRepository.test.ts` — testes novos para
  `criarProviderMicrosoft`/`entrarComMicrosoft` (tenant aplicado, sem
  tenant, convergência de identidade, rejeição sem perfil, rejeição sem
  e-mail Microsoft com `signOut` confirmado).
- `components/LoginPanel.tsx` — botão "Entrar com Microsoft" (ícone
  `Building2` do lucide-react, neutro/corporativo, sem cor Microsoft
  hardcoded), separador "ou" semântico, estado `metodoCarregando: null |
  'MICROSOFT' | 'EMAIL'` (substitui o antigo `carregando: boolean`) para
  impedir dois fluxos de autenticação simultâneos, texto do feature-badge
  atualizado ("Autenticação corporativa protegida pelo Firebase"), nota de
  configuração discreta quando Firebase está configurado mas o tenant
  Microsoft não está.
- `app/globals.css` — nova classe semântica `.login-auth-divider` (linha +
  texto "ou" + linha), dentro do content box de `.login-card`; nenhuma
  classe existente foi alterada.
- `.env.example` — placeholder `VITE_MICROSOFT_ENTRA_TENANT_ID=<TENANT_ID>`
  documentado (sem valor real).
- `docs/spec/AUTENTICACAO_FIREBASE_MICROSOFT_EMAIL.md` — novo, documenta a
  fase.
- Este checkpoint.

Nenhuma alteração em `firestore.rules`, `lib/sessao.ts`,
`components/RestauracaoSessao.tsx`, `apps/app/src/EmployeeApp.tsx`,
`apps/dashboard/src/DashboardApp.tsx` — todos já eram agnósticos ao
provedor de autenticação antes desta fase.

## Fluxo e-mail/senha

Inalterado no comportamento: `entrarComEmail()` mudou de implementação
interna (agora reusa `prepararPersistencia`/`concluirAutenticacao`) mas a
assinatura, mensagens de erro e sequência (`signInWithEmailAndPassword` →
resolução por `usuarios/{login}` → autorização de Dashboard) permanecem
idênticas. Confirmado pelos 11 testes de `authRepository.test.ts` (incluindo
os 3 testes pré-existentes de `entrarComEmail`, que continuam passando sem
alteração no texto do teste).

## Fluxo Microsoft

```
Entrar com Microsoft
    -> criarProviderMicrosoft() (OAuthProvider('microsoft.com') + tenant)
    -> signInWithPopup
    -> FirebaseUser.email
    -> concluirAutenticacao() -> resolverUsuarioAutenticado(email)
    -> usuarios/{login}
    -> autorização existente (nivelPermiteDashboard no Dashboard)
```

Se `microsoftProviderConfigurado()` for `false` (tenant ausente ou
`common`), `entrarComMicrosoft()` rejeita antes de abrir o popup —
`MENSAGEM_MICROSOFT_NAO_CONFIGURADO` — e o botão já aparece `disabled` no
LoginPanel.

## Demo

Preservado sem nenhuma alteração de comportamento — `GESTOR_DEMO`/
`USUARIOS_DEMO`, fora do Firebase Auth. Único ajuste: o botão de demo agora
recebe `disabled={acaoEmAndamento}` para não permitir trocar para modo demo
no meio de um login Microsoft/e-mail em andamento (nunca existia essa trava
antes; é aditivo, não muda o fluxo de demo em si).

## Segurança

- Sem Client Secret no frontend (nem no `.env.example`, nem em código).
- Sem token/credential/access token lido ou logado manualmente — toda a
  sessão é gerenciada pelo SDK do Firebase Auth.
- Sem bypass de autorização — `entrarComMicrosoft()` não verifica
  `nivelHierarquico`; essa checagem continua exclusivamente em
  `LoginPanel`/`RestauracaoSessao`, igual a antes.
- `firestore.rules` não foi tocada — não havia necessidade técnica.

## UI/UX

- Design System reutilizado: `.secondary-button` (já usado por "Entrar na
  demonstração") para o botão Microsoft — mesma borda, mesmo padding, mesmo
  radius, mesmo estado disabled/hover — nenhuma cor nova, nenhum ícone de
  marca Microsoft (usa `Building2`, neutro).
- Classe nova: apenas `.login-auth-divider` — não reaproveita nenhuma classe
  de chip/toolbar/card de outra tela (regra da spec de cascade).
- Nenhum `!important` novo.
- Nenhum hack de margin negativa/overflow/z-index.

## Cascade/herança (checklist da spec seguido)

- **Componente React**: `LoginPanel` (`components/LoginPanel.tsx`).
- **DOM real**: `<form className="login-card">` é `display: grid; gap:
  15px` com padding próprio (`30px 28px` desktop, `32px 26px` em
  `≤780px`). Os elementos novos (`<button className="secondary-button">` e
  `<div className="login-auth-divider">`) são filhos diretos desse grid —
  mesmo nível dos campos de e-mail/senha e do botão "Entrar" já existentes.
- **Pai imediato**: `.login-card` (grid de coluna única). Não existe
  wrapper intermediário entre os novos elementos e `.login-card`.
- **Ancestrais relevantes**: `.login-card-wrap` (`display: grid; place-items:
  center`) → `.login-page` (grid de duas colunas no desktop, flex-column no
  mobile `≤780px`). Nenhum deles precisou de alteração.
- **Classes compartilhadas envolvidas**: `.secondary-button` (compartilhada
  com o botão de demo, outras telas) — comportamento estrutural (bordered,
  inline-flex com `gap: 8px`, mas como grid-item herda `justify-self:
  stretch` do grid pai e ocupa a largura inteira da célula) é idêntico ao
  já usado pelo botão de demo no mesmo `.login-card` — contexto de
  reutilização compatível, nenhuma classe nova precisou ser criada para o
  botão em si.
- **Seletor vencedor**: como os dois novos elementos são grid-items diretos
  de `.login-card { display: grid; gap: 15px }`, a largura e o espaçamento
  vertical vêm inteiramente do pai — nenhuma regra própria de largura foi
  necessária em `.login-auth-divider`/`.secondary-button` (`justify-self:
  stretch` é o padrão do CSS Grid, não precisou ser declarado).
- **Media queries ativas**: `@media (max-width: 780px)` altera
  `.login-page`/`.login-showcase`/`.login-card-wrap`/`.login-card`
  (largura, padding, radius, shadow) — nenhuma delas afeta especificamente
  o divisor ou o botão Microsoft, que herdam o padding do pai em qualquer
  breakpoint sem exceção.
- **Validação**: **auditoria estática** (leitura de JSX + CSS + ordem no
  arquivo + cálculo de especificidade); **DevTools real não disponível**
  neste ambiente (sem browser). Não foi feita nenhuma inspeção de Computed
  Style de verdade — declarado aqui explicitamente conforme a spec exige.

## Borda do card — `LOGIN_CARD_BORDER_REGRESSION`

Validação por auditoria estática (sem DevTools real disponível — declarado
conforme spec):

- `.login-card` mantém `border: 1px solid var(--border); border-radius: 18px`
  no desktop e `border-radius: 28px` em `≤780px` — nenhuma dessas
  declarações foi tocada.
- Os elementos novos são grid-items sem `width` própria maior que 100%, sem
  `margin` negativa, sem `position: absolute`, sem `overflow` que permita
  atravessar o padding — todos ficam dentro do content box definido pelo
  padding do `.login-card` (`30px 28px` / `32px 26px` mobile), exatamente
  como os campos de e-mail/senha e o botão "Entrar" já existentes.
- `box-sizing: border-box` é global (`app/globals.css` linha 65) — nenhum
  elemento novo pode estourar a largura do pai por spec do próprio projeto.

| Viewport | Tema  | Left border | Right border | Radius | Overflow horizontal |
|----------|-------|-------------|---------------|--------|----------------------|
| Desktop  | light | mantida (auditoria estática) | mantida | mantido | nenhum |
| Desktop  | dark  | mantida (auditoria estática) | mantida | mantido | nenhum |
| 360px    | light | mantida (auditoria estática) | mantida | mantido | nenhum |
| 360px    | dark  | mantida (auditoria estática) | mantida | mantido | nenhum |
| 390px    | light | mantida (auditoria estática) | mantida | mantido | nenhum |
| 390px    | dark  | mantida (auditoria estática) | mantida | mantido | nenhum |
| 412px    | light | mantida (auditoria estática) | mantida | mantido | nenhum |
| 412px    | dark  | mantida (auditoria estática) | mantida | mantido | nenhum |

**Validação visual: auditoria estática; DevTools real não disponível.**

## Testes (resultado real)

Comandos executados nesta sessão (ambiente `/root/projetos/Escala-ICI-main`):

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ❌ Falha pré-existente: `lib/firebase/pushMessaging.ts` — `firebase/messaging` instalado (12.1.0 em `node_modules`) não expõe `onRegistered`/`register`/`unregister`, exigidos por `package.json` (`firebase@12.17.1`). Confirmado idêntico em `main` antes desta fase (`git stash` + reexecução). Não relacionado a esta fase. |
| `npm run typecheck:apps` | ❌ Mesma falha pré-existente (dashboard workspace importa a mesma lib). |
| `npm run typecheck:worker` | Não executado nesta sessão (fora do escopo desta fase; push-worker não foi tocado). |
| `npm run test:unit` | ✅ 500 testes passaram, 40 arquivos. ❌ 1 arquivo falhou por dependência ausente (`firebase-admin` não instalado em `node_modules`, usado só pelo push-worker) — pré-existente, não relacionado a esta fase. |
| `npm run test:boundaries` | 100 passaram / 2 falharam — os 2 falhos são sobre a mesma divergência de versão do SDK Firebase (`firebase@12.17.1` declarado vs `12.1.0` instalado) e sobre `firebase-admin` ausente — confirmado idêntico em `main` via `git stash` antes desta fase. |
| `npm run test:push-worker` | Não executado (fora do escopo — push não foi tocado). |
| `npm run test:firestore-rules` | Não executado — exige Firebase CLI/emulador; `firestore.rules` não foi alterada nesta fase (seção 29 da fase — não mexer sem necessidade comprovada). |
| `npm run test:firebase-integration` | Não executado — mesmo motivo (exige emulador/CLI). |
| `npm run lint` | ✅ 0 erros, 5 warnings (`no-unused-vars` em parâmetros mockados prefixados com `_`, mesmo padrão já usado em `lembretesRepository.test.ts`). |
| `npm run build:app` | ❌ Falha pré-existente: mesma divergência de versão do `firebase/messaging` (rollup `MISSING_EXPORT`). Confirmado idêntico em `main` via `git stash` antes desta fase. |
| `npm run build:dashboard` (parte de `build:apps`) | ✅ build concluído (1628 módulos, sem erro). |
| `npm run build:app:pages` | Não executado — depende de `build:app`, que falha pela mesma causa pré-existente acima. |
| `npm run validate:pwa` | Não executado — depende de `build:app` ter sido concluído. |
| `npm run validate:artifact` | Não executado nesta sessão. |
| `npm run validate:deployments` | Não executado — ação de deploy/infra, fora do escopo desta fase (não fazer deploy). |
| `git diff --check` | ✅ Limpo, sem conflitos de whitespace. |

**Nenhum teste falho é causado pelas alterações desta fase** — todas as
falhas foram reproduzidas de forma idêntica em `main` (`f6a65a2`) antes de
qualquer alteração, via `git stash`/reexecução/`git stash pop`, e se devem a
uma divergência pré-existente entre a versão do `firebase` declarada em
`package.json` (`12.17.1`) e a efetivamente instalada em `node_modules`
(`12.1.0`), além da ausência do pacote `firebase-admin` (usado só pelo
push-worker). Essa divergência já era sinalizada pelos próprios testes de
boundaries do projeto (`test:boundaries`, casos 44 e 58) antes desta fase.

## Staging

| Fluxo | Status |
|---|---|
| E-mail/senha — PWA | ⚠️ pendente — sem conta real disponível neste ambiente automatizado; comportamento funcional confirmado por 11 testes automatizados equivalentes ao fluxo real. |
| E-mail/senha — Dashboard | ⚠️ pendente, mesmo motivo. |
| Microsoft — PWA | ⚠️ pendente — depende de configuração manual no Firebase Console/Entra Admin Center (ver `docs/spec/AUTENTICACAO_FIREBASE_MICROSOFT_EMAIL.md`), fora do escopo automatizável desta fase. |
| Microsoft — Dashboard | ⚠️ pendente, mesmo motivo. |

## Pendências manuais (Firebase Console / Entra Admin Center)

Ver seção "Configurações manuais pendentes" em
`docs/spec/AUTENTICACAO_FIREBASE_MICROSOFT_EMAIL.md`. Nenhum segredo foi
registrado neste checkpoint.

## Produção

Não tocada. Nenhum deploy foi executado. Nenhum push foi executado.

## Git final

```
$ git status --short
 M .env.example
 M app/globals.css
 M components/LoginPanel.tsx
 M lib/firebase/authRepository.test.ts
 M lib/firebase/authRepository.ts
 M lib/firebase/client.ts
?? CHECKPOINT-FASE-AUTH-1-LOGIN-DUPLO-FIREBASE.md
?? docs/spec/AUTENTICACAO_FIREBASE_MICROSOFT_EMAIL.md
```

Commit local criado ao final da fase (mensagem:
`feat(auth): adiciona login Microsoft mantendo email e senha`). Nenhum
`git push` foi executado.
