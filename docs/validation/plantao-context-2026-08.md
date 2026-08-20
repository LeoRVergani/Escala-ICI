# Diagnóstico de contexto SOC e Plantão

Após a correção dos dados de demonstração, o Dashboard abre com o contexto Jornada `SOC`. O laboratório agora possui duas equipes distintas (`EQ_SOC` e `EQ_PLANTAO_COSI`) e um Grupo de Plantão `PLANTAO_COSI` responsável pela equipe Plantão.

No runtime, o menu superior passou a listar apenas `COSI > SOC` em Jornadas e `Plantão` em Plantões. Ao selecionar Plantão, o gatilho superior mudou de `SOC` para `Plantão` e o status de competência mudou para `Sem escala`, sem misturar a Jornada SOC com o contexto Plantão.

No wizard com Plantão selecionado, o destino passou a mostrar `Grupo de Plantão: Plantão — resolvido automaticamente`; o estado não exibe mais `Nenhum Grupo de Plantão administrável nesta área` nem exige o botão Criar Plantão.

## Causa raiz

O fluxo de Plantão dependia de um `GrupoPlantao` administrável, mas o laboratório demo semeava apenas `EQ_SOC` e nenhuma entidade de Plantão. Por isso o wizard mostrava que não havia destino administrativo. Além disso, o efeito que hidrata a Jornada SOC podia reler a planilha demo quando o upload de Plantão limpava `resultado`, sobrescrevendo o contexto ativo.

## Correção aplicada

A demonstração agora possui `EQ_SOC` e `EQ_PLANTAO_COSI` como equipes distintas, um Grupo de Plantão `PLANTAO_COSI` responsável por `EQ_PLANTAO_COSI`, consulta permitida também para SOC e participantes demo. O coordenador Sofia possui as duas equipes em `equipesPermitidas`. O topo remove a equipe Plantão da seção Jornadas quando ela é responsável exclusivamente por Plantão, e o upload sincroniza o contexto ativo como `PLANTAO` usando o grupo escolhido. O upload direto também reutiliza o grupo do contexto Plantão atual ou orienta o usuário a selecioná-lo antes.

## Validação final

Com o XLS real `Relatorio-PlantaoCOSI(1).xls`, o wizard resolveu automaticamente `Grupo de Plantão: Plantão`, a prévia abriu com 32 intervalos, 3 plantonistas, 4 vínculos pendentes e o gatilho superior permaneceu em `Plantão` após o upload.
