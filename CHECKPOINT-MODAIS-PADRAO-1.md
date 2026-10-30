# CHECKPOINT — MODAIS-PADRAO-1 (padrão visual único dos modais)

## Problema
- Campo de digitação "invisível": no modal de confirmação (excluir grupo, excluir escala, desativar
  participante) e no de excluir usuário o `<input>` ficava direto num `<label>` sem estilo — sem
  borda nem fundo; só a moldura de foco aparecia ao clicar. O mesmo acontecia com a área de texto do
  modal de cancelar publicação de Plantão.
- Botão "Excluir" com `primary-button danger-button`: fundo azul com texto vermelho.

## Solução (`app/globals.css`, bloco MODAIS-PADRAO-1)
- Todos os modais (`.edit-modal`): cantos, sombra e espaçamento iguais; cabeçalho com linha divisória;
  rodapé de ações separado por linha; texto e `<code>` padronizados.
- Campos de texto, seleção e área de texto sempre com borda, fundo, foco azul e estado desabilitado.
  Seletores com `:where()` (especificidade baixa/zero): estilos próprios de cada modal continuam
  prevalecendo.
- Rótulos com campo: texto em cima, campo embaixo, largura total.
- Botão de perigo sólido (vermelho, texto branco), com versão desabilitada.
- Lista de vínculos da exclusão de Grupo em formato rótulo | valor.

## Marcação
- `ModalConfirmarComTexto` e `ModalExcluirUsuario`: texto do rótulo em `<span>` (layout estável),
  campo com placeholder e sem autocorreção.

## Validação
vitest 1517 ok · typecheck ok · lint 0 erros · test:boundaries 511/511 · build:apps ok
(CSS gerado conferido: regras novas presentes, `color-mix` com fallback).
