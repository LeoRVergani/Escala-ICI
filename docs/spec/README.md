# Specs oficiais — Escala ICI

Esta pasta concentra a fonte normativa atual do projeto. Checkpoints e arquivos de entrega são histórico: eles ajudam a entender o que foi feito, mas não substituem as specs listadas aqui.

## Ordem de leitura para alterações no Dashboard

1. `ESCALA_ICI_MASTER_SPEC.md` — índice funcional e decisões consolidadas do Dashboard.
2. `ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md` — árvore organizacional sanitizada de referência para cadastro, navegação, filtros e contexto; não autoriza escala.
3. `ESCOPO_OPERACIONAL_MATRIZ.md` — matriz explícita de responsáveis por Jornada/Plantão; organograma/cargo/unidade são contexto, não autorização operacional automática.
4. `WIZARD_PREPARAR_ESCALA.md` — fluxo unificado de `Nova escala` e `Importar escala`.
5. `VISAO_GERAL_OPERACIONAL_SOC_PLANTAO.md` — Visão geral operacional SOC + Plantão.
6. `JORNADA_6X1_ASSISTENTE_CICLO.md` — grade Jornada 6x1 e assistente de ciclo inicial.
7. `REVISAO_JORNADA_6X1_LAYOUT_CALENDARIO.md` — revisão/importação SOC com calendário central ampliado.
8. `PLANTAO_MODAL_D.md` — modal visual de atribuição de Plantão, presets e exceção manual.
9. `NAVEGACAO_RETORNO_ESCALAS.md` — padrão de retorno visual para Escalas.
10. `UI_CASCADE_E_HERANCA.md` — regra permanente para alterações de CSS/layout.

## Specs herdadas ainda válidas por domínio

- `HIERARQUIA_ORGANIZACIONAL.md` — domínio organizacional, permissões e regra de não hardcode.
- `ESTRUTURA_ORGANIZACIONAL_REFERENCIA.md` — estrutura organizacional de referência do produto, com níveis, unidades, siglas e regras sanitizadas para cadastro/contexto.
- `ESCOPO_OPERACIONAL_MATRIZ.md` — fonte normativa atual para quem administra ou apenas consulta cada Jornada/Plantão.
- `ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` — escopo administrativo de `GESTOR_UNIDADE` sobre Unidades/Equipes/Grupos de Plantão (`lib/escoposOperacionais.ts`). A autorização operacional por unidade desta spec agora é **Regra transitória / fallback de compatibilidade** quando não existir matriz explícita para o alvo.
- `ADMINISTRACAO_E_HIERARQUIA.md` — fluxos administrativos atuais e matriz de permissões.
- `AUTENTICACAO_FIREBASE_MICROSOFT_EMAIL.md` — login Microsoft/e-mail e identidade por `usuarios/{login}`.
- `LEMBRETES.md` — módulo de Lembretes, separado de Escalas.
- `TROCA_ESCALA_PLANO.md` — módulo de Trocas no estado atual.

Nota ESCOPO-OPERACIONAL-MATRIZ-1: a tela **Administração → Responsáveis por
escala** é a interface normativa para configurar responsáveis. Seed/fixture
serve só para bootstrap idempotente; colaboradores são carregados da equipe
da escala; `GrupoPlantao ativo:false` não influencia seletor, Wizard nem
destino operacional de Equipe.

Nota ESCOPO-OPERACIONAL-MATRIZ-1.1: responsável humano de escala precisa ser
usuário ativo com perfil `ADMIN_SISTEMA`, `GESTOR_UNIDADE`, `GESTOR_EQUIPE`
ou `SUPERVISOR_EQUIPE`. Analista/técnico comum não aparece como responsável;
exceções são resolvidas por promoção de perfil, não por hardcode. Separar
sempre Responsáveis, Equipes administradoras e Equipes que consultam.
- `PLANTOES.md` e `EDITOR_ESCALAS.md` — contêm histórico e detalhes de domínio anteriores; para UI nova de Plantão/Jornada, preferir as specs novas acima.

## Decisões que não devem regredir

- `Nova escala` e `Importar escala` usam o mesmo wizard.
- O fluxo escolhe primeiro `Jornada 6x1` ou `Plantão`.
- Upload de planilha só aparece após tipo, destino e competência.
- O destino Jornada é uma `Equipe`; o destino Plantão é um `GrupoPlantao`.
- Área ativa é contexto de trabalho, não autorização nova.
- Não usar `usuario.equipeId` sozinho para decidir gestão.
- Não permitir self-escalation.
- Não deduzir responsabilidade operacional de escala apenas por organograma, cargo/função, unidade pai ou equipe do usuário.
- Não listar analista/técnico comum, usuário inativo ou usuário sem perfil de gestão como responsável humano de escala.
- Não confundir Responsáveis, Equipes administradoras e Equipes que consultam.
- `equipesConsulta` permite consulta/monitoramento, nunca edição.
- `GrupoPlantao ativo:false` não aparece em seletor operacional ou Wizard; aparece somente na Administração com badge Inativo.
- Não hardcodar `COSI`, `SOC`, `NOC`, `CODB`, `GEDSI`, `EQ_SOC`, `EQ_PLANTAO_COSI` ou `EQ_SEG` como regra de negócio.
- Quick-add/Modal de Plantão deve oferecer Noturno `19:00 → 07:00`, `5 horas` `19:00 → 00:00`, `24 horas` `19:00 → 19:00` e exceção manual.
- Dados importados atípicos são preservados; a UI pode alertar, mas não normalizar silenciosamente.
- Nenhuma versão estável (staging ou produção) pode depender de criação manual de `gruposPlantao/{grupoId}` pelo Console do Firestore — o produto (Wizard/Administração) e o seed (`scripts/seed-organizacao.mjs`) sempre oferecem um caminho oficial.
- Uma Equipe existir (mesmo com "Plantão" no nome) nunca implica que existe um `GrupoPlantao` — o seletor superior só mostra Plantões a partir de Grupo administrável.
