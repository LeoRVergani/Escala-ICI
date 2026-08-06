import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('migrate-usuarios-login não lista a coleção usuarios inteira', async () => {
  const script = await ler('scripts/migrate-usuarios-login.mjs');
  const codigo = script.replace(/\/\*\*[\s\S]*?\*\//, ''); // remove o comentário de cabeçalho

  assert.doesNotMatch(
    codigo,
    /getDocs\(\s*collection\(db, ['"](usuarios|turnosMes|rascunhosTurnosMes)['"]\)\s*\)/,
    'toda leitura de coleção precisa vir filtrada por equipeId (query + where), nunca getDocs(collection(...)) direto — as Firestore Rules negam list sem esse filtro',
  );

  assert.match(script, /where\('equipeId', '==', equipeId\)/);
  assert.match(script, /query\(collection\(db, 'usuarios'\), where\('equipeId', '==', equipeId\)\)/);
  assert.match(script, /query\(collection\(db, nomeColecao\), where\('equipeId', '==', equipeId\)\)/);
});

test('migrate-usuarios-login descobre a equipe a partir do perfil do gestor', async () => {
  const script = await ler('scripts/migrate-usuarios-login.mjs');

  assert.match(script, /currentUser\.uid/);
  assert.match(script, /loginDoEmail\(/);
  assert.match(script, /carregarPerfilGestor/);
  assert.match(script, /não encontrei o perfil do gestor/);
  assert.match(script, /não tem equipeId válido/);
});

test('migrate-usuarios-login continua dry-run por padrão e exige confirmação explícita para gravar', async () => {
  const script = await ler('scripts/migrate-usuarios-login.mjs');

  assert.match(script, /const execute = process\.argv\.includes\('--execute'\)/);
  assert.match(script, /--confirm=MIGRAR_STAGING/);
  assert.match(script, /nada foi gravado no Firestore \(dry-run\)/);
});

test('migrate-usuarios-login imprime o resumo exigido do plano', async () => {
  const script = await ler('scripts/migrate-usuarios-login.mjs');

  assert.match(script, /gestor autenticado: /);
  assert.match(script, /equipeId migrada: /);
  assert.match(script, /usuarios que seriam criados em usuarios\/\{login\}: /);
  assert.match(script, /turnosMes que seriam migrados para ID por login: /);
  assert.match(script, /rascunhosTurnosMes que seriam migrados para ID por login: /);
  assert.match(script, /conflitos: /);
});
