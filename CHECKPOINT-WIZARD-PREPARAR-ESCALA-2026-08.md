# Checkpoint — Wizard Preparar escala

**Estado:** atualizado localmente após implementação do modal aprovado.  
**Regra:** ler junto com `docs/spec/WIZARD_PREPARAR_ESCALA.md` antes de editar `ScheduleStartWizard.tsx`.

## Decisões preservadas

O modal não deve mostrar `1 Tipo`, `2 Destino`, `3 Revisar`, porque esses rótulos não correspondem a páginas independentes no fluxo atual. O modal apresenta o contexto escolhido em um resumo e mantém as decisões reais na mesma superfície.

A intenção é definida pelo modo de abertura: `NOVA` significa escala vazia para preencher no editor; `IMPORTAR` significa selecionar uma planilha, revisar os dados e então continuar para a revisão. Não criar uma terceira ordem visual.

## Ordem real

A ordem é tipo de operação, destino, competência, arquivo quando Importar e editor/revisão. O arquivo só aparece após tipo, destino e competência válidos. O CTA fica desabilitado enquanto faltar uma decisão obrigatória.

## Nomes dinâmicos

Nunca fixar `SOC` no componente. Jornada deve usar `equipe.nome` quando `equipeId` estiver resolvido; o nome pode ser SOC, NOC ou outra equipe cadastrada. Plantão deve usar `grupo.nome`; o sistema pode ter Plantão COSI, Plantão CODB, Plantão Infra, Plantão Redes ou novos grupos configurados no futuro.

Os fallbacks visuais são somente `Jornada 6x1` e `Plantão`, usados antes de a seleção ser resolvida. Eles não devem ser persistidos nem substituir o nome real depois da resolução.

## Ações

`Alterar` é botão secundário com ícone, não hyperlink. Cancelar, fechar, criar equipe, criar grupo, usar período anterior, selecionar arquivo e continuar também são controles de botão/label acessíveis. Não usar `link-button` dentro do modal.

## Não regressão

Não alterar o wizard unificado, os handlers `onEscolherTipo`, `onContinuar`, `onSelecionarArquivo`, `onMudarEquipe`, `onMudarGrupo` e `onMudarCompetencia`, nem duplicar regras do DashboardApp. Não alterar schema Firebase, persistência, Rules, parser, grade 6x1, ciclo inicial, calendário Plantão, Modal D ou revisão SOC.

## Validação obrigatória

Depois de qualquer edição:

```bash
cd /home/ubuntu/Escala-ICI
npm run check
```

Validar no runtime os fluxos Nova e Importar, a ausência dos textos do stepper, ausência de hiperlinks, resolução de equipe NOC/SOC e seleção de grupos Plantão configuráveis. Gerar sempre o ZIP completo atualizado, patch, spec, checkpoint e captura real.
