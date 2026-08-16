# Checkpoint — Fase HIERARQUIA-1 (fonte de verdade da hierarquia organizacional)

Data: 2026-08-16. Escopo: **docs-only** — formaliza a hierarquia
organizacional do Escala ICI como documento normativo, para impedir que
implementações futuras invente, simplifique ou confunda a estrutura.
**Nenhuma alteração de código funcional.**

## Baseline (precheck)

```
pwd                              /home/vergani/projetos/Escala-ICI
git branch --show-current        main
git status --short               (vazio, exceto os dois arquivos abaixo)
git fetch origin                 ok
git status --branch --short      ## main...origin/main [ahead 4]
git rev-parse HEAD                5bb045aa2f59f8fdfb1785cc45f46430317ccfc0
git rev-parse origin/main         0c119e17f67ebf012d0b9fde398ac6199162190e
```

`ahead 4` confirmado como esperado (Fases PLANTÃO-0/1/2/3A). Nenhum
avanço remoto inesperado.

No início, a working tree tinha dois itens não relacionados a esta fase:
`packages/contrato/.sites-runtime/` (cache local, gitignored) e
`docs/spec/SPEC_34_ESCALAICI_UNIVERSAL_SETOR_TIPO_ESCALA.md` (achado
importante, ver seção "Arquivo estranho encontrado" abaixo).

## Arquivo estranho encontrado — `SPEC_34_ESCALAICI_UNIVERSAL_SETOR_TIPO_ESCALA.md`

Este arquivo **não é rastreado pelo git** e **não foi criado por esta
fase**. Ele apareceu na working tree (o usuário o abriu no editor) e
merece registro explícito porque:

1. **Descreve outro projeto/stack.** Menciona "KMP Lab commonMain",
   Gradle, MSAL, release APK, app Android — nenhum desses existe neste
   repositório (Next.js/Vite + Firebase + TypeScript). É, aparentemente,
   uma spec de um projeto irmão/paralelo (um cliente Android/Kotlin
   Multiplatform para "EscalaICI"), não deste código.
2. **Contém PII real.** A seção de exemplo de `oncall_assignments`
   (linha ~604) usa, como `memberName`, o nome completo real de uma das
   quatro pessoas que todas as fases de Plantão deste repositório vêm
   ativamente excluindo/verificando (fixture sanitizada, buscas de PII
   antes de cada commit) — **não repetido aqui de propósito**, para não
   introduzir esse nome no histórico do git também. Também usa um login
   (`lvergani`) e um nome completo que parecem ser do próprio usuário,
   como exemplo de `members`.
3. **Propõe um schema Firestore incompatível com o real** —
   `organizations`/`org_units`/`teams`/`members`/`schedule_types`/etc. —
   que não corresponde a nada implementado neste repositório
   (`unidadesOrganizacionais`/`equipes`/`usuarios`/`PerfilUsuario`, ver
   `HIERARQUIA_ORGANIZACIONAL.md`).

**Ação tomada**: o arquivo **não foi lido como fonte de verdade** para
esta fase — a auditoria (seção abaixo) partiu exclusivamente do código
real deste repositório, conforme exigido pelo pedido ("não escrever a
spec a partir de memória", "documentar primeiro o comportamento real do
código"). O arquivo **não foi adicionado ao commit** (continua
untracked). **Nenhuma ação destrutiva foi tomada sobre ele** (não foi
apagado, não foi movido) — só está sinalizado aqui, no relatório da
sessão, e no relatório final, para o usuário decidir o que fazer com um
arquivo que contém PII real numa pasta deste repositório.

## Auditoria realizada (arquivos lidos)

`docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`, `docs/spec/PLANTOES.md`,
`lib/modelos.ts`, `lib/organizacao.ts`, `lib/organizacao.test.ts`,
`lib/sessao.ts`, `firestore.rules` (seções `usuarios`/`equipes`/
`unidadesOrganizacionais`/`setores`), `lib/firebase/adminRepository.ts`,
`scripts/seed-organizacao.mjs`, `tests/app-boundaries.test.mjs`
(referências a Administração/hierarquia).

## Comportamento real do modelo — resumo

