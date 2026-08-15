# Especificação — Login duplo Firebase (Microsoft Entra ID + e-mail/senha)

Documento de estado real, escrito a partir do código desta fase (AUTH-1).
Complementa `docs/spec/ADMINISTRACAO_E_HIERARQUIA.md` (perfis/autorização) e
`docs/spec/UI_CASCADE_E_HERANCA.md` (regra de CSS/cascade seguida na UI desta
fase). Substitui, para fins de arquitetura vigente, o documento de design
anterior `AUTENTICACAO-MICROSOFT.md` (que descrevia um modelo baseado em
`usuarios/{uid}` nunca implementado — o modelo real sempre foi
`usuarios/{login}`, ver `lib/firebase/authRepository.ts`).

## Métodos suportados

1. **Microsoft corporativo** — `OAuthProvider('microsoft.com')` do Firebase
   Authentication, restrito ao tenant do Entra ID via `setCustomParameters({
   tenant })`.
2. **E-mail/senha** — `signInWithEmailAndPassword`, inalterado.
3. **Demonstração** — fora do Firebase Authentication, inalterado
   (`lib/demoIdentidades.ts`, `GESTOR_DEMO`/`USUARIOS_DEMO`).

## Contrato de identidade

```
FirebaseUser.email
    -> loginDoEmail(email)      // fulano@empresa.com -> "fulano"
    -> usuarios/{login}         // Firestore, chave = login corporativo
    -> perfil/equipe/permissões // perfilEfetivo(), nivelPermiteDashboard()
```

Microsoft e e-mail/senha convergem no mesmo ponto único de resolução —
`concluirAutenticacao()` em `lib/firebase/authRepository.ts` — que por sua
vez chama a mesma `resolverUsuarioAutenticado(email)` usada desde antes desta
fase. Não existe `usuarios/{uid}`, não existe coleção paralela para
Microsoft (`usuariosMicrosoft` e afins nunca foram criados).

## Autorização

O provedor de autenticação não define permissão. Depois de resolvido o
`Usuario`, a autorização é exatamente a mesma de antes desta fase:

- Dashboard: `nivelPermiteDashboard(usuario.nivelHierarquico)`
  (`components/LoginPanel.tsx`, `components/RestauracaoSessao.tsx`) — uma
  conta Microsoft válida no tenant mas com perfil sem alçada de gestor tem a
  autenticação aceita e o acesso ao Dashboard negado, exatamente como uma
  conta e-mail/senha equivalente.
- App: nenhuma autorização adicional além de `usuarios/{login}.ativo`.
- Usuário sem `usuarios/{login}`: `MENSAGEM_SEM_PERFIL_FIRESTORE`, sessão
  Firebase encerrada (`signOut`) — não cria usuário, perfil ou vínculo de
  equipe automaticamente.
- Usuário com `ativo: false`: `MENSAGEM_PERFIL_INATIVO`, sessão encerrada.

## Segurança

- Nenhum Client Secret no frontend — o app só usa `OAuthProvider('microsoft.com')`
  do SDK público; o Client Secret fica exclusivamente na configuração do
  provider Microsoft no Firebase Console.
- Nenhum token (access token/ID token/credential) é lido, logado ou
  persistido manualmente — a sessão é inteiramente gerenciada pelo Firebase
  Auth SDK (`onAuthStateChanged`, persistence).
- `firestore.rules` não foi alterada nesta fase — não era necessário, pois
  o provider Microsoft entrega um `FirebaseUser` autenticado normal, e as
  Rules já dependem apenas da identidade resolvida (`usuarios/{login}`), não
  do provedor usado para autenticar.
- Tenant `common` é tratado como "não configurado" (`microsoftProviderConfigurado()`
  em `lib/firebase/client.ts`) — nunca aceita login de qualquer organização
  Microsoft.

## Ambientes

- **Local/emulador**: sem `VITE_MICROSOFT_ENTRA_TENANT_ID` configurado nos
  `.env.emulator*` — o botão Microsoft fica indisponível; e-mail/senha via
  emulador continua funcionando normalmente.
- **Staging**: exige, além da configuração Firebase já existente
  (`VITE_FIREBASE_AUTH_DOMAIN=escala-ici-staging.firebaseapp.com`), a
  variável `VITE_MICROSOFT_ENTRA_TENANT_ID` com o tenant real do Entra ID, e
  o provider Microsoft habilitado no Firebase Console do projeto
  `escala-ici-staging` (ação manual — ver seção abaixo).
- **Produção**: gate humano, fora do escopo desta fase — nenhuma alteração
  de produção foi feita.

## Configurações manuais pendentes (fora do escopo automatizável desta fase)

No Firebase Console do projeto de staging (`escala-ici-staging`):

1. **Authentication → Sign-in method** — habilitar o provider `Microsoft`
   (ou confirmar que já está habilitado, se o Android já o configurou para
   o mesmo projeto Firebase).
2. Preencher **Application (client) ID** e **Client secret** do App
   Registration do Entra ID no provider Microsoft do Firebase Console
   (nunca no repositório).
3. **Authentication → Settings → Authorized domains** — confirmar que o
   hostname real usado pelo PWA/Dashboard em staging
   (`escala-ici-staging.pages.dev`, ou o domínio customizado se houver) está
   na lista.
4. Definir `VITE_MICROSOFT_ENTRA_TENANT_ID` no ambiente de staging real
   (Cloudflare Pages/`.env.staging.app`/`.env.staging.dashboard`, fora do
   Git) com o Tenant ID (ou Directory ID) do Entra ID corporativo — nunca
   `common`.

Nenhuma dessas ações foi executada por esta fase (nem poderia: exige acesso
ao Firebase Console e ao Entra Admin Center, e alterar produção/staging está
fora do escopo autorizado do agente).

## Testes realizados

- **Automatizados**: `lib/firebase/authRepository.test.ts` cobre
  `criarProviderMicrosoft` (tenant aplicado / ausente),
  `entrarComMicrosoft` (convergência para `usuarios/{login}`, rejeição sem
  perfil, rejeição sem tenant configurado, rejeição sem e-mail devolvido
  pela conta Microsoft com `signOut` confirmado).
- **Visuais**: auditoria estática do cascade (ver
  `CHECKPOINT-FASE-AUTH-1-LOGIN-DUPLO-FIREBASE.md` para o detalhamento
  completo) — sem navegador disponível neste ambiente para DevTools real.
- **Staging real (Microsoft)**: pendente — depende das configurações
  manuais acima, fora do escopo desta fase.
