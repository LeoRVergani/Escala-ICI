# Checkpoint Fase 3F — fidelidade visual responsiva

## Referências adotadas

Os mockups reenviados pelo usuário foram tratados como contrato visual:

- composição principal da opção com calendário e cartões;
- prioridade da tela **Hoje primeiro**;
- agenda vertical da opção **Semana + Agenda**;
- mesmas decisões de hierarquia em desktop, tablet e celular;
- tema claro dos mockups e tema escuro com a paleta SOC preservada.

## Tela Hoje

- grande bloco roxo substituído por cartão claro e compacto;
- ícone circular do turno;
- descrição, horário e data agrupados;
- estado da jornada em selo discreto;
- próximo turno em cartão equivalente, com cor e ícone do turno;
- semana completa compactada em sete colunas;
- dia atual destacado sem ocupar espaço excessivo;
- equipe do dia preservada abaixo do resumo.

## Minha escala

- calendário sem tabela horizontal no celular;
- células compactas com código circular do turno;
- sete colunas reais em desktop, tablet e mobile;
- preenchimento visual da última semana;
- detalhe do dia preservado ao lado no desktop e abaixo no celular;
- alternância Calendário/Agenda preservada;
- Agenda continua sendo a visualização inicial no celular.

## Navegação e identidade

- sidebar roxa no App em desktop;
- sidebar compacta por ícones no tablet;
- topo móvel com nome e símbolo oficial;
- navegação inferior fixa com quatro destinos:
  - Hoje;
  - Escala;
  - Equipe;
  - Perfil.
- tela Perfil somente leitura adicionada;
- símbolo oficial preservado.

## Segurança preservada

- App continua sem operações administrativas;
- Dashboard não recebeu a nova navegação do colaborador;
- bloqueio de escrita oficial da Fase 3E preservado;
- PWA, cache e atualização segura preservados.

## Validação

```bash
npm run check:phase3f
```

Também foi feita revisão interativa no tema claro e no tema escuro, incluindo
Hoje, Minha escala, calendário, troca de tema e navegação.

## Pendências externas antes de publicar

- fornecer configuração do Firebase de validação;
- confirmar login real de gestor e colaborador;
- confirmar leitura de uma escala publicada;
- instalar o PWA em um celular e um computador reais;
- testar abertura offline após login em dispositivo confiável;
- somente então decidir a troca da produção.