- **`unidadesOrganizacionais`**: hierarquia via `parentId` (profundidade
  arbitrária, sem limite de níveis em código), `caminho` resolvido uma
  vez na criação, nunca recalculado em Rules. `tipo` é só rótulo
  descritivo, nunca decide autorização.
- **`equipes`**: agrupamento operacional (`turnosMes.equipeId`), NÃO um
  nível da árvore de unidades. `unidadeId` opcional (compatibilidade com
  equipes antigas).
- **`usuarios`**: `login` é a identidade funcional (chave/ID do
  documento), `uid` é metadado opcional nunca necessário. `equipeId` é
  único e sem histórico — limitação real do modelo, registrada como
  divergência (não copiar para domínios novos sem análise).
- **Perfis**: `ADMIN_SISTEMA` (global), `GESTOR_UNIDADE` (escopo por
  `unidadesPermitidas`/`equipesPermitidas`), `GESTOR_EQUIPE` ==
  `SUPERVISOR_EQUIPE` (escopo por equipe), `ANALISTA_SOC` ==
  `ANALISTA_SUPORTE` (colaborador comum), `LEITURA` (reservado, hoje ==
  `ANALISTA_SOC`).
- **`unidadesPermitidas`/`equipesPermitidas`**: explícito não-vazio
  manda; ausência cai num fallback de 1 elemento; sem nenhum dos dois,
  lista vazia. Mantém todo cadastro legado funcionando sem migração.
- **`podeOperarNaEquipe()`/`podeOperarNaUnidade()`**: checam só
  pertencimento a um array explícito — **nunca percorrem `parentId`**,
  nunca checam perfil sozinhas.
- **Regra crítica formalizada** (§ 7 do novo documento): pertencimento
  (`podeOperarNaEquipe()`) não é autorização administrativa
  (`souGestor()`) — toda escrita real do projeto combina os dois; a
  Fase PLANTÃO-3A esqueceu essa combinação uma vez e foi pega pelo teste
  de Rules no emulador real.
- **Visibilidade de Plantão**: `GrupoPlantao.equipesConsulta`, sempre
  concreto (nunca fallback em tempo de leitura, ao contrário de
  `usuarios`) — decisão já tomada na PLANTÃO-3A, agora formalizada como
  regra permanente e explicada o porquê da diferença de padrão.

## Árvore parcial encontrada

Separada explicitamente em `HIERARQUIA_ORGANIZACIONAL_REFERENCIA.md` por
grau de confiança:

- **Confirmado pelo código (schema)**: coleções e tipos existem, sem
  dado de negócio específico.
- **Plano documentado no código, execução não confirmada**:
  `scripts/seed-organizacao.mjs` descreve a árvore `DIRETOR_PRESIDENTE →
  DIR_INFRA_SEGURANCA → {GEDSI → {COSI, CODB → SUPERVISOR_TI}, GESUP →
  {COSD, COAT}}` e as equipes `EQ_SOC`/`EQ_PLANTAO_COSI`/`EQ_NOC` — mas
  o script só roda em `--dry-run` por padrão, e nenhum checkpoint do
  repositório confirma que ele já foi executado com `--execute` em
  staging.
- **Informação de negócio conhecida, ainda não materializada**: relação
  Plantão de Segurança ↔ Analistas de Segurança da Informação; NOC
  podendo consultar múltiplos Plantões (não implica ver todos).
- **Não mapeado**: tudo o mais — deliberadamente deixado em branco, sem
  invenção.

## Divergências encontradas (registradas, nenhuma corrigida nesta fase)

1. Ausência de ciclo em `unidadesOrganizacionais` é enforcement só
   client-side (`formariaCiclo()`) — Rules não verificam.
2. `podeGerenciarUnidade()`/`podeGerenciarEquipe()` existem e têm teste
   dedicado, mas não são chamadas pelo Dashboard em produção (já
   documentado em `ADMINISTRACAO_E_HIERARQUIA.md`, repetido no novo
   documento por ser exatamente o tipo de duplicação que a regra do § 7
   pede para vigiar).
3. `Usuario.equipeId` único e sem histórico — limitação real, não uma
   decisão arquitetural ideal.
4. `scripts/seed-organizacao.mjs` documenta um plano nunca confirmado
   como executado em nenhum checkpoint.
