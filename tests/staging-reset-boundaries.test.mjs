import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

// STAGING-RESET-HIERARQUIA-ICI-1 — os 4 scripts novos de scripts/staging/
// são destrutivos ou tocam dado real de staging via Admin SDK (bypassa
// firestore.rules). Este arquivo prova, por leitura estática do código
// (nunca executando de verdade), que as 3 guardas obrigatórias existem:
// dry-run por padrão, confirmação explícita com frase exata para executar,
// e projeto travado em "escala-ici-staging" (nunca produção, nunca outro
// ambiente de homologação por engano).

test('firebaseAdminStaging.mjs lê o project_id da credencial de forma independente e trava em escala-ici-staging', async () => {
  const codigo = await ler('scripts/staging/firebaseAdminStaging.mjs');
  assert.match(codigo, /PROJETO_STAGING_ESPERADO = 'escala-ici-staging'/u);
  assert.match(codigo, /GOOGLE_APPLICATION_CREDENTIALS/u);
  assert.match(codigo, /project_id/u);
  assert.doesNotMatch(codigo, /json\.private_key|credencial\.private_key|console\.\w+\([^)]*private_key/u, 'nunca ler/expor a chave privada da credencial');
  assert.match(codigo, /projectIdDaCredencial !== PROJETO_STAGING_ESPERADO/u, 'precisa abortar se o projeto não bater');
});

test('reset-staging.mjs é dry-run por padrão e só apaga com --execute --confirm=RESET_STAGING_ESCALA_ICI', async () => {
  const codigo = await ler('scripts/staging/reset-staging.mjs');
  assert.match(codigo, /CONFIRMACAO = 'RESET_STAGING_ESCALA_ICI'/u);
  assert.match(codigo, /execute && !confirmado/u);
  assert.match(codigo, /DRY-RUN \(só conta, nada é apagado\)/u);
  assert.match(codigo, /inicializarAdminStaging/u, 'precisa usar a guarda de projeto de staging');
  assert.doesNotMatch(codigo, /'EQ_SOC'|'EQ_PLANTAO_COSI'|'EQ_NOC'/u, 'nunca referencia IDs legados diretamente');
});

test('seed-hierarquia-ici.mjs é dry-run por padrão e só grava com --execute --confirm=SEED_HIERARQUIA_ICI_STAGING', async () => {
  const codigo = await ler('scripts/staging/seed-hierarquia-ici.mjs');
  assert.match(codigo, /CONFIRMACAO = 'SEED_HIERARQUIA_ICI_STAGING'/u);
  assert.match(codigo, /execute && !confirmado/u);
  assert.match(codigo, /DRY-RUN \(só lista o plano\)/u);
  assert.match(codigo, /inicializarAdminStaging/u);
  assert.match(codigo, /staging: true/u, 'precisa gravar config\\/ambiente com staging: true');
  assert.doesNotMatch(codigo, /'EQ_SOC'|'EQ_PLANTAO_COSI'|'EQ_NOC'/u, 'nunca referencia IDs legados diretamente — só via hierarquia-ici.mjs');
});

test('export-backup.mjs é somente leitura e cobre as 15 coleções pedidas', async () => {
  const codigo = await ler('scripts/staging/export-backup.mjs');
  assert.match(codigo, /inicializarAdminStaging/u);
  for (const colecao of [
    'usuarios', 'equipes', 'unidadesOrganizacionais', 'gruposPlantao', 'escoposOperacionais',
    'turnosMes', 'rascunhosTurnosMes', 'publicacoesEscala', 'historicoPublicacoes',
    'competenciasPlantao', 'rascunhosCompetenciasPlantao', 'atribuicoesPlantao',
    'trocasEscala', 'notificacoesTroca', 'auditoriaAdmin',
  ]) {
    assert.match(codigo, new RegExp(`'${colecao}'`, 'u'), `precisa exportar a coleção ${colecao}`);
  }
  assert.doesNotMatch(codigo, /\.delete\(\)|recursiveDelete/u, 'export-backup nunca apaga nada');
  assert.match(codigo, /backups.*staging/su, "grava em backups/staging/<timestamp>");
});

