# Spec — Grade de Jornada 6x1 e assistente de ciclo inicial

**Status:** implementação local validada em agosto de 2026.  
**Escopo:** grade de Jornada 6x1, edição de células, preenchimento assistido do primeiro ciclo e regras de layout para futuras IAs.

## Objetivo

A grade deve permitir que o coordenador lance rapidamente o primeiro dia de trabalho de um colaborador e, opcionalmente, replique o mesmo turno nos seis dias iniciais do ciclo 6x1. A automação reduz trabalho repetitivo, mas não publica, não persiste sozinha e não impede que cada dia seja alterado depois.

> **Princípio de produto:** automatizar a repetição mecânica, manter cada célula independente e tornar conflitos visíveis antes do salvamento.

## Correção de layout obrigatória

A competência é a fonte das colunas. A grade nunca deve inferir a largura ou a janela horizontal somente pelas células já preenchidas.

| Elemento | Regra desktop | Regra responsiva |
|---|---:|---:|
| Coluna `Colaborador` | 220 px, `position: sticky`, `left: 0`, com fundo próprio e `z-index` acima das células | 190 px até 900 px; 170 px até 620 px |
| Colunas de data | 58 px por dia | 52 px até 900 px; 48 px até 620 px |
| Tabela | `table-layout: fixed`, `min-width: max-content` e rolagem horizontal | Mantém a rolagem, sem comprimir nomes ou chips |
| Janela de datas | Menor `periodoInicio` e maior `periodoFim` do conjunto filtrado | Nunca reduzir ao primeiro dia preenchido |
| Nome/login | Ellipsis dentro da coluna fixa | O nome continua legível; login pode truncar |

A função `datasDoConjunto()` deve gerar todas as datas entre a menor abertura e o maior fechamento dos documentos. Células vazias continuam sendo renderizadas e editáveis. Essa regra evita que a primeira atribuição faça a grade parecer uma tabela de uma única coluna de data.

## Assistente de ciclo 6x1

O assistente é apresentado somente quando o coordenador abre uma célula vazia (`dia.c` ausente). O modal de edição mostra um checkbox ativado por padrão:

> **Preencher ciclo inicial 6x1**  
> Ao escolher um turno de trabalho, replica o mesmo código nos próximos 5 dias livres. Cada dia continua editável.

A contagem inclui o dia escolhido. Portanto, o ciclo contém no máximo seis datas: `D`, `D+1`, `D+2`, `D+3`, `D+4` e `D+5`.

| Regra | Comportamento |
|---|---|
| Código de trabalho | Replica o mesmo `TipoTurno`, incluindo início, fim, duração e virada de dia do catálogo |
| Código de folga, férias ou ausência | Aplica somente na célula escolhida; não dispara o preenchimento 6x1 |
| Célula já preenchida | Nunca sobrescreve; adiciona a data em `datasIgnoradas` e informa o coordenador |
| Fim da competência | Para no `periodoFim`; não cria datas de outra competência |
| Outro colaborador | Nunca recebe o mesmo preenchimento; a operação é restrita ao `usuarioUid` da célula |
| Persistência | Apenas atualiza `resultado` local e marca a Jornada como não salva; o botão “Salvar alterações” continua obrigatório |
| Edição posterior | Cada célula gerada abre o editor normal e pode receber outro código sem alterar as demais |
| Repetição | Se o coordenador clicar em uma célula já preenchida, o assistente não é exibido |

### Algoritmo normativo

A implementação deve usar `calcularCicloInicialJornada6x1({ dataInicial, periodoFim, dias })`. O helper é puro e retorna `datasAplicadas` e `datasIgnoradas`. A camada de UI cria o `Dia` pelo catálogo existente, aplica o novo código somente às datas livres e recalcula os totais com `calcularTotais()`.

O helper não deve conhecer Firebase, React, modal, toast, usuário autenticado ou regras de publicação. Essa separação é obrigatória para que a IA consiga testar o comportamento sem iniciar a aplicação.

## Interação e mensagens

Depois de salvar um ciclo, a interface deve informar quantos dias foram preenchidos e quantos foram preservados. Exemplos normativos:

- `N aplicado em 6 dias do ciclo inicial. Você pode editar cada dia separadamente.`
- `N aplicado em 4 dias do ciclo inicial; 2 dias já preenchidos não foram alterados. Você pode editar cada dia separadamente.`
- `X aplicado somente neste dia; o preenchimento 6x1 automático vale para turnos de trabalho.`

A mensagem não deve afirmar que a escala foi publicada ou persistida. O estado correto é rascunho local até o salvamento explícito.

## Alertas e boas práticas

A automação não substitui a validação da Jornada. O produto deve continuar sinalizando sequência excessiva, descanso insuficiente, divergências de totais, folgas e códigos especiais. A automação deve ser conservadora: preservar qualquer célula já preenchida é preferível a substituir uma decisão manual.

O NIOSH/CDC descreve que trabalho em turnos e jornadas longas podem aumentar fadiga, riscos de segurança e perturbações de sono [1]. A HSE recomenda tratar fadiga como risco, avaliar mudanças de horário, consultar trabalhadores, definir limites para horas e trocas e registrar essas alterações; também ressalta que não existe uma única escala ideal para todos os ambientes [2]. Por isso, o ciclo assistido é uma aceleração editável, não uma regra rígida de publicação.

## Testes obrigatórios

A IA que alterar essa área deve manter testes para: seis datas exatas; competência terminando antes de seis dias; preservação de células existentes; mensagem com datas ignoradas; aplicação somente ao colaborador alvo; não expansão para códigos que não sejam de trabalho; coluna fixa com janela completa de competência; e edição manual independente depois da expansão.

Os testes puros atuais ficam em `lib/cicloJornada6x1.test.ts`, e a implementação do helper fica em `lib/cicloJornada6x1.ts`.

## Arquivos de referência da implementação

| Arquivo | Responsabilidade |
|---|---|
| `components/ScheduleGrid.tsx` | Renderiza a janela completa, coluna sticky e células editáveis |
| `apps/dashboard/src/DashboardApp.tsx` | Abre o modal, aplica o ciclo, recalcula totais e marca o rascunho como alterado |
| `lib/cicloJornada6x1.ts` | Algoritmo puro de seis dias, preservação e mensagens |
| `lib/cicloJornada6x1.test.ts` | Cobertura do algoritmo e limites |
| `app/globals.css` | Larguras fixas, sticky, rolagem e controle visual do assistente |
| `docs/validation/jornada-6x1-automacao-research-2026-08.md` | Evidências de pesquisa e validação runtime |

## Referências

[1]: https://www.cdc.gov/niosh/learning/safetyculturehc/module-2/9.html "NIOSH/CDC — Shiftwork, Long Work Hours, Fatigue"

[2]: https://www.hse.gov.uk/humanfactors/topics/fatigue.htm "Health and Safety Executive — Fatigue"
