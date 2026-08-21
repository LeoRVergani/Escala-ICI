# Especificação — Matriz de Responsáveis por Escala

**Fase:** ESCOPO-OPERACIONAL-MATRIZ-2
**Status:** normativa  
**Data:** agosto de 2026

## 1. Regra principal

O organograma não é autorização automática de escala. Cargo/função também não é autorização automática de escala. Unidade pai não concede automaticamente administração de todas as Jornadas e Plantões abaixo dela, e a equipe do usuário não define sozinha tudo que ele administra.

Responsabilidade de escala é uma configuração operacional explícita, editável no Dashboard em **Administração → Responsáveis por escala**, sem Console do Firebase, seed, Rules ou código para cada mudança diária.

## 2. Cinco conceitos separados

| Conceito | Define | Não define sozinho |
|---|---|---|
| Organograma | Onde unidades e equipes estão na estrutura. | Quem cria, importa, edita, salva ou publica escala. |
| Cargo/função | Papel nominal como coordenador, supervisor, gestor ou analista. | Administração automática de Jornada ou Plantão. |
| Escopo administrativo | Quem cadastra/edita unidades, equipes, usuários e grupos. | Responsabilidade operacional sobre cada escala. |
| Escopo operacional de escala | Quem cria, importa, edita, salva e publica uma Jornada ou Plantão. | Consulta/monitoramento. |
| Escopo de consulta | Quem visualiza/monitora Plantões. | Edição, importação, publicação ou administração. |

Siglas institucionais e códigos hierárquicos de equipe, como
`GEDSI_CODB_NOC`, existem para cadastro, filtro e apresentação. A matriz
persiste e autoriza pelos IDs estáveis de `alvoId`, `responsaveisLogin`,
`responsaveisEquipe` e `equipesConsulta`; ela nunca interpreta os segmentos
do código organizacional como ACL.

## 3. Modelo de dados

Coleção:

```text
escoposOperacionais/{id}
```

Campos:

```ts
{
  tipo: "JORNADA" | "PLANTAO",
  alvoId: string,
  alvoNome: string,
  unidadeId?: string,
  caminhoUnidade?: string[],
  responsaveisLogin: string[],
  responsaveisEquipe: string[],
  equipesConsulta: string[],
  ativo: boolean,
  criadoEm?: string,
  atualizadoEm?: string,
  criadoPorLogin: string,
  atualizadoPorLogin: string,
  schemaVersion: 1,
}
```

Para `JORNADA`, `alvoId` é `Equipe.id`. Para `PLANTAO`, `alvoId` é `GrupoPlantao.grupoId`.

`responsaveisLogin` e `responsaveisEquipe` concedem administração operacional. `equipesConsulta` concede apenas consulta/monitoramento e só se aplica a Plantão.

A matriz concede acesso ao alvo operacional, mas não muda a chave dos dados
da escala. Depois de resolvido o alvo:

- Jornada busca escala, rascunho, publicação, catálogo e colaboradores por
  `equipeId = alvoId` (`turnosMes.equipeId`, `rascunhosTurnosMes.equipeId`,
  `publicacoesEscala/{equipeId}_{competencia}` e `usuarios.equipeId`).
- Plantão busca rascunho e participantes por `grupoId = alvoId`
  (`rascunhosCompetenciasPlantao.grupoId` e
  `gruposPlantao/{grupoId}/participantes`).

O responsável humano ou sua `Usuario.equipeId` nunca é fallback para carregar
colaboradores, rascunhos ou publicações quando a operação da matriz já está
selecionada.

`responsaveisLogin` é lista de responsáveis humanos e só pode apontar para usuários ativos com perfil operacional elegível: `ADMIN_SISTEMA`, `GESTOR_UNIDADE`, `GESTOR_EQUIPE` ou `SUPERVISOR_EQUIPE`. `ANALISTA_SOC`, `ANALISTA_SUPORTE`, `LEITURA`, técnico, colaborador comum, usuário sem perfil de gestão e usuário inativo não aparecem como responsável de escala. A exceção correta é promover o usuário para um perfil adequado, nunca hardcode por nome, cargo textual, sigla, equipe ou unidade.

Compatibilidade transitória: documentos legados de usuário sem `perfil` podem cair no fallback já existente de `perfilEfetivo()` por `nivelHierarquico`; esse fallback não deve ser ampliado nem usado para criar regra nova.

