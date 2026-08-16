# Hierarquia Organizacional — referência parcial e evolutiva

**Este documento NÃO é normativo.** A semântica (o que é uma Unidade, uma
Equipe, um perfil, como autorização funciona) está em
`docs/spec/HIERARQUIA_ORGANIZACIONAL.md` — leia aquele primeiro. Este
arquivo é só um **snapshot do que está de fato cadastrado, planejado ou
comentado no código nesta data**, separado explicitamente por grau de
confiança. Ele muda com frequência e não deve ser citado como regra.

**A estrutura aqui descrita é uma fração pequena da organização real do
ICI.** Nunca interpretar a ausência de um nó aqui como "esse nó não existe
no ICI real" — só significa que ele ainda não foi cadastrado/confirmado no
Escala ICI.

---

## 1. Confirmado pelo código (schema, sem dado de negócio)

O que existe **de fato**, como estrutura (não como dado específico):

- Coleção `unidadesOrganizacionais` — schema `UnidadeOrganizacional`
  (`lib/modelos.ts:151-170`), hierarquia via `parentId`.
- Coleção `equipes` — schema `Equipe` (`lib/modelos.ts:105-120`),
  `unidadeId` opcional.
- Coleção `usuarios` — schema `Usuario` (`lib/modelos.ts:39-103`),
  `equipeId` obrigatório, único, sem histórico.
- Coleção `setores` — schema legado `Setor` (`lib/modelos.ts:128-133`),
  mantido por compatibilidade, não referenciado por
  `usuarios`/`equipes`/`turnosMes`.
- Perfis administrativos implementados: `ADMIN_SISTEMA`, `GESTOR_UNIDADE`,
  `GESTOR_EQUIPE`, `SUPERVISOR_EQUIPE`, `ANALISTA_SOC`,
  `ANALISTA_SUPORTE`, `LEITURA` (reservado).
- Domínio de Plantão: `gruposPlantao`, subcoleção `participantes`,
  `rascunhosCompetenciasPlantao`/`competenciasPlantao`,
  `docs/spec/PLANTOES.md`.

## 2. Plano de hierarquia real — documentado no código, execução não confirmada

Fonte: `scripts/seed-organizacao.mjs` (comentário no topo do arquivo e
constantes `UNIDADES_SEM_CAMINHO`/`EQUIPES_SEM_CAMINHO`). O script roda em
**`--dry-run` por padrão** e exige aprovação explícita (`--execute
--confirm=SEED_ORGANIZACAO_STAGING`) — **esta auditoria não encontrou
nenhuma referência, em nenhum checkpoint do repositório, confirmando que
ele já foi de fato executado em staging.** Tratar como plano documentado,
não como estado confirmado do Firestore real.

```
DIRETOR_PRESIDENTE (raiz, tipo PRESIDENCIA)
  └── DIR_INFRA_SEGURANCA (DIRETORIA — "Diretoria de Infraestrutura e Segurança da Informação")
        ├── GEDSI (GERENCIA — "Gerência de Data Center e Segurança da Informação")
        │     ├── COSI (COORDENACAO)
        │     └── CODB (COORDENACAO)
        │           └── SUPERVISOR_TI (SUPERVISAO — "Supervisor de TI")
        └── GESUP (GERENCIA — "Gerência de Suporte Técnico")
              ├── COSD (COORDENACAO)
              └── COAT (COORDENACAO)
```

Equipes planejadas no mesmo script (vínculo direto de escala,
`turnosMes.equipeId`):

| Equipe (`id`) | Nome | Unidade (`unidadeId`) |
| --- | --- | --- |
| `EQ_SOC` | SOC | `COSI` |
| `EQ_PLANTAO_COSI` | Plantão COSI | `COSI` |
| `EQ_NOC` | NOC | `SUPERVISOR_TI` |

Convenção documentada no script (comentário, `scripts/seed-organizacao.mjs:35-39`)
para equipes homônimas em coordenações diferentes — **exemplo ilustrativo,
não semeado**: prefixar o ID com a coordenação (`EQ_COSD_TECNICO_N2` vs.
`EQ_COAT_TECNICO_N2`) quando o mesmo cargo ("Técnico N2") existe em mais
de uma coordenação.

## 3. Informação de negócio conhecida (conversas/specs anteriores), ainda não materializada como cadastro

- O Plantão de Segurança (`docs/spec/PLANTOES.md`) é composto pelos
  Analistas de Segurança da Informação — a fixture sanitizada da Fase
  PLANTÃO-1 usa nomes fictícios (`Ana Costa`, `Bruno Lima`, `Carlos
  Nunes`, `Daniela Rocha`) para representar esse grupo; nenhum
  `gruposPlantao` real foi criado ainda (persistência é PLANTÃO-3B/3C).
- O NOC pode precisar consultar Plantões de mais de uma área (Segurança,
  Banco, Infraestrutura) — mas isso **não significa "NOC vê todos os
  Plantões"**: cada Grupo define explicitamente, via `equipesConsulta`,
  se o NOC está autorizado a consultá-lo (ver
  `HIERARQUIA_ORGANIZACIONAL.md` § 9). Nenhuma dessas relações está
  cadastrada hoje — é conhecimento de negócio à espera do cadastro real.
- Equipes de teste usadas em `tests/firebase/firestore.rules.test.ts`
  (`EQ_COSI_SOC`, `EQ_CODB_NOC`, `EQ_GEDSI_ADM`) são **fictícias**,
  criadas só para exercitar as Rules — não correspondem 1:1 aos IDs do
  seed real listado acima (divergência de nomenclatura já registrada em
  `HIERARQUIA_ORGANIZACIONAL.md` § 15).

## 4. Não mapeado

Tudo o que não está nas seções 1–3 acima. Isso inclui, quase certamente:

- A cadeia de comando acima de "Diretor Presidente" (se existir).
- Qualquer diretoria/gerência/coordenação do ICI fora do ramo de
  Infraestrutura e Segurança/Suporte Técnico (RH, Financeiro, Jurídico,
  outras diretorias técnicas, etc.).
- Equipes operacionais fora de SOC/Plantão COSI/NOC.
- Qualquer usuário real, cargo real ou vínculo real além do que já está
  cadastrado em `usuarios` no ambiente de staging (fora do escopo desta
  auditoria documental — não consultado aqui).

**Não inventar nenhum nó para preencher esta seção.** Ausência aqui é
esperada e correta — reflete o estado real do cadastro, não uma falha de
documentação.

## 5. Nomes reais — nota de privacidade

Este documento e `HIERARQUIA_ORGANIZACIONAL.md` usam exclusivamente **IDs
técnicos, siglas e nomes fictícios de teste** (os mesmos já usados em
`tests/firebase/firestore.rules.test.ts` e nas fixtures do domínio de
Plantão). Nenhum nome de colaborador real do ICI foi usado como exemplo em
nenhum dos dois documentos — mesma disciplina de privacidade já aplicada
às fixtures sanitizadas de Plantão (`docs/spec/PLANTOES.md`).