test('validate-staging.mjs é somente leitura e detecta qualquer ID legado remanescente', async () => {
  const codigo = await ler('scripts/staging/validate-staging.mjs');
  assert.match(codigo, /inicializarAdminStaging/u);
  assert.doesNotMatch(codigo, /\.delete\(\)|recursiveDelete|\.set\(|\.update\(/u, 'validate-staging nunca escreve nada');
  assert.match(codigo, /GRUPO_PLANTAO_LEGADO = 'PLANTAO_COSI'/u);
  assert.match(codigo, /IDS_LEGADOS_EQUIPE/u);
  assert.match(codigo, /config\/ambiente\.staging=true/u);
});

test('STAGING-RESET-HIERARQUIA-ICI-2 — validate-staging.mjs falha para unidadeId simples e detecta inversão unidade/equipe', async () => {
  const codigo = await ler('scripts/staging/validate-staging.mjs');
  assert.match(codigo, /IDS_UNIDADE_SIMPLES_PROIBIDOS.*=.*\['COSI', 'CODB', 'COCR'\]/su);
  assert.match(codigo, /export async function validarSemUnidadeIdSimples/u);
  assert.match(codigo, /export async function validarNaoInverteUnidadeEquipe/u);
  assert.match(codigo, /validarSemUnidadeIdSimples\(db\)/u);
  assert.match(codigo, /validarNaoInverteUnidadeEquipe\(db\)/u);
});

test('STAGING-RESET-HIERARQUIA-ICI-2 — hierarquia-ici.mjs usa GEDSI_COSI/GEDSI_CODB/GEDSI_COCR, nunca COSI/CODB/COCR soltos como unidadeId', async () => {
  const codigo = await ler('scripts/staging/hierarquia-ici.mjs');
  for (const idCanonico of ['GEDSI_COSI', 'GEDSI_CODB', 'GEDSI_COCR']) {
    assert.match(codigo, new RegExp(`unidadeId: '${idCanonico}'`, 'u'), `precisa existir uma unidade ${idCanonico}`);
  }
  assert.doesNotMatch(codigo, /unidadeId: 'COSI'|unidadeId: 'CODB'|unidadeId: 'COCR'/u, 'nunca um unidadeId simples de coordenação');
});

test('STAGING-RESET-HIERARQUIA-ICI-3 — hierarquia-ici.mjs (seed estrutural) nunca hardcoda pessoas reais/fictícias', async () => {
  const codigo = await ler('scripts/staging/hierarquia-ici.mjs');
  const semComentarios = codigo.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '').toLowerCase();
  for (const nomeProibido of ['marina', 'azevedo', 'wanessa', 'moriyama', 'claudio', "login: 'clis'"]) {
    assert.doesNotMatch(semComentarios, new RegExp(nomeProibido, 'u'), `"${nomeProibido}" não pode aparecer no seed estrutural (código, fora de comentários)`);
  }
  assert.match(codigo, /login: 'admin'/u, 'a única conta do seed estrutural é a técnica "admin"');
});

test('STAGING-RESET-HIERARQUIA-ICI-3 — usuarios-demo.mjs existe, é opcional e usa só nomes genéricos', async () => {
  const codigo = await ler('scripts/staging/usuarios-demo.mjs');
  assert.match(codigo, /export const USUARIOS_DEMO/u);
  const semComentarios = codigo.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '').toLowerCase();
  for (const nomeProibido of ['marina', 'azevedo', 'wanessa', 'moriyama', 'claudio', 'clis']) {
    assert.doesNotMatch(semComentarios, new RegExp(nomeProibido, 'u'), `"${nomeProibido}" não pode aparecer em usuarios-demo.mjs`);
  }
});

test('STAGING-RESET-HIERARQUIA-ICI-3 — seed-hierarquia-ici.mjs só grava USUARIOS_DEMO com --with-demo-users explícito', async () => {
  const codigo = await ler('scripts/staging/seed-hierarquia-ici.mjs');
  assert.match(codigo, /--with-demo-users/u);
  assert.match(codigo, /comUsuariosDemo/u);
  assert.match(codigo, /import \{ USUARIOS_DEMO \} from '\.\/usuarios-demo\.mjs'/u);
  assert.match(codigo, /\.\.\.\(comUsuariosDemo \? USUARIOS_DEMO : \[\]\)/u, 'sem a flag, USUARIOS_DEMO nunca entra no plano');
});

test('STAGING-RESET-HIERARQUIA-ICI-3 — validate-staging.mjs avisa sobre pessoas reais pendentes sem bloquear (não hardcoda Wanessa como coordenadora CODB)', async () => {
  const codigo = await ler('scripts/staging/validate-staging.mjs');
  assert.match(codigo, /export async function avisarPessoasReaisPendentes/u);
  assert.match(codigo, /AVISO \(não bloqueia\)/u);
  // O aviso sobre o CODB é por PAPEL (GESTOR_UNIDADE de GEDSI_CODB), nunca citando "Wanessa" como a coordenadora.
  assert.doesNotMatch(codigo, /wanessa.*coordenad/iu, 'Wanessa nunca deve ser modelada como coordenadora do CODB');
  assert.match(codigo, /SUPERVISOR_EQUIPE.*GEDSI_CODB_NOC/su, 'o papel esperado do NOC é supervisão, não coordenação de unidade');
});

test('hierarquia-ici.mjs é um módulo puro (sem I/O, sem firebase-admin, sem process.env)', async () => {
  const codigo = await ler('scripts/staging/hierarquia-ici.mjs');
  const semComentarios = codigo.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
  assert.doesNotMatch(semComentarios, /from 'firebase-admin/u);
  assert.doesNotMatch(semComentarios, /process\.env/u);
  assert.doesNotMatch(semComentarios, /from 'node:fs/u);
  assert.match(codigo, /export const MAPEAMENTO_LEGADO/u);
});

test('package.json expõe staging:backup/reset/seed/validate, todos passando pelos scripts novos', async () => {
  const pacote = JSON.parse(await ler('package.json'));
  assert.equal(pacote.scripts['staging:backup'], 'node scripts/staging/export-backup.mjs');
  assert.equal(pacote.scripts['staging:reset'], 'node scripts/staging/reset-staging.mjs');
  assert.equal(pacote.scripts['staging:seed'], 'node scripts/staging/seed-hierarquia-ici.mjs');
  assert.equal(pacote.scripts['staging:validate'], 'node scripts/staging/validate-staging.mjs');
});
