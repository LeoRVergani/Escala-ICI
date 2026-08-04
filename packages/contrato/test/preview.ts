import { parsePlanilhaEscala } from '../src/index.js';
import { carregarFixture, OPCOES_SOC } from './dados.js';

const resultado = parsePlanilhaEscala(carregarFixture(), OPCOES_SOC);
const ivcarvalho = resultado.documentos.find(
  ({ login }) => login === 'ivcarvalho',
);

if (ivcarvalho === undefined) {
  throw new Error('Documento de ivcarvalho não foi gerado.');
}

console.log(JSON.stringify(ivcarvalho, null, 2));