## 4. Precedência

1. `ADMIN_SISTEMA` administra tudo.
2. Escopo ativo com `responsaveisLogin` contendo o login concede administração do alvo somente se o usuário humano for ativo e tiver perfil elegível.
3. Escopo ativo com `responsaveisEquipe` contendo a equipe do usuário concede administração do alvo quando a equipe inteira representa um grupo de gestão.
4. `equipesConsulta` concede apenas consulta.
5. Se o usuário administra um Plantão, ele não vê o mesmo Plantão como monitorado.
6. `GrupoPlantao ativo:false` não aparece no seletor operacional nem no Wizard.
7. Cargo, nome, sigla e organograma não autorizam sozinhos.
8. Organograma é contexto visual e ajuda de seleção, não regra absoluta de autorização operacional.

## 5. Compatibilidade transitória

Enquanto a matriz não existir para um alvo, o resolver pode manter o cálculo antigo por perfil/equipe/unidade para não quebrar demo, testes e ambientes migrando dados.

Essa regra é **Regra transitória / fallback de compatibilidade**. Quando existir qualquer documento `escoposOperacionais` para o alvo, a matriz explícita vence para aquele alvo.

## 6. Consulta versus administração

Consulta é diferente de administração. `equipesConsulta` permite leitura e monitoramento de Plantões, nunca edição, importação, salvamento, publicação ou administração de participantes/contatos.

Responsáveis, equipes administradoras e equipes que consultam são três conceitos distintos:

- **Responsáveis**: usuários humanos gestores/supervisores elegíveis.
- **Equipes administradoras**: equipes que representam um grupo de gestão e administram o alvo.
- **Equipes que consultam**: equipes que apenas visualizam/monitoram Plantões.

A equipe responsável de um `GrupoPlantao` não vira automaticamente equipe administradora na matriz só por ser o alvo operacional do grupo.

Plantão administrável nunca aparece ao mesmo tempo como monitorado para o mesmo usuário.

## 7. Grupos inativos

`GrupoPlantao ativo:false`:

- não aparece em seletor operacional;
- não aparece em Wizard de Nova escala;
- não aparece em Wizard de Importar escala;
- aparece apenas em **Administração → Grupos de Plantão**, com badge **Inativo**;
- não deve ser reativado automaticamente por resolver, seed ou migração.

## 8. Casos operacionais suportados sem hardcode

- Uma coordenação de segurança pode ter uma Jornada de equipe e um Plantão próprio por escopos explícitos.
- Uma equipe pode monitorar um Plantão se estiver listada em `equipesConsulta`, sem poder editar, importar, salvar ou publicar.
- Uma equipe de operações pode estar dentro de uma coordenação, mas ser administrada por uma supervisão específica.
- Uma equipe de suporte N1 pode ter responsáveis diferentes conforme localidade.
- Um Plantão pode ser administrado por uma coordenação e consultado por outra equipe.
- Uma coordenação não administra automaticamente Jornada ou Plantão de outra equipe sem escopo explícito.
- O organograma não resolve essas exceções; a matriz resolve.

## 9. UI normativa

O Dashboard deve oferecer **Administração → Responsáveis por escala** com tabela simples, estilo planilha:

| Tipo | Escala/Equipe/Grupo | Unidade/Área | Responsáveis | Equipes que consultam | Status | Ações |
|---|---|---|---|---|---|---|

A tela deve permitir pesquisar, filtrar por tipo/status, adicionar/remover responsáveis, adicionar/remover equipes de consulta, desativar e reativar vínculos, com modal simples.

Texto obrigatório de UX: **“Esta configuração define quem administra a escala. Consulta não concede edição.”**

A ação **Novo vínculo** deve estar clara e visível mesmo quando a tabela não tem registros. Nesta fase, se o usuário não for `ADMIN_SISTEMA`, a ação pode ficar desabilitada, mas a tela deve explicar que a escrita da matriz ainda é restrita a `ADMIN_SISTEMA`.

O modal deve separar claramente **Responsáveis**, **Equipes administradoras** e **Equipes que consultam**. O dropdown **Responsáveis** deve listar apenas usuários ativos com perfil elegível de gestão/supervisão. Quando não existir nenhum usuário elegível, deve mostrar: **“Nenhum gestor ou supervisor ativo encontrado. Cadastre ou promova um usuário antes de criar o vínculo.”**

