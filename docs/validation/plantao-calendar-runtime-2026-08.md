# Validação visual do calendário duplo — 18/08/2026

A prévia real foi aberta no Dashboard local em `http://127.0.0.1:4173/` usando o fluxo **Escalas → Importar escala → Plantão**, com o arquivo `/home/ubuntu/upload/Relatorio-PlantaoCOSI(1).xls`.

A tela exibiu o editor de importação com duas grades mensais lado a lado: **Julho de 2026** e **Agosto de 2026**. Os dias fora da janela `26/07/2026 → 25/08/2026` ficaram discretos, enquanto os intervalos importados permaneceram visíveis nos dias de contexto, incluindo a duração atípica de 43h em 25/07.

Os chips mostraram os nomes curtos e horários (`Caroline F.`, `Jean R.`, `Bruno B.`, `19:00 → 07:00`, `24h` e alertas de duração atípica). A legenda inferior exibiu os três plantonistas com a paleta de identidade e os tipos **Plantão noturno**, **Plantão diurno** e **Duração atípica**.

A validação também confirmou que a importação continua local, sem persistência ou alteração de regras de negócio. O viewport de 892×768 apresentou o calendário em duas colunas; o CSS prevê empilhamento responsivo abaixo de 980px e redução adicional dos chips abaixo de 780px.
