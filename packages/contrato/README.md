# Pacote `@escala-ici/contrato`

Biblioteca TypeScript da Fase 1 para interpretar a planilha legada de escala
SOC. O pacote não possui interface, Firebase ou persistência.

## Executar

```bash
npm install
npm run typecheck
npm test
npm run preview
```

O comando `preview` imprime o documento completo gerado para `ivcarvalho`.

## Uso

```ts
import { parsePlanilhaEscala } from '@escala-ici/contrato';

const resultado = parsePlanilhaEscala(arquivo, {
  equipeId: 'EQ_SOC',
  competencia: '2026-08',
  catalogo,
  loginParaUid,
});

if (!resultado.ok) {
  // Exibir o preview e corrigir todos os erros.
  // Nunca persistir documentos inválidos.
}
```

O parser detecta a estrutura da aba `Escalistas`, usa a aba `Escala` somente
para resolver o ano e mantém datas completas no formato ISO. Células vazias não
entram no mapa `dias`; elas não são transformadas em folga.
