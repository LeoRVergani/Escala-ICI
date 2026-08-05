# Preparação — futura autenticação Microsoft / Entra ID

Documento de design. **Nada aqui está implementado.** Serve para que a
Fase 3K-D2C (vínculo Auth UID ↔ `usuarios/{uid}`) já nasça compatível com um
segundo provedor de login, sem exigir uma reescrita do modelo de usuário
quando esse dia chegar.

## Por que isso importa agora

O bug corrigido nesta fase (CHECKPOINT-FASE-3K-D2C) mostrou o risco de
depender só do UID do provedor de autenticação como chave: se o UID mudar de
mãos (troca de provedor, recriação de conta, migração), qualquer parte do
sistema que assuma "UID do Authentication = ID do documento em `usuarios`"
quebra. Login por Microsoft é exatamente esse cenário: o UID do Firebase
Authentication para uma conta federada via Microsoft/Entra ID é **diferente**
do OID (Object ID) da conta no Entra ID, e diferente do UID que a mesma
pessoa pode ter hoje com e-mail/senha.

## O que já está pronto para reaproveitar

- `usuarios/{uid}` continua sendo a chave primária de leitura (Firestore
  Rules já exigem `request.auth.uid == uid` ou `souGestor()` — nenhuma regra
  nova seria necessária só por trocar o provedor);
- `vincularUsuarioAoUid()` (Fase 3K-D2C) já resolve exatamente o problema de
  "preciso migrar um cadastro para um novo UID sem apagar nada" — o mesmo
  fluxo do Dashboard serviria para vincular alguém que hoje entra por
  e-mail/senha e passará a entrar por Microsoft;
- `Usuario.aliasesPlanilha`, `Usuario.login`, `Usuario.email` já existem como
  identificadores alternativos (usados hoje pela conciliação de importação,
  Fase 3K-D2) — a mesma ideia de "várias formas de apontar para a mesma
  pessoa" se estende para OID do Microsoft.

## O que mudaria

### 1. Novo campo em `Usuario`

```ts
microsoftOid?: string | null;
```

Preenchido pelo Dashboard quando o gestor souber o Object ID da conta no
Entra ID (mesma mecânica de "colar o identificador conhecido" que
`uidAutenticacao` já usa na criação de usuário).

### 2. Resolução em cascata no login

Hoje `resolverUsuarioAutenticado(uid)` (`lib/firebase/authRepository.ts`) só
tenta `usuarios/{uid}`. Com múltiplos provedores, a ordem de resolução
deveria ser:

1. `usuarios/{auth.uid}` — igual a hoje, cobre quem já está com o UID certo;
2. se não existir, consulta por `where('microsoftOid', '==', <oid extraído
   do token Microsoft>)` — cobre quem logou pela primeira vez via Microsoft
   mas o cadastro ainda está com o UID antigo (e-mail/senha);
3. se ainda não existir, consulta por `where('email', '==', <e-mail
   corporativo do token>)` — último recurso, exige e-mail corporativo
   único por pessoa (já é a convenção do projeto);
4. se nada resolver, mesma mensagem de hoje
   (`MENSAGEM_SEM_PERFIL_FIRESTORE`), pedindo para o gestor vincular pelo
   Dashboard.

Passos 2 e 3 exigem **índices compostos** novos em `firestore.indexes.json`
(`microsoftOid` e `email`, escopados por `equipeId` se a consulta precisar
ficar restrita a uma equipe) e uma regra de leitura que permita a própria
pessoa consultar por esses campos antes de saber seu `uid` definitivo — hoje
as regras de `usuarios` autorizam leitura por `request.auth.uid == uid`, o
que não serve para uma consulta por `microsoftOid`/`email` feita **antes**
de se saber qual documento é o certo. Isso provavelmente exigiria uma Cloud
Function ou uma regra específica e cuidadosamente restrita — decisão de
segurança que precisa de análise própria quando a hora chegar, não decidida
neste documento.

### 3. Com escala e sem escala

Sem mudança de comportamento: uma vez resolvido o `Usuario`, o restante do
fluxo (`carregarMinhaEscala`, mensagens de "nenhuma escala publicada para o
período") já é agnóstico a como a pessoa autenticou. O único ajuste de
mensagem seria no próprio texto de "sem perfil", que poderia mencionar
"contate o gestor para vincular seu acesso Microsoft" quando o login vier
claramente de um provedor federado (`credencial.providerId` do Firebase Auth
já informa isso).

### 4. Cadastro pelo Dashboard

A tela **Usuários** ganharia um campo opcional "OID do Microsoft/Entra ID"
ao lado do já existente "UID de autenticação (opcional)" — mesmo padrão,
mesmo aviso de que o campo não pode ser alterado depois de definido sem
passar pelo fluxo de vínculo.

## Não fazer ainda

- Não configurar o provedor Microsoft no Firebase Authentication;
- não criar os índices compostos citados acima;
- não mudar Firestore Rules;
- não implementar a consulta em cascata — este documento existe para que a
  implementação futura tenha um ponto de partida claro, não para ser código
  morto no repositório hoje.