O campo de equipe administradora deve aparecer como **Equipes administradoras** ou trazer tooltip equivalente: **“Use apenas quando a equipe inteira representa um grupo de gestão. Consulta deve ser configurada em Equipes que consultam.”** Não confundir com a equipe responsável do Plantão nem com `equipesConsulta`.

O modal deve usar seletores de equipes ativas e alvos ativos. Não deve exigir que a operação diária digite `grupoId`, `equipeId` ou listas separadas por vírgula na interface principal. IDs técnicos podem aparecer apenas como complemento/tooltip.

Um responsável operacional pode cadastrar colaboradores e delegar
`GESTOR_EQUIPE`/`SUPERVISOR_EQUIPE` na equipe do alvo. Para Plantão, o cadastro
carrega contexto auditável com `grupoId`, e as Rules conferem o Grupo ativo e
sua `equipeResponsavelId`. Essa delegação não altera a matriz, não autoriza
outras equipes e nunca permite `ADMIN_SISTEMA`, `GESTOR_UNIDADE` ou escopo
global.

Vínculos antigos com `responsaveisLogin` não elegível devem permanecer persistidos até correção manual, mas a tela deve exibir badge **“Responsável não elegível”** e não tratar esse humano como administrador operacional.

## 9.1. Bootstrap e staging

Seed/fixture é mecanismo de bootstrap idempotente para staging/demo, não operação diária. O seed pode criar vínculos iniciais sanitizados para Jornada e Plantão, mas deve rodar em dry-run por padrão e só gravar com confirmação explícita do comando.

O Dashboard é o caminho normativo para manter a matriz depois do bootstrap. Não se deve resolver casos novos via Console do Firebase, Rules ou hardcode de unidades/equipes reais.

Seed de staging real não deve criar colaboradores sintéticos automaticamente. Dados de laboratório/demo só aparecem quando o modo demo for explícito.

## 9.2. Colaboradores da grade

Responsável por escala não é dono dos colaboradores. Colaboradores pertencem à equipe/grade da escala aberta.

Para Jornada, a grade usa usuários ativos vinculados à equipe da Jornada ou membros já existentes daquela grade, conforme o modelo atual. Se não houver usuário ativo elegível para a equipe, o Dashboard deve mostrar: **“Nenhum colaborador ativo encontrado para esta equipe. Cadastre ou importe usuários antes de montar a escala.”**

O modal **Adicionar colaborador à grade** lista apenas usuários ativos da equipe da escala que ainda não estão na grade. Nunca deve usar a equipe do coordenador como fallback e nunca deve injetar nomes demo/sintéticos em staging real.

## 9.3. Visão geral operacional

A Visão geral deve listar os alvos administráveis da matriz mesmo quando
ainda não existe escala criada para a competência ativa. O status do card é
derivado dos dados do alvo:

- **Sem escala**: não existe rascunho nem publicação para alvo e competência.
- **Rascunho**: existe rascunho ainda não publicado.
- **Publicada**: existe publicação e não há rascunho pendente sobrepondo a
  competência.

Para Jornada, o card usa `Equipe.id` real; para Plantão, `GrupoPlantao.grupoId`.
Rótulos visuais como nome, sigla ou área são apenas apresentação. A ação
**Abrir operação** seleciona o mesmo alvo no seletor superior e preserva o
guard de alterações não salvas.

## 9.4. Grupos inativos e destino operacional

`GrupoPlantao ativo:false` não influencia destino operacional de Equipe. Uma equipe vinculada a um grupo inativo continua aparecendo conforme seu domínio real de Jornada, quando aplicável, e o grupo inativo aparece apenas em **Administração → Grupos de Plantão** com badge **Inativo**.

## 9.5. Carregamento, diagnóstico e recuperação

A leitura de `escoposOperacionais` é uma carga única, com timeout e quatro
estados explícitos: **carregando**, **sucesso**, **vazio** e **erro**. Toda
tentativa deve terminar em um dos três estados terminais; lista vazia é
resultado válido e nunca mantém o seletor em loading.

- `permission-denied` mostra: **“Não foi possível carregar a Matriz de
  Responsáveis. Verifique se as Firestore Rules de staging foram
  publicadas.”**;
- indisponibilidade de rede mostra erro recuperável e **Recarregar
  operações**;
