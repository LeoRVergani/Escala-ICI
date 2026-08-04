# Checkpoint Fase 3B — Competência e jornada dinâmica

## Base preservada

- Fase 3A recuperada antes da implementação
- Dashboard, parser XLS e contrato Firebase de escrita preservados
- Site de produção não alterado nesta fase

## Entregue

- Tela **Hoje** como início do App do colaborador
- Resposta visual para trabalho, descanso, ausência ou escala não publicada
- Horários reais de início e término do dia
- Identificação de turno em andamento após meia-noite
- Próximo turno dentro do período publicado
- Competência 26→25 dinâmica, incluindo virada de ano
- Período e título do calendário derivados do documento
- Equipe do dia agrupada pelo código realmente escalado, não apenas pelo turno
  padrão do usuário
- Atualização do estado temporal a cada minuto
- Fallback de competências para leitura do Firebase sem mês fixo

## Validação

```bash
npm run check:phase3b
```

O domínio possui testes específicos para:

- dias 25 e 26;
- dezembro → janeiro;
- turno diurno;
- turno noturno depois da meia-noite;
- descanso e próximo turno;
- horário específico do dia prevalecendo sobre o catálogo;
- seleção do documento cujo período contém a data.

## Próximo checkpoint

A Fase 3C aplicará por completo o visual adaptativo escolhido:

- mobile com navegação inferior e foco em Hoje;
- tablet dividido;
- desktop com sidebar;
- calendário/agenda adequados a cada largura;
- modo claro da opção 3 e cores SOC da opção 2 no modo escuro.
