# Spec — Wizard Preparar escala

**Status:** implementado localmente  
**Data:** agosto de 2026  
**Componente:** `components/escalas/ScheduleStartWizard.tsx`  
**Escopo:** criação de escala vazia e importação de planilha

## 1. Objetivo

O wizard deve ajudar o coordenador a iniciar uma escala sem exigir conhecimento da hierarquia interna do sistema. O fluxo suporta dois objetivos: **criar uma escala vazia** para preencher no editor ou **importar uma planilha** para validar e revisar antes de abrir o editor.

O modal aprovado não usa o stepper visual artificial `1 Tipo / 2 Destino / 3 Editor`. A implementação não representa uma sequência que não existe como navegação independente. Em vez disso, apresenta o contexto escolhido no topo e deixa as decisões reais visíveis na mesma superfície.

## 2. Ordem funcional normativa

A ordem efetiva do sistema é:

| Ordem | Decisão | Resultado |
|---|---|---|
| 1 | Escolher intenção | `Nova escala` ou `Importar escala`, definido pelo modo que abriu o wizard. |
| 2 | Escolher tipo de operação | Jornada 6x1 ou Plantão. |
| 3 | Resolver destino | Equipe de Jornada ou Grupo de Plantão, conforme o contexto disponível. |
| 4 | Escolher competência | Mês de competência e período calculado. |
| 5 | Importar arquivo, quando aplicável | XLS/XLSX é selecionado somente no fluxo de importação após tipo, destino e competência. |
| 6 | Prosseguir | Nova abre o editor vazio; Importar continua para revisão/validação da planilha. |

O modal não deve alegar que o coordenador está em uma etapa separada se ele ainda está na mesma tela de configuração. O resumo no topo comunica a intenção, o destino atual e a prontidão.

## 3. Cabeçalho

O eyebrow permanece `Criar` para Nova escala e `Preencher` para Importar escala. O título é `Nova escala` ou `Importar escala`.

O texto de apoio é orientado ao resultado:

- Nova: **“Comece uma escala vazia e adicione colaboradores e turnos no editor.”**
- Importar: **“Envie sua planilha, revise os dados e abra o editor quando estiver pronta.”**

O fechamento é um botão de ícone com rótulo acessível. Não usar hiperlink textual para fechar ou navegar.

## 4. Escolha do tipo

Quando `tipo === null`, o modal exibe dois cards selecionáveis:

| Tipo | Rótulo | Descrição |
|---|---|---|
| Jornada | Jornada 6x1 | Escala regular da equipe, com turnos, folgas, férias e alertas. |
| Plantão | Plantão | Cobertura por intervalos, participantes e competência. |

Os cards são `button`, têm foco visível e não usam hiperlinks. A escolha chama `onEscolherTipo` e mantém o modo Nova/Importar já selecionado.

## 5. Resumo do destino

Após a escolha do tipo, o topo apresenta um resumo com ícone, intenção, operação e status:

- intenção: `Criar nova escala` ou `Importar escala`;
- operação: nome real da equipe Jornada ou grupo de Plantão quando resolvido;
- descrição: natureza da operação;
- status: `Destino pronto` quando destino e competência estão válidos, ou `Defina o destino` quando ainda falta decisão;
- ação `Alterar`: botão secundário com ícone, nunca `link-button` ou texto sublinhado.

A classe `wizard-type-summary-copy` deve truncar textos longos sem quebrar o card. O botão Alterar reabre a escolha de tipo por `onEscolherTipo(tipo)` e não altera o tipo de forma silenciosa.

## 6. Nomes de Jornada dinâmicos

O sistema não deve fixar SOC no wizard. A operação Jornada é representada por `equipe.nome` quando `equipeId` está resolvido. Assim:

| Contexto do coordenador | Exibição esperada |
|---|---|
| COSI | Nome cadastrado da equipe SOC, por exemplo `SOC`. |
| CODB | Nome cadastrado da equipe NOC, por exemplo `NOC`. |
| Outra área | Nome da equipe cadastrada pelo administrador. |

Enquanto nenhuma equipe foi escolhida, o fallback visual é `Jornada 6x1`. O fallback não grava `SOC`, não muda o domínio e não substitui o nome real depois da resolução.

A lista de equipes continua vindo da prop `equipes`. O wizard não cria uma tabela paralela de equipes e não exige que o código conheça nomes de áreas específicas.

