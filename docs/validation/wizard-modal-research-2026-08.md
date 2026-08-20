# Pesquisa — Wizard de Nova/Importar escala

**Data:** agosto de 2026  
**Objetivo:** orientar a melhoria do modal de criação/importação da escala sem hiperlinks e com mais clareza para o coordenador.

## Síntese

As referências consultadas convergem em três decisões aplicáveis ao Escala ICI: dividir o fluxo em poucos passos com objetivos claros, manter progresso visível e revelar somente as informações necessárias para o passo atual. O usuário deve poder voltar, revisar e cancelar sem perder contexto, enquanto a ação primária precisa ser única e explícita.

A referência da Lollypop descreve wizard como um fluxo estruturado em etapas, recomenda etapas de alto nível, divulgação progressiva de subpassos, progresso visível, controle do usuário e ações controladas como Voltar, Salvar/continuar e Cancelar [1].

A documentação do Material UI define Stepper como um componente para comunicar progresso em uma sequência lógica e numerada. Ela diferencia steppers lineares, não lineares, horizontais e verticais; para conteúdos dependentes de etapas anteriores, recomenda o horizontal linear e alerta contra nomes longos nos passos [2].

## Princípios aplicados às alternativas

| Princípio | Aplicação proposta |
|---|---|
| Escolha de objetivo | Primeira tela separa claramente Criar nova escala e Importar planilha, sem hiperlinks. |
| Poucos passos | Tipo → Destino/competência → Editor ou Arquivo, com nomes curtos. |
| Divulgação progressiva | Área, equipe/grupo e competência aparecem depois do tipo. Campos avançados ficam fora do primeiro passo. |
| Ação primária única | Botão final muda conforme o fluxo: “Criar escala” ou “Selecionar arquivo”. |
| Ação secundária clara | “Voltar”, “Cancelar” e “Alterar tipo” são botões/controles, nunca links sublinhados. |
| Resumo persistente | Um painel lateral/rodapé mostra operação, destino e competência escolhidos. |
| Validação antecipada | Erros aparecem junto do campo; o CTA permanece desabilitado quando falta destino obrigatório. |
| Acessibilidade | Stepper com rótulos curtos, foco visível, contraste e estados não dependentes apenas de cor. |

## Referências

[1]: https://lollypop.design/blog/2026/january/wizard-ui-design/ "Lollypop — Best Practices for High-Conversion Wizard UI Design & Examples"

[2]: https://mui.com/material-ui/react-stepper/ "Material UI — Stepper component"
