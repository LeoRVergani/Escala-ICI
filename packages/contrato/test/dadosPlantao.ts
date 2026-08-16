import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const caminhoFixturePlantao = fileURLToPath(
  new URL('./fixtures/Plantao-COSI-SANITIZADO.xls', import.meta.url),
);

/**
 * Fixture sanitizada (nomes fictícios) que reproduz a estrutura, os casos
 * de borda (virada de dia, 43h e 5h) e a divergência real entre a soma
 * bruta dos intervalos (504h) e a contabilidade informada (468h) da
 * planilha real de Plantão analisada na Fase PLANTÃO-0/1. A planilha real
 * nunca foi e nunca deve ser versionada — ver `docs/spec/PLANTOES.md`.
 */
export function carregarFixturePlantao(): ArrayBuffer {
  const bytes = readFileSync(caminhoFixturePlantao);
  return Uint8Array.from(bytes).buffer;
}