5. IDs de equipe fictícios nos testes de Rules (`EQ_COSI_SOC`,
   `EQ_CODB_NOC`, `EQ_GEDSI_ADM`) não coincidem com os IDs do seed real
   (`EQ_SOC`, `EQ_NOC`) — inconsistência de nomenclatura entre fixture de
   teste e plano de seed, não um bug funcional.

Todas registradas em `HIERARQUIA_ORGANIZACIONAL.md` § 15, com arquivo,
comportamento e recomendação (nenhuma correção de código foi feita).

## Integração conceitual com Plantões

Seção 9 do novo documento formaliza, como regra normativa nova: a
hierarquia organizacional **não decide sozinha** quais Grupos de Plantão
um usuário consegue consultar — cada Grupo carrega sua própria
`equipesConsulta`, data-driven, nunca inferida por `parentId`/cargo. Isso
não é uma mudança de comportamento (a PLANTÃO-3A já implementou
exatamente assim) — é a formalização explícita do porquê, para que uma
futura UI de configuração ou uma leitura apressada do código não tente
"otimizar" isso para uma inferência automática pela árvore.

`docs/spec/PLANTOES.md` foi atualizado para referenciar explicitamente o
novo documento logo na introdução, e para deixar claro que qualquer sigla
usada nos exemplos (COSI/SOC/NOC) é ilustrativa — revisão confirmou que o
documento já evitava, desde a Fase PLANTÃO-0, qualquer trecho que desse a
entender inferência automática de visibilidade pela hierarquia; nenhuma
reformulação de conteúdo foi necessária além da referência cruzada.

## Arquivos criados

- `docs/spec/HIERARQUIA_ORGANIZACIONAL.md` — normativo.
- `docs/spec/HIERARQUIA_ORGANIZACIONAL_REFERENCIA.md` — snapshot parcial
  e evolutivo, não normativo.
- `CHECKPOINT-FASE-HIERARQUIA-1-FONTE-DE-VERDADE.md` — este documento.

## Arquivos alterados

- `docs/spec/PLANTOES.md` — parágrafo novo na introdução, referenciando
  `HIERARQUIA_ORGANIZACIONAL.md` e reforçando que siglas são exemplo, não
  regra.
- `docs/spec/ADMINISTRACAO_E_HIERARQUIA.md` — parágrafo novo apontando
  para `HIERARQUIA_ORGANIZACIONAL.md` como fonte da semântica normativa;
  nenhuma contradição documental encontrada que exigisse correção além da
  referência.

Nenhum outro arquivo foi tocado.

## Confirmação docs-only

```
git diff --stat -- apps/dashboard/src/DashboardApp.tsx apps/app/ \
  lib/modelos.ts lib/organizacao.ts lib/sessao.ts \
  lib/firebase/ firestore.rules firestore.indexes.json \
  packages/contrato/src/parser.ts packages/contrato/src/parserPlantao.ts \
  apps/push-worker/
```

Vazio — confirmado diff zero em todos os arquivos de código listados como
protegidos pelo pedido desta fase.

## Testes (confirmação de baseline, sem alteração)

```
npm run typecheck           OK
npm run typecheck:apps      OK
npm run typecheck:worker    OK
npm run test:unit           636/636 (inalterado)
npm run test:boundaries     115/115 (inalterado)
npm run test:firestore-rules 144/144 (inalterado)
npm run lint                0 erros, 5 warnings pré-existentes (inalterado)
git diff --check            limpo
```

Nenhum número mudou em relação à baseline informada no início da fase —
esperado, já que nenhum código/teste foi alterado.

## Próxima fase prevista

PLANTÃO-3B — integração de UI (Dashboard passa a chamar
`plantaoReadRepository`/`plantaoWriteRepository` de verdade), conforme já
prevista ao final da Fase PLANTÃO-3A. Esta fase (HIERARQUIA-1) não inicia
PLANTÃO-3B.

## Git

Commit local criado (mensagem `docs(org): formaliza hierarquia
organizacional e escopos`). **Nenhuma alteração funcional. Nenhum push.
Nenhum deploy. Firebase não foi alterado. Dashboard não foi alterado. App
não foi alterado. Produção não foi tocada.**
