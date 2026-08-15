# Especificação — Plantões (arquitetura, Fase PLANTÃO-0)

Documento de **planejamento arquitetural**, não de estado implementado. Nada
aqui está construído no código de produção — nenhuma coleção nova, nenhuma
Rule nova, nenhum schema persistido. É a fonte de verdade para as fases
seguintes (PLANTÃO-1 em diante), formalizando decisões de domínio antes de
qualquer linha de código funcional.

Segue a mesma convenção dos demais documentos de `docs/spec/`: aponta para
evidência real do código quando descreve o que já existe hoje (para não
confundir "estado atual" com "proposta futura"), e é explícito quando está
descrevendo algo que **ainda não existe**.

## Por que este documento existe

O Escala ICI hoje resolve um problema: **jornada normal 6x1** (SOC/NOC),
codificada em `packages/contrato/src/*` e `lib/modelos.ts`, com parser
próprio (`parsePlanilhaEscala`, `packages/contrato/src/parser.ts:501`),
catálogo de códigos (`MD`, `M`, `T`, `N`, `DU`, `DF` e equivalentes,
`packages/contrato/src/catalogo.ts`) e regras de descanso/6x1
(`lib/alertasEscala.ts`).

Existe uma segunda planilha real, de estrutura completamente diferente
("Plantonista Segurança", "Data Inicio", "Data Fim"), representando
**responsabilidade operacional fora da rotina normal** — plantão de
segurança/COSI e afins. Tratar isso como uma variação da escala 6x1 seria
forçar um domínio dentro do outro; ambos precisam de identidade própria.

## 1. Dois domínios, não um

```
ESCALA DE JORNADA                    PLANTÃO
------------------                   -------
Jornada normal do colaborador         Responsabilidade/disponibilidade
Códigos MD/M/T/N/DU/DF                operacional fora da rotina
Regras de descanso/6x1                Pode coexistir com a jornada normal
Hoje: SOC/NOC                         Não usa códigos de jornada
Parser/catálogo próprios              Grupos com regras de cobertura próprias
```

**Regra fundamental: USUÁRIO ≠ ESCALA.** Um usuário não tem um
`tipoEscala` único. Ele pode:

- ter jornada normal e nenhum plantão;
- ter jornada normal e participar de um ou mais grupos de plantão;
- não ter jornada normal (perfil sem 6x1) e ainda assim participar de
  plantão;
- não participar de nenhum plantão e apenas **consultar** quem está de
  plantão (ver seção 9).

Isso implica que a participação em plantão não pode ser um campo escalar em
`Usuario` (`lib/modelos.ts:39`) do tipo `usuario.tipoEscala = 'PLANTAO'` —
isso impediria múltiplas participações e colidiria semanticamente com o que
já existe (`turnoPadrao`, `equipeId`). A participação é uma relação
N:N entre usuário e grupo de plantão (ver seção 3), não um atributo do
usuário.

## 2. Não confundir com política de escalonamento

Dois conceitos que a arquitetura deve manter **desacoplados**:

| Pergunta | Conceito |
| --- | --- |
| "Quem está responsável **agora**?" | Plantão |
| "Quem deve ser acionado se o responsável não atender?" | Política de escalonamento |

Esta fase (e a arquitetura aqui descrita) **não implementa** política de
escalonamento automática. Um `Turno de plantão` (seção 4) não referencia
"próximo nível de escalonamento" nem "tempo até escalar" — esses seriam
conceitos de um domínio adicional, construído por cima do Plantão sem
alterar seu modelo central. Prever o desacoplamento agora evita ter que
desfazer um acoplamento estrutural depois.

## 3. Conceitos de domínio

### Grupo de plantão

Unidade de organização do plantão — análoga a uma `Equipe`
(`lib/modelos.ts:105`) mas não é uma `Equipe`: uma equipe organizacional
(SOC, NOC, Redes, Infra) pode ter zero, um ou vários grupos de plantão
associados, e o inverso também é plausível a longo prazo (um grupo de
plantão que reúne pessoas de mais de uma equipe). Exemplos:
`PLANTAO_COSI`, `PLANTAO_REDES`, `PLANTAO_INFRA`, `PLANTAO_BANCO`.

Campos conceituais (schema Firestore **não fechado** nesta fase):

- identificador e nome;
- descrição;
- equipe(s) responsável(is);
- ativo (`boolean`, mesmo padrão de `Equipe.ativa`/`Usuario.ativo`);
- timezone (a planilha real já mistura virada de dia — ver seção 8; o
  grupo precisa declarar seu fuso horário de referência, não assumir UTC
  nem horário local do navegador);
- visibilidade (quem pode **consultar**, seção 9);
- participantes (ver abaixo);
- regras de cobertura (configuráveis por grupo, seção 7 — nunca globais).