- usuário sem alvo administrável/consultável mostra **“Nenhuma operação de
  escala configurada para este usuário.”** e orienta solicitar o vínculo em
  **Administração → Responsáveis por escala**;
- `ADMIN_SISTEMA` também recebe **Ir para Responsáveis por escala**;
- esses estados nunca são mascarados como **Sem escala**, que significa que
  o alvo existe, mas não possui rascunho/publicação na competência.

O contexto salvo no `localStorage` é somente preferência de UI. Depois da
carga, ele é revalidado por `tipo + alvoId` contra os alvos ativos da matriz.
Alvo inexistente, desativado ou Grupo de Plantão inativo é removido e exige
nova seleção; nunca pode travar a página.

O fallback operacional legado é opt-in por
`VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO=true`. Sem essa autorização
explícita, ausência de vínculo na matriz produz estado vazio. Mesmo com o
opt-in, matriz existente — inclusive inativa — continua vencendo para o alvo.

Enquanto a migração de staging estiver incompleta, o build
`staging.dashboard` mantém esse opt-in explícito. Assim, um alvo legado ainda
sem documento próprio continua visível ao lado dos alvos já migrados; isso não
autoriza escrita nem substitui uma matriz existente. Produção e ambientes
novos permanecem com o fallback desligado por padrão.

As leituras do conteúdo de cada operação são independentes e usam resultado
assentado por fonte. Uma recusa ao ler rascunho, histórico ou estado de
publicação não pode descartar uma publicação que já foi carregada com sucesso.
Quando existe dado principal aproveitável, a UI o preserva e mostra aviso
recuperável; quando todas as fontes capazes de determinar a escala retornam
`permission-denied`, mostra diagnóstico explícito de que as Firestore Rules do
ambiente ainda não reconhecem a Matriz de Responsáveis. Falhas de rede mantêm
diagnóstico próprio. Em ambos os casos, **Recarregar operações** inicia uma
nova tentativa e o seletor nunca volta a loading infinito.

## 10. Rules

`escoposOperacionais`:

- leitura autenticada para alimentar o resolver;
- criação/edição/desativação somente por `ADMIN_SISTEMA` nesta fase;
- delete físico negado;
- `schemaVersion` validado;
- campos permitidos fechados;
- usuário comum não cria/edita escopo nem se coloca como responsável;
- consulta não vira administração.

**Atualização ESCOPO-OPERACIONAL-MATRIZ-2:** a matriz governa também a
escrita operacional. `ADMIN_SISTEMA` continua global. Fora dele, criar,
importar, salvar e publicar exige um documento ativo e compatível cujo
`responsaveisLogin` contenha o login autenticado ou cujo
`responsaveisEquipe` contenha uma das equipes permitidas do usuário.
`equipesConsulta` concede somente leitura/monitoramento.

O alvo é a identidade persistente do contexto, nunca o rótulo visual:

- Jornada escreve e lê por `equipeId == alvoId`;
- Plantão escreve e lê por `grupoId == alvoId`;
- `label`/`alvoNome` é apenas apresentação;
- o responsável não substitui o alvo e não se torna dono dos colaboradores.

O fallback de autorização anterior permanece somente para alvos sem qualquer
documento de matriz e quando a compatibilidade legada estiver explicitamente
habilitada. A existência de matriz inativa ou incompatível bloqueia o fallback.
Deletes físicos que já eram negados continuam negados, inclusive nas
competências e atribuições publicadas de Plantão.

Para que a importação de Jornada funcione quando responsável e equipe-alvo são
distintos, a mesma autorização permite listar `usuarios` da equipe-alvo,
cadastrar os usuários ausentes dessa equipe sem `perfil`, `escopo` ou campos
organizacionais e atualizar somente `aliasesPlanilha`/`atualizadoEm` durante a
conciliação. Isso não concede edição geral, promoção, realocação ou exclusão de
usuários. Updates de rascunho, turno publicado e estado de publicação também
validam o alvo já persistido e mantêm `equipeId`/competência imutáveis, para o
payload não poder redirecionar um documento de outro alvo.

Quando a conta não consta como responsável, a UI informa **“Você não está
configurado como responsável por esta escala.”**. Quando o cliente reconhece a
matriz, mas o ambiente ainda responde `permission-denied`, informa **“As regras
de escrita ainda não reconhecem a matriz operacional neste ambiente.”**.