## 7. Grupos de Plantão dinâmicos

O sistema não deve fixar `Plantão COSI`. O destino Plantão vem de `grupos`, filtrado e resolvido pelo DashboardApp. Podem existir grupos como:

- Plantão COSI;
- Plantão CODB;
- Plantão Infra;
- Plantão Redes;
- qualquer outro grupo administrável criado pelo coordenador/administrador.

O seletor usa o rótulo **Grupo de Plantão** e o placeholder **Selecione o grupo de Plantão**. O resumo mostra `grupo.nome` quando selecionado e usa `Plantão` somente como fallback visual.

Quando não há grupo administrável, o wizard preserva o fluxo de criação inline existente, permitindo criar um novo grupo vinculado à equipe responsável. Essa ação continua usando `onCriarGrupo` e as regras administrativas existentes.

"Grupos administráveis" (`grupos`, prop) e "equipes elegíveis para Jornada" (`equipes`, prop, quando `tipo === 'JORNADA'`) vêm de `lib/escoposOperacionais.ts` (`plantoesAdministraveis`/`jornadasAdministraveis` — Fase ESCOPO-GESTOR-UNIDADE-1, ver `docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`): a mesma equipe nunca aparece como opção de Jornada 6x1 se já for a equipe responsável de um Grupo de Plantão conhecido.

**Atualização ESCOPO-OPERACIONAL-MATRIZ-1:** essas listas vêm
prioritariamente da matriz explícita `escoposOperacionais`
(`ESCOPO_OPERACIONAL_MATRIZ.md`). Plantões monitorados/consultáveis nunca
aparecem como destino de Nova/Importar; `GrupoPlantao ativo:false` também
não aparece. O fallback por unidade/equipe é transitório e só vale quando
não existir matriz para o alvo.

Depois que o destino é escolhido, o carregamento de dados usa a identidade
real do alvo, nunca o rótulo exibido no modal e nunca a equipe do responsável:
Jornada usa `equipeId` da equipe selecionada; Plantão usa `grupoId` do grupo
selecionado. `GrupoPlantao.equipeResponsavelId` é metadado administrativo do
grupo e não substitui `grupoId` como chave mensal de rascunho de Plantão.