### Participante

Usuário real do Escala ICI, identificado **obrigatoriamente pelo login
funcional** (`usuarios/{login}`, mesma chave usada em todo o projeto — não
o UID do Firebase Auth, princípio já estabelecido em
`docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`). O nome é dado de apresentação;
o login é a identidade técnica permanente. Um participante pode estar em
zero, um ou vários grupos de plantão simultaneamente.

### Turno/intervalo de plantão

Representa um período coberto por um plantonista:

- plantonista (login);
- início / fim (timestamp, considerando o timezone do grupo);
- duração calculada (nunca armazenada como fonte de verdade — derivada de
  início/fim, mesmo princípio de "calcular, não guardar" já usado em
  `lib/alertasEscala.ts` para descanso/6x1);
- competência (mês de referência, para consistência com `turnosMes` e a
  contabilidade mensal existente);
- grupo de plantão a que pertence;
- origem (importação de planilha, geração determinística futura, ou
  override manual — ver seção 4);
- papel primário/secundário — campo previsto para o futuro (plantão com
  titular + backup), não modelado em detalhe nesta fase.

### Escala base, override e escala efetiva

Três níveis, análogos ao par `turnosMes`/`rascunhosTurnosMes` +
publicação/revisão que já existe para a jornada 6x1
(`docs/spec/ADMINISTRACAO_E_HIERARQUIA.md`, `lib/revisoes.ts`), mas como
conceito próprio do domínio de Plantão:

```
BASE       → programação originalmente gerada ou importada da planilha
  ↓
OVERRIDE   → alteração pontual (troca de plantonista, ajuste de horário)
             sem destruir a programação original
  ↓
EFETIVA    → resultado final depois de aplicar os overrides sobre a base
```

Esta fase **não implementa** override — só reserva o lugar dele na
arquitetura, para que PLANTÃO-6 (trocas/substituições) não exija reabrir o
modelo de dados. A "escala efetiva" é sempre a que a Central de Plantões
(seção 5) deve mostrar ao usuário; a base nunca é sobrescrita fisicamente.

## 4. Contatos do plantonista

Até **3 contatos operacionais** por participante, com estrutura semântica
— não três campos posicionais fixos:

```ts
interface ContatoPlantonista {
  rotulo: 'CELULAR_CORPORATIVO' | 'CELULAR_ALTERNATIVO' | 'CELULAR_PESSOAL' | 'RAMAL' | 'OUTRO';
  numero: string;
  ativo: boolean;
}
```

(nomes de campo ilustrativos — o schema Firestore final é decisão de
PLANTÃO-3, não desta fase.)

Regras obrigatórias, a valer desde a primeira implementação real:

- contatos são **dado autenticado** — nunca aparecem antes do login, nunca
  em tela pública, nunca embutidos como dado estático no bundle da
  aplicação, nunca versionados em arquivo de configuração no Git;
- visibilidade por grupo/equipe é prevista como evolução futura (quem pode
  ver o contato de quem depende de quem tem permissão de **consultar** o
  grupo, seção 9) — não implementada nesta fase;
- Firestore Rules para proteger esse dado são trabalho de PLANTÃO-3, não
  desta fase (esta fase não altera `firestore.rules`).

## 5. Central de Plantões — experiência pretendida (não implementada)

Objetivo: um analista SOC/NOC consegue responder "quem está de plantão
agora?" sem abrir XLS, Teams, ou perguntar para outra pessoa.

**Sem alterar a navegação inferior atual** (`Hoje`, `Agenda`, `Trocas`,
`Equipe`, `Perfil` — nenhum sexto item nesta fase, nem nas fases
imediatamente seguintes previstas). A proposta encaixa Plantões dentro da
navegação existente:

- **Tela Hoje**: card rápido "Plantão de Apoio" / "Plantão de Segurança" —
  mesmo espírito do `next-shift-card` que já existe ali para a jornada
  normal, mas para o plantão ativo do momento.
- **Tela Equipe**: sub-navegação `Equipe | Plantões` (mesmo padrão de
  abas/segmented control já usado em outras telas do App).
- **Área Plantões**: `Em plantão agora` / `Próximos` / `Todos os
  plantões` / `Meus plantões` (esta última só relevante para quem
  participa de ao menos um grupo).

Para um participante, "Meus plantões" deve oferecer: calendário mensal,
próximo plantão, plantão atual, plantões posteriores, contabilidade da
competência corrente (seção 8).

## 6. Consulta "quem está de plantão" — visão operacional

Prioridade de design: resposta **rápida**, sem navegação profunda. Exemplo
conceitual do resultado esperado:

```
Plantão de Segurança — COSI

EM PLANTÃO AGORA
Caroline Ribeiro de Freitas

Início:  15/08 19:00
Término: 16/08 19:00

Contato corporativo: <número>
Contato alternativo: <número>

Próximo: Bruno Bueno, 16/08 19:00
```

Capacidades a prever (não implementar):

- busca por grupo de plantão;
- busca por nome;
- indicação clara de "ativo agora";
- próximo plantonista, horário de início/fim, duração;
- ação para ligar (deep-link `tel:`) e ação para copiar contato/dados.

## 7. Participar vs. consultar

Dois conceitos formalmente separados — a arquitetura não deve misturá-los
em uma única flag:

- **Participar do plantão** — estar na lista de plantonistas de um grupo,
  entra em rotação, aparece em "Meus plantões".
- **Ter permissão para consultar o plantão** — poder ver quem está de
  plantão, contatos e próximo plantonista, **sem** necessariamente
  participar. Um analista SOC pode consultar o Plantão de Segurança sem
  nunca ter feito um plantão de segurança na vida.

Isso espelha a separação que `docs/spec/ADMINISTRACAO_E_HIERARQUIA.md` já
faz entre escopo de gestão (`equipesPermitidas`/`unidadesPermitidas`) e
pertencimento (`equipeId`) — mesmo princípio, aplicado a um domínio novo:
pertencimento a um grupo de plantão não é a mesma coisa que autorização
para consultá-lo.

## 8. Regras de cobertura são configuráveis por grupo

Não hardcodar no domínio global algo como "segunda = X, sexta = Y". O
Plantão COSI analisado tem, por exemplo, uma janela diferente em dias úteis
(após o expediente) e janelas distintas em fins de semana — mas isso é
**configuração daquele grupo**, não regra universal de todos os plantões.
Outros grupos podem ter:

- quantidade diferente de participantes;
- horários diferentes;
- dias diferentes;
- rotação diferente.

A arquitetura de regras de cobertura deve viver no Grupo de Plantão (seção
3), nunca em uma tabela de constantes compartilhada entre todos os grupos.

## 9. Importação da planilha de plantão (estratégia futura)

O parser 6x1 atual (`parsePlanilhaEscala`,
`packages/contrato/src/parser.ts:501`) **não é alterado nesta fase nem é
alterado pelo desenho abaixo** — ele continua resolvendo exclusivamente a
planilha de jornada normal.

Desenho futuro (PLANTÃO-1):

```
detectarTipoPlanilha()
    │
    ├── estrutura de escala 6x1  → parser atual (parsePlanilhaEscala)
    │
    └── estrutura de plantão     → parsePlanilhaPlantao() (novo, isolado)
```

A detecção deve ser por **estrutura/conteúdo** da planilha (nomes e forma
das colunas, ex.: presença de `Plantonista Segurança` / `Data Inicio` /
`Data Fim` na planilha real analisada) — nunca por nome de arquivo. Nome de
arquivo é metadado do usuário, não contrato de dados.

### Planilhas reais não são versionadas

A planilha analisada nesta fase contém dados reais e **não foi e não deve
ser adicionada ao Git**. A fixture de teste para PLANTÃO-1 será
**sanitizada** (nomes fictícios) e deverá reproduzir, como casos de borda:

- estrutura real da planilha;
- períodos de plantão;
- virada de dia (plantão que atravessa meia-noite);
- virada de competência (plantão que começa num mês e termina no
  seguinte);
- plantões de 12h;
- plantões de 24h;
- contabilidade (para o cruzamento descrito na seção 10).

## 10. Nome do XLS → login real

Regra de negócio obrigatória, análoga (mas não idêntica) à conciliação já
existente para a escala 6x1 (`lib/conciliacaoUsuarios.ts`,
`aliasesPlanilha?` em `Usuario`, `lib/modelos.ts:100`):

```
XLS (nome completo, ex. "Caroline Ribeiro de Freitas")
    ↓
extrair nomes únicos
    ↓
tentar conciliar com usuários existentes
    ↓
gestor confirma o login
    ↓
todas as ocorrências daquele nome no período passam a apontar para o login confirmado
```

- nome completo **nunca** é tratado como identidade técnica permanente;
- se não houver usuário correspondente: cadastrar um novo ou selecionar um
  existente;
- em caso de ambiguidade (dois usuários com nome parecido, por exemplo):
  **exigir seleção manual** — nunca aproximação silenciosa, nunca login
  inventado;
- **nenhuma escala de plantão é publicada enquanto existir plantonista sem
  login conciliado.**

Este fluxo é conceitualmente equivalente ao processo de conciliação já
descrito para a escala 6x1, mas precisa de sua própria tela/etapa em
PLANTÃO-2, porque a estrutura de origem (planilha de plantão) é diferente.

