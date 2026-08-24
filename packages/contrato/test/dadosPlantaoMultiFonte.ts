import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const caminhoFixturePlantaoCodb = fileURLToPath(
  new URL('./fixtures/Plantao-CODB-SANITIZADO.xls', import.meta.url),
);

/**
 * Fixture sanitizada (nomes fictícios) que reproduz a estrutura real do
 * Plantão CODB (Fase IMPORTADOR-PLANTAO-CODB-XLS-VISUAL-REFERENCIA-1):
 * quatro colunas de fonte (DBA/Linux/Telecom/Windows) compartilhando o
 * mesmo par Data Início/Data Fim por linha, incluindo os casos de borda
 * observados na planilha real analisada — aviso de dia da semana divergente
 * e uma fonte sem plantonista numa janela. A planilha real
 * (`Relatorio-PlantaoCODB.xls`) nunca foi e nunca deve ser versionada — ver
 * `docs/spec/PLANTOES.md`.
 */
export function carregarFixturePlantaoCodb(): ArrayBuffer {
  const bytes = readFileSync(caminhoFixturePlantaoCodb);
  return Uint8Array.from(bytes).buffer;
}
