# Limpeza de usuários fictícios no Firebase staging

## Objetivo

Depois que a equipe real e a escala real já foram cadastradas em
`escala-ici-staging`, este processo identifica e remove usuários
fictícios/demo (e os documentos associados a eles) que ficaram do período de
testes — sem risco de apagar gestor, colaborador real ou de rodar contra o
projeto errado.

Ferramentas:
- `scripts/cleanup-staging-allowlist.txt` — lista de logins reais que nunca
  devem ser tocados.
- `scripts/cleanup-staging-demo-data.mjs` — script de dry-run/execução.

## Como a gestora/gestor é protegido

Nenhuma conta de gestor é apagada, mesmo que não esteja na allowlist. A
proteção é automática, por três caminhos independentes (qualquer um já
basta):

1. **`nivelHierarquico <= 5`** — o mesmo limiar que `souGestor()` usa nas
   Firestore Rules e `nivelPermiteDashboard()` usa no código do Dashboard.
2. **`cargo` contém** "gestor", "coordenador", "gerente", "admin" ou
   "administrador" (comparação sem diferenciar maiúsculas/minúsculas).
3. **É o próprio usuário autenticado** executando o script — a conta usada
   para logar (`ESCALA_CLEANUP_EMAIL_GESTOR`) nunca é candidata a exclusão,
   mesmo que, por algum motivo, as duas checagens acima falhassem.

Além disso, o script **se recusa a rodar** se a conta autenticada não for,
ela mesma, de um gestor (`nivelHierarquico <= 5`) — ele não tenta prosseguir
"mesmo assim" com um perfil de colaborador comum.

## Como preencher a allowlist

Edite `scripts/cleanup-staging-allowlist.txt`: um login corporativo real por
linha (o mesmo valor usado como ID do documento `usuarios/{login}` — sem
`@` nem domínio de e-mail). Linhas vazias e linhas começando com `#` são
ignoradas.

```
# comentário livre
lvergani
luizneto
cestradioto
```

A allowlist protege **colaboradores reais comuns** (`nivelHierarquico > 5`,
sem cargo de gestão) — quem já é gestor está protegido de qualquer jeito,
não precisa estar na lista. Um usuário fora da allowlist e sem nenhum sinal
de gestor é tratado como candidato à exclusão.

**Importante**: o arquivo não pode ficar vazio. Uma allowlist vazia não
protege ninguém, então o script recusa rodar (erro explícito) até que pelo
menos um login real seja adicionado.

## Variáveis de ambiente necessárias

Em `.env.staging.dashboard` (o mesmo arquivo já usado pelo Dashboard em
staging — real, nunca commitado), além das `VITE_FIREBASE_*` já existentes,
adicione:

```
ESCALA_CLEANUP_EMAIL_GESTOR=marina.azevedo@empresa.com
ESCALA_CLEANUP_SENHA_GESTOR=...
```

Essa conta precisa ser de um gestor real (`nivelHierarquico <= 5`) — o
script autentica com ela via SDK cliente do Firebase (o mesmo usado pelo
Dashboard/App), **sem Admin SDK e sem service account**, seguindo a mesma
política já adotada em `scripts/migrate-usuarios-login.mjs` e documentada em
`deploy/firebase-staging/README.md`.

## Comando dry-run (não apaga nada)

```
node scripts/cleanup-staging-demo-data.mjs --dry-run
```

Mostra, sem gravar nada no Firestore:
- **A. Usuários protegidos** — login, nome, motivo (`allowlist` / `gestor`
  / `usuario_autenticado`).
- **B. Usuários candidatos à exclusão** — login, nome, equipeId, ativo,
  nivelHierarquico.
- **C. Documentos que seriam excluídos** (permitido pelas regras atuais):
  `turnosMes` e `rascunhosTurnosMes` dos candidatos.
- **C-bis. Documentos candidatos, mas bloqueados pelas regras** (`allow
  delete: if false`): `usuarios`, `trocasEscala`; `notificacoesTroca` nem
  consegue ser listada (ver seção de proteções abaixo).
- **D. Documentos só para revisão manual** (nunca apagados automaticamente):
  `eventosEscala`, `versoesEscala`, `historicoPublicacoes`,
  `publicacoesEscala`.
- O aviso final: **"DRY-RUN: nada foi apagado."**