## 11. Contabilidade de plantões

Visão prevista no Dashboard (PLANTÃO-2/3):

```
Plantonista | Qtd. plantões | Horas de cobertura | Plantões 12h | Plantões 24h | Outras durações | Total
```

A fonte de verdade é sempre **calculada a partir dos intervalos de
plantão** (início/fim de cada turno), nunca o valor pronto do XLS. Quando o
XLS também trouxer sua própria seção de contabilidade:

- valores iguais → "conferência OK";
- valores diferentes → aviso de divergência (nunca falha silenciosa, nunca
  sobrescrita automática de um valor pelo outro).

## 12. Nova escala — visão futura (Plantão e 6x1)

Fluxo futuro do Dashboard, `+ Nova escala`:

```
escolher grupo/equipe → escolher competência → escolher método
```

Métodos: `Continuar escala anterior`, `Criar em branco`, `Importar XLS`.

Para escala 6x1: preservar ciclo, participantes e posição/sequência;
sempre criar **rascunho**, gestor revisa antes de publicar — mesmo
princípio de `rascunhosTurnosMes` que já existe hoje.

Para Plantão: carregar participantes, regras de cobertura e
sequência/rotação do grupo; calcular o próximo período; sempre criar
**rascunho**; gestor revisa antes de publicar.

**Gerador determinístico, reproduzível e testável — nunca IA para decidir
escala operacional.** Mesma filosofia que já rege a escala 6x1 hoje: a
publicação é sempre uma ação humana explícita sobre um rascunho gerado por
uma função pura.

## 13. Experiência do plantonista (participante)

Ao acessar o App, o sistema reconhece as participações do usuário pelo
login (não pelo nome, não por heurística). Ele pode visualizar: plantão
atual, próximo plantão, "Meus plantões", calendário mensal, quem vem
depois, quantidade de plantões e horas de cobertura da competência.

**Jornada normal e Plantão coexistem** — participar de um grupo de
plantão nunca substitui a Agenda normal do usuário. Um colaborador SOC com
escala 6x1 e participação em `PLANTAO_COSI` continua vendo sua Agenda 6x1
normalmente, com Plantão como informação adicional, não concorrente.

## 14. Experiência de quem só consulta

Um analista SOC/NOC que não participa do Plantão de Segurança pode, ainda
assim, consultá-lo (seção 7), conforme as regras de visibilidade do grupo:
quem está de plantão, início, término, contatos e próximo plantonista.

## 15. Sequência de fases prevista

```
PLANTÃO-0  Arquitetura + correção visual                         (esta fase)
PLANTÃO-1  Detector de planilha + parser isolado + fixture sanitizada
PLANTÃO-2  Preview no Dashboard + conciliação nome/login
PLANTÃO-3  Persistência + Rules + grupos + participantes + contatos
PLANTÃO-4  Central de Plantões no App
PLANTÃO-5  Nova escala + gerador determinístico
PLANTÃO-6  Overrides/substituições/trocas
PLANTÃO-7  Homologação staging completa
```

Nenhuma das fases 1–7 é iniciada nesta fase.

## 16. O que esta fase explicitamente NÃO faz

- Não altera Firestore Rules.
- Não cria novas coleções.
- Não altera schema persistido.
- Não altera autenticação (Microsoft/Firebase Auth).
- Não altera push worker nem notificações FCM.
- Não altera o fluxo de publicação de escala 6x1.
- Não altera `parsePlanilhaEscala` nem o catálogo SOC.
- Não implementa nenhum código funcional de Plantão.
- Não adiciona item à navegação inferior.
- Não versiona a planilha real de plantão analisada.

## 17. Riscos e decisões abertas

- Schema Firestore de Grupo de Plantão/Turno de Plantão/Contato é decisão
  de PLANTÃO-3, deliberadamente não fechada aqui, para não engessar o
  desenho antes de ver a fixture sanitizada (PLANTÃO-1) e o preview real de
  conciliação (PLANTÃO-2).
- A relação grupo de plantão ↔ equipe organizacional (N:N vs. 1:N) é uma
  decisão em aberto — o desenho aqui não assume 1:N para não fechar a porta
  a um grupo de plantão que reúne pessoas de mais de uma equipe.
- Visibilidade/autorização de consulta (seção 7) por grupo é um esboço
  conceitual; o mecanismo de concessão (por equipe, por perfil, por lista
  explícita) é decisão de PLANTÃO-3, alinhada ao padrão de
  `equipesPermitidas`/`unidadesPermitidas` já existente.
- Timezone por grupo é mencionado como campo necessário (planilha real
  mistura virada de dia), mas a estratégia de armazenamento/exibição
  (UTC + timezone vs. horário local gravado direto) é decisão de PLANTÃO-3.
