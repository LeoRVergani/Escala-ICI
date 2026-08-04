# Checkpoint Fase 3H — convergência visual Semana + Agenda

## Objetivo concluído

O App do colaborador foi reorganizado para seguir a composição visual aprovada
nos mockups “Semana + Agenda”, preservando os dados, a autenticação, o PWA e o
contrato de somente leitura existentes.

## Principais mudanças

- navegação “Agenda” como entrada principal da escala;
- desktop com indicadores do período, agenda vertical e detalhe do dia;
- tablet com lista e detalhe lado a lado;
- celular com saudação, semana compacta, turno selecionado e linha do tempo dos
  próximos dias;
- cards de turno com ícones e cores semânticas;
- detalhe do dia com horário, tipo da escala, data e aviso de somente leitura;
- hierarquia tipográfica, espaçamento, sombras e gradiente lateral aproximados
  da referência;
- eliminação da rolagem horizontal da página no celular;
- modo claro alinhado aos mockups e modo escuro preservando a paleta SOC.

## O que foi preservado

- parser e contrato da escala;
- calendário completo como visualização alternativa;
- telas Hoje, Equipe e Perfil;
- Firebase opcional e demonstração local;
- bloqueio de escrita no App do colaborador;
- PWA, manifesto, service worker e atualização segura;
- Dashboard administrativo independente.

## Correções 3H.1

- no celular, a visualização **Calendário** ocupa toda a largura e aparece sem
  o card de detalhe concorrendo por espaço;
- as siglas MD, M, T, N, DF e DU permanecem legíveis no resumo semanal tanto no
  tema claro quanto no escuro;
- o desenho da lua de Madrugada foi alinhado dentro do círculo do próximo
  turno.

## Validação

```bash
npm run check:phase3h
```

O comando executa tipagem, testes unitários e de limites, preflight do Firebase,
regras do Firestore em emulador, lint, builds dos dois produtos, validação do
artefato, PWA e contrato Firebase.
