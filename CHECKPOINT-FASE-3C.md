# Checkpoint Fase 3C — Experiência adaptativa do colaborador

## Base preservada

- Fases 3A e 3B preservadas
- Dashboard continua sendo o único produto que escreve e publica
- App do colaborador continua somente leitura
- Produção não alterada nesta fase

## Entregue

- **Hoje** continua sendo a entrada principal
- Navegação inferior exclusiva do App em telas de celular
- Sidebar preservada no desktop e compactada no tablet
- Resumo semanal com acesso direto aos detalhes de cada dia
- Alternância entre Calendário e Agenda
- Agenda como visual inicial em telas de até 780 px
- Calendário alinhado ao dia correto da semana
- Detalhe acessível do dia selecionado
- Jornada, descanso, ausência, horários e virada de madrugada preservados
- Área segura inferior para celulares com recorte ou barra de gestos
- Tema claro estrutural e tema escuro com a paleta SOC

## Validação

```bash
npm run check:phase3c
```

A validação estrutural confirma:

- navegação inferior responsiva;
- presença dos modos Calendário e Agenda;
- preservação do limite de leitura do App;
- ausência de operações administrativas no produto do colaborador.

## Próximo checkpoint

A Fase 3D transformará o App em PWA instalável:

- manifesto;
- ícones;
- service worker;
- shell offline;
- atualização segura;
- critérios de instalação para desktop e celular.
