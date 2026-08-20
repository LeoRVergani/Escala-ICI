# Specs oficiais — Escala ICI

Esta pasta concentra a fonte normativa atual do projeto. Checkpoints e arquivos de entrega são histórico: eles ajudam a entender o que foi feito, mas não substituem as specs listadas aqui.

## Ordem de leitura para alterações no Dashboard

1. `ESCALA_ICI_MASTER_SPEC.md` — índice funcional e decisões consolidadas do Dashboard.
2. `WIZARD_PREPARAR_ESCALA.md` — fluxo unificado de `Nova escala` e `Importar escala`.
3. `VISAO_GERAL_OPERACIONAL_SOC_PLANTAO.md` — Visão geral operacional SOC + Plantão.
4. `JORNADA_6X1_ASSISTENTE_CICLO.md` — grade Jornada 6x1 e assistente de ciclo inicial.
5. `REVISAO_JORNADA_6X1_LAYOUT_CALENDARIO.md` — revisão/importação SOC com calendário central ampliado.
6. `PLANTAO_MODAL_D.md` — modal visual de atribuição de Plantão, presets e exceção manual.
7. `NAVEGACAO_RETORNO_ESCALAS.md` — padrão de retorno visual para Escalas.
8. `UI_CASCADE_E_HERANCA.md` — regra permanente para alterações de CSS/layout.

## Specs herdadas ainda válidas por domínio

- `HIERARQUIA_ORGANIZACIONAL.md` — domínio organizacional, permissões e regra de não hardcode.
- `ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` — escopo administrativo de `GESTOR_UNIDADE` sobre Unidades/Equipes/Grupos de Plantão (`lib/escoposOperacionais.ts`); mudança de regra aprovada na Fase ESCOPO-GESTOR-UNIDADE-1 — `GESTOR_UNIDADE` agora administra Plantão dentro do seu escopo de unidade. § 9 (Fase PROVISIONAMENTO-GRUPO-PLANTAO-1) — provisionamento oficial de `GrupoPlantao` pelo produto/seed, nunca pelo Console do Firestore.
- `ADMINISTRACAO_E_HIERARQUIA.md` — fluxos administrativos atuais e matriz de permissões.
- `AUTENTICACAO_FIREBASE_MICROSOFT_EMAIL.md` — login Microsoft/e-mail e identidade por `usuarios/{login}`.
- `LEMBRETES.md` — módulo de Lembretes, separado de Escalas.
- `TROCA_ESCALA_PLANO.md` — módulo de Trocas no estado atual.
- `PLANTOES.md` e `EDITOR_ESCALAS.md` — contêm histórico e detalhes de domínio anteriores; para UI nova de Plantão/Jornada, preferir as specs novas acima.

## Decisões que não devem regredir

- `Nova escala` e `Importar escala` usam o mesmo wizard.
- O fluxo escolhe primeiro `Jornada 6x1` ou `Plantão`.
- Upload de planilha só aparece após tipo, destino e competência.
- O destino Jornada é uma `Equipe`; o destino Plantão é um `GrupoPlantao`.
- Área ativa é contexto de trabalho, não autorização nova.
- Não usar `usuario.equipeId` sozinho para decidir gestão.
- Não permitir self-escalation.
- Não hardcodar `COSI`, `SOC`, `NOC`, `CODB`, `GEDSI`, `EQ_SOC`, `EQ_PLANTAO_COSI` ou `EQ_SEG` como regra de negócio.
- Quick-add/Modal de Plantão deve oferecer Noturno `19:00 → 07:00`, `5 horas` `19:00 → 00:00`, `24 horas` `19:00 → 19:00` e exceção manual.
- Dados importados atípicos são preservados; a UI pode alertar, mas não normalizar silenciosamente.
- Nenhuma versão estável (staging ou produção) pode depender de criação manual de `gruposPlantao/{grupoId}` pelo Console do Firestore — o produto (Wizard/Administração) e o seed (`scripts/seed-organizacao.mjs`) sempre oferecem um caminho oficial.
- Uma Equipe existir (mesmo com "Plantão" no nome) nunca implica que existe um `GrupoPlantao` — o seletor superior só mostra Plantões a partir de Grupo administrável.
