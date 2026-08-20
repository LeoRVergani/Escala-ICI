# Spec — Navegação de retorno para Escalas

**Status:** aprovada para implementação local  
**Escopo:** telas internas do módulo **Escalas**, incluindo importação, revisão de grade e fluxos equivalentes  
**Padrão escolhido:** botão compacto de ação com seta à esquerda e rótulo **“Escalas”**  
**Última atualização:** agosto de 2026

## 1. Decisão visual

O retorno para a área de escalas não deve ser apresentado como hiperlink textual sublinhado. O produto usa um controle de ação compacto, integrado ao vocabulário visual dos botões do dashboard.

O controle é composto por uma seta apontando para a esquerda e pelo rótulo **“Escalas”**. A seta fica dentro da mesma área clicável e orienta o usuário sem depender de texto auxiliar como “Voltar para”. O controle deve ser reconhecido como navegação interna, mas não deve parecer um link de documentação ou um endereço externo.

> **Regra normativa:** em telas internas do dashboard, não usar `text-decoration: underline` para o retorno entre áreas do produto. Usar o padrão `.screen-back-button` ou um componente equivalente com os mesmos estados, dimensões e semântica.

## 2. Markup recomendado

O controle deve ser um elemento `button` quando a navegação for resolvida por estado local, como `setTela('escalas')`. O ícone deve ser renderizado com Lucide ou outro ícone vetorial equivalente, ter `aria-hidden="true"` e permanecer acompanhado de um rótulo visível.

```tsx
<button
  type="button"
  className="screen-back-button"
  onClick={() => setTela('escalas')}
  aria-label="Voltar para Escalas"
>
  <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
  <span>Escalas</span>
</button>
```

Para navegação baseada em rota, manter o mesmo padrão visual e trocar somente o mecanismo de navegação. Não substituir o botão por um `<a>` estilizado apenas para simular a aparência de botão.

## 3. Especificação visual

| Elemento | Regra |
|---|---|
| Classe base | `.screen-back-button` |
| Altura mínima | `36px` |
| Espaçamento interno | `10px` à esquerda, `14px` à direita |
| Distância ícone/rótulo | `8px` |
| Raio | `var(--radius-control)`; atualmente `10px` |
| Borda | `1px solid var(--border)` |
| Fundo padrão | `var(--surface)` |
| Texto | `var(--text)`, peso semibold moderado, sem caixa alta |
| Ícone | `var(--primary-bright)`, 16px, traço aproximadamente 2.2 |
| Sombra padrão | sombra mínima de 1px para separar o controle da superfície |
| Sublinhado | proibido |
| Texto padrão | `Escalas`, sem o prefixo “Voltar para” |

O botão deve ficar alinhado ao início do conteúdo da tela, acima do eyebrow ou título principal, com margem inferior curta. Ele não deve competir visualmente com o título, com o botão primário da tela ou com os controles da competência.

## 4. Estados de interação

No estado padrão, o controle usa fundo branco ou a superfície ativa do tema, borda neutra e texto principal. No `hover`, a borda deve adquirir uma tonalidade azul discreta, o fundo deve usar `var(--primary-soft)` e o controle pode subir no máximo 1px para indicar interatividade sem causar deslocamento de layout.

No estado `active`, usar uma redução sutil de escala, sem animação longa. No estado `focus-visible`, preservar um anel de foco visível baseado em `var(--focus-ring)`. O controle deve continuar legível no tema escuro, usando os tokens de tema existentes, sem cores fixas que eliminem o contraste.

A animação deve permanecer curta, entre 150ms e 180ms, limitada a cor, sombra, opacidade ou transformação. O comportamento deve respeitar `prefers-reduced-motion` quando o componente for reutilizado em contextos com animação adicional.

## 5. Acessibilidade e semântica

O controle deve ser alcançável por teclado e possuir nome acessível. O `aria-label` deve explicar a ação completa, **“Voltar para Escalas”**, mesmo que o rótulo visual seja apenas **“Escalas”**. O ícone não deve ser a única indicação da ação.

O foco não pode depender exclusivamente de mudança de cor. O anel de foco deve ser visível em temas claro e escuro. A área clicável deve incluir o ícone e o texto inteiro, e não apenas a seta.

Não usar `title` como substituto de rótulo acessível. Não remover o controle em telas estreitas; reduzir somente o espaçamento se necessário, preservando o rótulo enquanto houver espaço útil.

## 6. Aplicação nas telas atuais

O padrão é obrigatório nos dois pontos de retorno já existentes no `DashboardApp`:

1. **Importar escala:** retorna à listagem de escalas antes do início do fluxo de upload.
2. **Grade da equipe:** retorna à listagem de escalas antes do cabeçalho “Revisão completa”.

A ação de retorno continua sendo a mesma. Esta alteração é exclusivamente visual e semântica: não modifica estado de escala, competência, importação, persistência ou regras de negócio.

## 7. Proibições

Não usar os seguintes padrões para retorno entre telas do dashboard:

- Texto solto com `text-decoration: underline`.
- Texto “← Voltar para Escalas” como único controle visual.
- Link azul sem borda, sem área de toque ou sem estado de foco.
- Ícone de seta sem rótulo visível em desktop.
- Botão primário azul preenchido, pois o retorno é uma ação secundária.
- Repetição de estilos locais com nomes diferentes para o mesmo padrão.

## 8. Critérios de aceite

A implementação está correta quando o usuário consegue identificar imediatamente o retorno para **Escalas**, quando o controle não se parece com um hiperlink antigo e quando o comportamento preserva a navegação existente.

A validação mínima deve confirmar que o botão aparece nas telas de importação e grade, que o clique retorna para a listagem, que o teclado alcança o controle, que o foco é visível, que não há sublinhado e que o layout não desloca o título ou os controles da tela.

Também deve ser verificado que a busca pelo texto antigo **“Voltar para Escalas”** não encontra mais markup visual de hiperlink nas telas abrangidas. A expressão pode permanecer somente em atributos acessíveis, documentação ou mensagens de teste quando necessária para descrever a ação.

## 9. Referência de implementação

A implementação de referência está em:

- `apps/dashboard/src/DashboardApp.tsx`: usa `ArrowLeft` e `.screen-back-button` nos fluxos de importação e grade.
- `app/globals.css`: concentra dimensões, tokens, estados de interação e foco.

Qualquer futura tela de revisão, edição ou importação que precise retornar à área de escalas deve reutilizar esse padrão, mantendo a mesma classe ou extraindo um componente compartilhado sem alterar a linguagem visual.