Revise a lista de candidatos com atenção antes de considerar o `--execute`.

## Comando de execução real

```
node scripts/cleanup-staging-demo-data.mjs --execute --confirm=LIMPAR_STAGING
```

Sem os dois flags exatos (`--execute` **e** `--confirm=LIMPAR_STAGING`), o
script recusa gravar qualquer coisa.

**O que o `--execute` apaga de fato hoje**: só `turnosMes` e
`rascunhosTurnosMes` dos usuários candidatos — é só isso que as Firestore
Rules atuais permitem a um gestor apagar. Ao final, mostra a contagem real
por coleção e a mensagem **"Limpeza concluída em staging."**, junto com um
aviso de que `usuarios`/`trocasEscala`/`notificacoesTroca` continuam
existindo.

## Proteções obrigatórias (nunca são contornadas)

- Nunca roda fora do projeto `escala-ici-staging` — bloqueia explicitamente
  qualquer ID contendo "prod", igual a `escala-ici-producao`, ou qualquer
  outro projectId diferente do exato esperado. Também passa pelo preflight
  geral de staging (`scripts/firebase-preflight-lib.mjs`), que já rejeita
  qualquer projeto que não termine em `-staging`/`-hml`/`-homolog`.
- Nunca apaga gestor, coordenador, gerente ou administrador (ver seção
  acima).
- Nunca apaga a conta autenticada executando o script.
- Nunca apaga quem estiver na allowlist.
- Nunca tenta apagar sem antes mostrar o relatório completo em dry-run.
- Nunca apaga uma coleção inteira — sempre filtra por `equipeId` (a equipe
  do gestor autenticado) e por login candidato específico.
- Nunca escreve nas coleções `config`, `equipes` ou `tiposTurno`.
- Nunca tenta burlar uma regra com `allow delete: if false` — só reporta
  como bloqueado.
- Não altera `firestore.rules`, não usa Admin SDK, não cria service
  account.

## Coleções afetadas

| Coleção | O que o script faz |
| --- | --- |
| `usuarios` | Só leitura (classificação); exclusão real bloqueada pelas rules — reportada, nunca tentada. |
| `turnosMes` | Lida e **apagada de fato** (no `--execute`) para os candidatos. |
| `rascunhosTurnosMes` | Lida e **apagada de fato** (no `--execute`) para os candidatos. |
| `trocasEscala` | Lida (para o relatório); exclusão real bloqueada pelas rules — reportada, nunca tentada. |
| `notificacoesTroca` | **Nem consegue ser lida** para outro usuário — a regra só permite ao próprio destinatário ler a própria notificação, nem o gestor lista a de outra pessoa. Aparece no relatório como bloqueada para leitura. |
| `eventosEscala` | Só listagem para revisão manual. |
| `versoesEscala` | Só listagem para revisão manual. |
| `historicoPublicacoes` | Só contagem da equipe para revisão manual (é agregado por competência, não por colaborador). |
| `publicacoesEscala` | Só contagem da equipe para revisão manual. |
| `config`, `equipes`, `tiposTurno` | Nunca tocadas. |

## O que não é apagado automaticamente nesta fase

- `usuarios/{login}` dos candidatos — bloqueado pelas Firestore Rules
  (`allow delete: if false`). Remover manualmente pelo Firebase Console é a
  única forma hoje, ou decidir separadamente se vale abrir essa permissão
  numa fase futura (fora do escopo deste script).
- `trocasEscala` e `notificacoesTroca` relacionadas aos candidatos — mesmo
  motivo.
- `eventosEscala`, `versoesEscala`, `historicoPublicacoes`,
  `publicacoesEscala` — mesmo quando a regra permitiria apagar, o critério
  de "pertence a este usuário fictício" não é claro e seguro o bastante
  nestes agregados (alguns são por competência inteira, não por
  colaborador) para automatizar. Ficam só como lista para revisão manual.

## Escopo: uma equipe por vez

O script autentica como um gestor real e respeita as Firestore Rules — por
isso só alcança a equipe desse gestor (`equipeId == minhaEquipe()`), nunca
a base inteira de uma vez. Para limpar mais de uma equipe, rode o script
uma vez por gestor/equipe (mesmo padrão já usado em
`scripts/migrate-usuarios-login.mjs`).
