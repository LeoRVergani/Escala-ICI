import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * SEGURANCA-REGRA-ABERTA-1 — em 23/09 um bloco temporário
 * `match /{document=**} { allow read, write: if request.auth != null; }`
 * foi publicado e esquecido: como as Rules somam permissões, ele liberava o
 * banco inteiro a qualquer usuário logado e anulava todas as outras regras
 * (e todos os testes de negação passavam a falhar). Nunca mais.
 */
test('firestore.rules não tem regra pega-tudo nem liberação genérica por login', async () => {
  const regras = (await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'))
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//') && !linha.trim().startsWith('*'))
    .join('\n');
  assert.doesNotMatch(regras, /match\s+\/\{[a-zA-Z_]+=\*\*\}/u, 'não pode existir match recursivo (=**) no topo das regras');
  assert.doesNotMatch(regras, /allow\s+[a-z, ]*:\s*if\s+request\.auth\s*!=\s*null\s*;/u, 'nenhuma regra pode liberar só por estar logado');
  assert.doesNotMatch(regras, /allow\s+(?:write|create|update|delete)[a-z, ]*:\s*if\s+true\s*;/u, 'nenhuma escrita liberada incondicionalmente');
});
