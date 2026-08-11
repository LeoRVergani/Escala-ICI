import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import test from 'node:test';

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');

const EXTENSOES_FONTE = new Set(['.ts', '.tsx']);
const DIRETORIOS_IGNORADOS = new Set(['node_modules', 'dist', '.git']);

async function listarArquivosFonte(caminhoRelativo) {
  const base = new URL(caminhoRelativo, raiz);
  const resultado = [];

  async function percorrer(url, prefixo) {
    let entradas;
    try {
      entradas = await readdir(url, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entrada of entradas) {
      if (DIRETORIOS_IGNORADOS.has(entrada.name)) {
        continue;
      }
      const caminhoFilho = `${prefixo}/${entrada.name}`;
      if (entrada.isDirectory()) {
        await percorrer(new URL(`${entrada.name}/`, url), caminhoFilho);
      } else if (EXTENSOES_FONTE.has(extname(entrada.name))) {
        resultado.push(join(caminhoRelativo, caminhoFilho));
      }
    }
  }

  await percorrer(base, '');
  return resultado;
}

test('apps/dashboard e apps/app nunca declaram firebase-admin como dependência', async () => {
  const [raizPkg, dashboardPkg, appPkg] = await Promise.all([
    ler('package.json'),
    ler('apps/dashboard/package.json'),
    ler('apps/app/package.json'),
  ]);

  for (const [nome, conteudo] of [
    ['package.json (raiz)', raizPkg],
    ['apps/dashboard/package.json', dashboardPkg],
    ['apps/app/package.json', appPkg],
  ]) {
    const pacote = JSON.parse(conteudo);
    assert.equal('firebase-admin' in (pacote.dependencies ?? {}), false, `${nome} não deve depender de firebase-admin`);
    assert.equal(
      'firebase-admin' in (pacote.devDependencies ?? {}),
      false,
      `${nome} não deve depender de firebase-admin (dev)`,
    );
  }
});

test('nenhum arquivo fonte de apps/dashboard, apps/app, components ou lib importa firebase-admin ou o push-worker', async () => {
  const diretorios = ['apps/dashboard/src', 'apps/app/src', 'components', 'lib'];
  const arquivos = (await Promise.all(diretorios.map((dir) => listarArquivosFonte(dir)))).flat();

  assert.ok(arquivos.length > 20, 'esperava encontrar bastante código fonte para varrer — a varredura pode estar quebrada');

  const conteudos = await Promise.all(arquivos.map((arquivo) => ler(arquivo)));

  arquivos.forEach((arquivo, indice) => {
    const conteudo = conteudos[indice];
    assert.doesNotMatch(conteudo, /firebase-admin/, `${arquivo} não deve referenciar firebase-admin`);
    assert.doesNotMatch(conteudo, /apps\/push-worker/, `${arquivo} não deve referenciar apps/push-worker`);
  });
});

test('o pacote push-worker permanece isolado: workspace próprio, sem entrar no build estático dos apps', async () => {
  const [pkg, vitest, tsconfigRaiz] = await Promise.all([
    ler('apps/push-worker/package.json'),
    ler('vitest.config.ts'),
    ler('tsconfig.json'),
  ]);

  const pacote = JSON.parse(pkg);
  assert.equal(pacote.name, '@escala-ici/push-worker');
  assert.ok('firebase-admin' in (pacote.dependencies ?? {}), 'push-worker deve ser o único a depender de firebase-admin');

  assert.match(vitest, /apps\/push-worker\/test/);
  assert.match(tsconfigRaiz, /apps\/push-worker/);
});

test('o Docker do push-worker lê o secret via grupo suplementar, nunca como root', async () => {
  const [dockerfile, compose, operacao] = await Promise.all([
    ler('deploy/push-worker/Dockerfile'),
    ler('deploy/push-worker/compose.yaml'),
    ler('docs/operacao/PUSH-FCM-OPERACAO.md'),
  ]);

  assert.match(dockerfile, /^USER node$/m, 'o processo principal deve continuar rodando como node');

  assert.doesNotMatch(compose, /^\s*user:\s*["']?(root|0)["']?/m, 'compose não deve fixar user: root/0');
  assert.match(compose, /group_add:/, 'compose deve conceder acesso ao secret via group_add');
  assert.match(compose, /PUSH_SECRET_GID/, 'group_add deve referenciar PUSH_SECRET_GID');

  const conteudos = [compose, operacao, dockerfile].join('\n');
  assert.doesNotMatch(compose, /0444/, 'compose não deve recomendar 0444 (leitura pública) para a chave');
  assert.doesNotMatch(
    operacao,
    /chmod\s+0444/,
    'o runbook não deve instruir chmod 0444 (leitura pública) para a chave',
  );
  assert.doesNotMatch(
    conteudos,
    /private_key|BEGIN PRIVATE KEY|client_email/i,
    'nenhum arquivo de deploy/docs deve conter conteúdo de credencial',
  );
  assert.doesNotMatch(compose, /^\s*ports:/m, 'push-worker não deve publicar porta');
});
