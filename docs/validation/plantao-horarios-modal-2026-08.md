## Validação inicial

O modal D abriu no editor manual com duas colunas, cartões semânticos, resumo do horário selecionado e ação de exceção manual. A primeira validação identificou uma duplicação visual: os padrões presentes no Grupo de Plantão e os presets de compatibilidade foram comparados por identificadores diferentes. O helper será ajustado para deduplicar pela identidade efetiva `horaInicio + horaFim + fimDiaOffset`, mantendo apenas Noturno, Diurno e 24 horas.

Após a correção, o runtime exibe exatamente três cartões na ordem **Noturno**, **Diurno** e **24 horas**, com as tonalidades azul, roxa e âmbar. A ação **Definir horário fora do padrão** abre os campos de Data final, Hora inicial e Hora final, mantendo o resumo do plantão e a validação de duração.

## Implementação concluída

O modal D foi aplicado ao fluxo real de criação e edição. Ele recebe os padrões derivados do Grupo de Plantão, reconhece padrões existentes ao editar, preenche o primeiro padrão ao criar, recalcula a data final para turnos que terminam no dia seguinte e mantém a ação secundária de horário fora do padrão. O helper `horariosPlantao.ts` deduplica horários por início, fim e deslocamento de dia e ordena os cartões como Noturno, Diurno e 24 horas.

A spec reutilizável foi criada em `docs/spec/PLANTAO_MODAL_D.md`, com layout, estados, cores semânticas, acessibilidade, responsividade e regras de domínio.

## Verificação

A suíte completa passou com 56 arquivos e 954 testes. Typecheck, build e validação do artefato passaram. O lint terminou sem erros; os 6 avisos restantes pertencem aos testes Firebase já existentes.