**Fase PROVISIONAMENTO-GRUPO-PLANTAO-1** (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md` § 9) — o diagnóstico de "nenhum grupo administrável" agora se divide em dois casos, nunca uma mensagem genérica só:
- existe equipe administrável na área, mas nenhum Grupo vinculado a ela: **"Existe equipe de Plantão nesta área, mas ainda não há Grupo de Plantão vinculado. Crie o grupo para importar ou montar a escala."**, seguida do formulário inline de criação (`onCriarGrupo`);
- nenhuma equipe administrável na área: mensagem anterior ("Nenhuma equipe responsável disponível nesta área"), com opção de criar a equipe primeiro (`onCriarEquipe`).

## 8. Área de gestão

Se houver mais de uma área disponível, o seletor é exibido. Se houver uma área, ela é resolvida automaticamente. Quando a hierarquia não estiver cadastrada, o wizard mostra a mensagem informativa existente e usa o destino único para determinar o contexto.

Não converter a área em hiperlink. O seletor deve continuar sendo `select` acessível ou campo resolvido não editável.

## 9. Competência

A competência é um input `type="month"`. O período calculado por `periodoDaCompetencia` permanece visível abaixo como prévia. A data não é editada manualmente neste modal e segue as regras do contrato já existente.

O botão de conclusão permanece desabilitado enquanto não houver destino válido, competência válida ou, no fluxo Importar, arquivo selecionado.

## 10. Importar planilha

O bloco de arquivo só aparece quando tipo, destino e competência já estão prontos. Aceita `.xls` e `.xlsx`. A planilha não é enviada antes de o sistema saber se o destino é Jornada ou Plantão.

A área de upload é um dropzone com `label` associado ao input real. A ação primária se chama **Continuar para revisão**, pois a importação deve passar pela revisão antes de salvar/publicar. O arquivo continua sendo processado pelo handler existente `onSelecionarArquivo`.

## 11. Criar escala vazia

No modo Nova, o coordenador escolhe Jornada ou Plantão, define destino e competência e então seleciona **Abrir editor**. A criação vazia não inventa colaboradores nem turnos. No editor, o coordenador poderá adicionar colaboradores e preencher turnos de trabalho, respeitando:

- Jornada: grade 6x1 e assistente inicial de seis dias;
- Plantão: participantes, padrões de horário e exceções do Modal D.

O wizard não deve duplicar a lógica de colaboradores, turnos ou atribuições.

**Atualização ESCOPO-OPERACIONAL-MATRIZ-2:** ao criar Jornada vazia,
os colaboradores iniciais vêm de usuários ativos da equipe selecionada para a
Jornada, não da equipe do coordenador/responsável. Em staging real, o wizard
não pode preencher Lia Vilar, Noah Campos ou qualquer outro usuário
sintético de demo salvo modo demo explícito. Se a equipe não tiver usuário
ativo elegível, a escala abre sem membros e mostra o diagnóstico:
**"Nenhum colaborador ativo encontrado para esta equipe. Cadastre ou importe
usuários antes de montar a escala."**

O contexto aberto pelo wizard preserva `{ tipo, alvoId, label, competencia }`.
Salvar/importar/publicar reutiliza esse `alvoId` e exige administração na matriz
ativa. Jornada grava `equipeId`; Plantão grava `grupoId`. `label` nunca é chave,
e `equipesConsulta` não habilita nenhuma ação de escrita.

## 12. Rascunho existente

Quando já existe rascunho para destino e competência, o aviso permanece visível e oferece `Abrir rascunho existente` como botão secundário. O botão de conclusão não deve criar duplicata silenciosamente.

Para Jornada, a verificação de rascunho/publicação deve consultar
`rascunhosTurnosMes` e `turnosMes` por `equipeId` + competência. Para Plantão,
deve consultar `rascunhosCompetenciasPlantao` e `competenciasPlantao` por
`grupoId` + competência. A
ausência de publicação não equivale a ausência total de escala quando existe
rascunho.

## 13. Ações e proibição de hiperlinks

Ações do modal devem usar botões de produto:

| Ação | Controle |
|---|---|
| Alterar tipo | Botão secundário com ícone Pencil. |
| Criar equipe | Botão secundário/primário conforme estado. |
| Criar grupo | Botão secundário/primário conforme estado. |
| Selecionar arquivo | Label/dropzone acionável associado ao input. |
| Cancelar | Botão secundário. |
| Usar período anterior | Botão secundário. |
| Abrir editor/Continuar revisão | Botão primário. |
| Fechar | Botão de ícone com aria-label. |

Não usar `link-button`, texto sublinhado, breadcrumb hiperlinkado ou `a` para executar qualquer ação do modal.

## 14. Acessibilidade e responsividade

O modal deve possuir `role="dialog"`, `aria-modal`, título associado, foco visível em todos os controles e labels associados aos inputs. Em larguras menores, o grid de contexto vira uma coluna, o resumo reorganiza status e Alterar sem overflow e as ações podem ocupar a largura disponível.

O nome de equipe/grupo pode ser longo. O layout deve truncar o resumo com reticências sem cortar o CTA. A cor verde de `Destino pronto` não é o único sinal: o texto deve permanecer visível.

## 15. Compatibilidade com regras anteriores

Esta mudança é somente de apresentação e orquestração do wizard. Preserva:

- wizard unificado Nova/Importar;
- contexto SOC/Plantão no topo;
- competência derivada do contrato;
- criação inline de equipe e grupo;
- revisão SOC e calendário Plantão;
- Modal D de horários;
- grade 6x1, ciclo inicial e edição individual;
- schema, persistência, Rules e parsers existentes.

## 16. Critérios de aceite

A implementação é aceita quando:

1. O modal não apresenta os textos `1 Tipo`, `2 Destino` ou `3 Revisar/Editor/Arquivo`.
2. Não há hiperlink sublinhado ou `link-button` dentro do wizard.
3. Nova escala abre fluxo vazio e termina em `Abrir editor`.
4. Importar escala exige arquivo e termina em `Continuar para revisão`.
5. SOC não fica hardcoded como único nome de Jornada.
6. NOC ou outra equipe aparece quando o contexto/equipe assim determinar.
7. Plantão COSI, CODB, Infra, Redes ou grupos futuros aparecem pelo nome cadastrado.
8. O status `Destino pronto` só aparece quando destino e competência estão válidos.
9. A suíte completa passa e o runtime mostra o modal sem cards quebrados.
10. O ZIP completo atualizado é gerado e contém esta spec, checkpoint, patch e captura real.
