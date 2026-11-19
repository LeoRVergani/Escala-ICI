# Inverter escalas (INVERSAO-ESCALAS-1)

Botão **"Inverter escalas"** no Dashboard, ao lado de "Adicionar colaborador", para quando duas pessoas combinam de trocar (ex.: "já combinei com o Daniel, eu folgo no
Natal"). O coordenador troca tudo de uma vez, em vez de célula por célula.

## O que faz

Uma **permuta** entre duas pessoas: em cada dia do período, uma passa a ter o que a outra tinha. Padrão: **todo o período** da escala; atalhos **Natal (24 e 25/12)** e
**Ano Novo (31/12 e 01/01)** quando a escala passa por essas datas; ou datas escolhidas à mão.

- Só os dias em que as duas **diferem** mudam; os que já eram iguais são contados e pulados.
- Um dia que falta na escala de uma das duas **não é inventado**: fica como está e é informado.
- Quando o período cobre **todos** os dias das duas, o **turno-base** (`turnoPadrao`, que agrupa a grade em Madrugada/Manhã/Tarde/Noite) também troca.
- O `seq` (contador de dias seguidos da importação) dos dias trocados é descartado; os totais são recalculados.

## Cobertura e regras

Como é uma permuta, a **cobertura** de cada turno em cada dia **não muda** — só muda quem faz o quê. O que pode mudar são os alertas de regra de **cada uma das duas** (descanso mínimo,
35 h depois da folga, dias seguidos). Antes de aplicar, a janela mostra, com a **mesma conferência da edição de uma célula** (`diferencaDeProblemas`):

- *"Nenhum problema novo nas regras"* (e, se for o caso, quantos problemas já existentes a troca **resolve**); ou
- *"Esta inversão cria N problema(s)"*, com a lista, e o botão passa a **"Inverter mesmo assim"**. A decisão continua sendo do coordenador.

## O que NÃO faz

- **Não grava nada.** Aplicar só altera o **rascunho local**; "Salvar alterações" continua sendo o que persiste e "Publicar" o que avisa as pessoas. As Regras do Firestore não mudam.
- Não troca de equipe nem de pessoa dentro do documento: o `login`, o `usuarioUid` e o restante de cada documento continuam sendo da mesma pessoa.

## Desfazer

"Desfazer inversão" aparece depois de aplicar e **só enquanto o rascunho continua exatamente como a inversão o deixou** (comparação por referência): se algo foi editado depois, o botão some,
para não apagar essas edições.

## Código

- `lib/inversaoEscalas.ts` — lógica pura (`planejarInversao`, `aplicarInversaoNosDocumentos`, `conferirRegrasDaInversao`, `periodosSugeridos`).
- `apps/dashboard/src/InverterEscalasModal.tsx` — a janela (prévia dia a dia, atalhos, conferência).
- `apps/dashboard/src/DashboardApp.tsx` — `aplicarInversaoEscalas` e `desfazerUltimaInversao`.
