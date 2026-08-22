/**
 * STAGING-RESET-HIERARQUIA-ICI-1/2/3 — semeia o organograma canônico do ICI
 * (`hierarquia-ici.mjs`) num staging (`escala-ici-staging`) recém-resetado:
 * unidades organizacionais, equipes canônicas, Grupo de Plantão, Matriz de
 * Responsáveis inicial, a conta técnica `admin` e o documento
 * `config/ambiente` (`{ staging: true }`) que liga a liberação operacional
 * ampla de `souCoordenadorOperacionalStaging()` em `firestore.rules`.
 *
 * NUNCA semeia pessoas reais — isso é feito depois, via Dashboard/Admin SDK,
 * ver `docs/spec/STAGING_RESET_HIERARQUIA_ICI.md` § 6. Com `--with-demo-users`,
 * também grava `USUARIOS_DEMO` (`usuarios-demo.mjs`) — nomes genéricos,
 * opcionais, só para testar os fluxos sem esperar o cadastro real.
 *
 * Usa o Admin SDK (bypassa `firestore.rules`) — por isso NÃO precisa de um
 * ADMIN_SISTEMA já cadastrado para rodar (diferente de
 * `scripts/seed-organizacao.mjs`, que autentica via client SDK). Mesmo
 * assim, só roda contra `escala-ici-staging`: `firebaseAdminStaging.mjs`
 * aborta para qualquer outra credencial.
 *
 * DRY-RUN POR PADRÃO — sem `--execute`, só lista o plano. Só executa de
 * verdade com:
 *
 *   --execute --confirm=SEED_HIERARQUIA_ICI_STAGING
 *
 * Idempotente: pode rodar mais de uma vez (usa `set`, não `create`) — não
 * duplica nem falha se os documentos já existirem.
 *
 * USO
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/seed-hierarquia-ici.mjs --dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/seed-hierarquia-ici.mjs --execute --confirm=SEED_HIERARQUIA_ICI_STAGING
 *
 *   # Opcional — também grava usuários de demonstração (nomes genéricos):
 *   node scripts/staging/seed-hierarquia-ici.mjs --with-demo-users --execute --confirm=SEED_HIERARQUIA_ICI_STAGING
 */
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';
import {
  EQUIPES,
  GRUPO_PLANTAO,
  MATRIZ_INICIAL,
  UNIDADES,
  USUARIOS_SEED,
  idEscopoOperacional,
} from './hierarquia-ici.mjs';
import { USUARIOS_DEMO } from './usuarios-demo.mjs';

const CONFIRMACAO = 'SEED_HIERARQUIA_ICI_STAGING';

export function analisarArgumentos(argv) {
  return {
    execute: argv.includes('--execute'),
    confirmado: argv.includes(`--confirm=${CONFIRMACAO}`),
    comUsuariosDemo: argv.includes('--with-demo-users'),
  };
}

function agora() {
  return new Date().toISOString();
}

export function montarPlano({ carimbo = agora(), atorLogin = 'seed-hierarquia-ici', comUsuariosDemo = false } = {}) {
  const unidades = UNIDADES.map((unidade) => ({
    ref: ['unidadesOrganizacionais', unidade.unidadeId],
    dados: { ...unidade, criadoPorLogin: atorLogin, criadoEm: carimbo, atualizadoEm: carimbo },
  }));

  const equipes = EQUIPES.map((equipe) => ({
    ref: ['equipes', equipe.id],
    dados: { ...equipe, criadoPorLogin: atorLogin, criadoEm: carimbo, atualizadoEm: carimbo },
  }));

  const grupo = {
    ref: ['gruposPlantao', GRUPO_PLANTAO.grupoId],
    dados: { ...GRUPO_PLANTAO, criadoPorLogin: atorLogin, criadoEm: carimbo, atualizadoEm: carimbo },
  };

  const matriz = MATRIZ_INICIAL.map((escopo) => ({
    ref: ['escoposOperacionais', idEscopoOperacional(escopo.tipo, escopo.alvoId)],
    dados: {
      ...escopo,
      criadoPorLogin: atorLogin,
      atualizadoPorLogin: atorLogin,
      criadoEm: carimbo,
      atualizadoEm: carimbo,
    },
  }));

  // STAGING-RESET-HIERARQUIA-ICI-3 — `USUARIOS_SEED` é só a conta técnica
  // `admin`. `USUARIOS_DEMO` (nomes genéricos) só entra com `--with-demo-users`.
  const usuarios = [
    ...USUARIOS_SEED,
    ...(comUsuariosDemo ? USUARIOS_DEMO : []),
  ].map((usuario) => ({
    ref: ['usuarios', usuario.login],
    dados: { ...usuario, criadoEm: carimbo, atualizadoEm: carimbo },
  }));

  const ambiente = {
    ref: ['config', 'ambiente'],
    dados: { staging: true, atualizadoEm: carimbo, atualizadoPorLogin: atorLogin },
  };

  return { unidades, equipes, grupo, matriz, usuarios, ambiente, comUsuariosDemo };
}

function imprimirPlano(plano, log) {
  log('[seed-hierarquia-ici] plano de unidadesOrganizacionais:');
  for (const item of plano.unidades) {
    log(`  ${item.dados.unidadeId} (${item.dados.tipo}) — ${item.dados.caminho.join(' > ')}`);
  }
  log('[seed-hierarquia-ici] plano de equipes:');
  for (const item of plano.equipes) {
    log(`  ${item.dados.id} — unidadeId=${item.dados.unidadeId} — caminhoUnidade=${item.dados.caminhoUnidade.join(' > ')}`);
  }
  log('[seed-hierarquia-ici] plano de gruposPlantao:');
  log(`  ${plano.grupo.dados.grupoId} — equipeResponsavelId=${plano.grupo.dados.equipeResponsavelId} equipesConsulta=${plano.grupo.dados.equipesConsulta.join(', ')}`);
  log('[seed-hierarquia-ici] plano de escoposOperacionais (Matriz):');
  for (const item of plano.matriz) {
    log(`  ${item.ref[1]} — responsaveisLogin=${item.dados.responsaveisLogin.join(', ')}`);
  }
  log(`[seed-hierarquia-ici] plano de usuarios${plano.comUsuariosDemo ? ' (inclui usuários de demonstração — nomes genéricos)' : ' (só a conta técnica admin — nenhuma pessoa real ou fictícia)'}:`);
  for (const item of plano.usuarios) {
    log(`  ${item.dados.login} — perfil=${item.dados.perfil} equipeId=${item.dados.equipeId} escopo=${item.dados.escopo}`);
  }
  log('[seed-hierarquia-ici] plano de config/ambiente:');
  log(`  staging=${plano.ambiente.dados.staging} (liga souCoordenadorOperacionalStaging() em firestore.rules)`);
}

export async function aplicarPlano({ db, plano, log = console.log }) {
  const todos = [
    ...plano.unidades,
    ...plano.equipes,
    plano.grupo,
    ...plano.matriz,
    ...plano.usuarios,
    plano.ambiente,
  ];
  let lote = db.batch();
  let contadorNoLote = 0;
  for (const item of todos) {
    const referencia = db.doc(item.ref.join('/'));
    lote.set(referencia, item.dados, { merge: true });
    contadorNoLote += 1;
    if (contadorNoLote === 400) {
      await lote.commit();
      lote = db.batch();
      contadorNoLote = 0;
    }
  }
  if (contadorNoLote > 0) {
    await lote.commit();
  }
  log(`[seed-hierarquia-ici] gravado: ${todos.length} documento(s).`);
}

async function main() {
  const { execute, confirmado, comUsuariosDemo } = analisarArgumentos(process.argv);
  if (execute && !confirmado) {
    throw new Error(`Para executar de verdade, use --execute --confirm=${CONFIRMACAO}.`);
  }
  const modo = execute ? 'EXECUTANDO (grava no Firestore)' : 'DRY-RUN (só lista o plano)';

  const { db } = inicializarAdminStaging();
  console.log('[seed-hierarquia-ici] projeto: escala-ici-staging');
  console.log(`[seed-hierarquia-ici] modo: ${modo}`);
  if (comUsuariosDemo) {
    console.log('[seed-hierarquia-ici] --with-demo-users: também vai gravar USUARIOS_DEMO (nomes genéricos, opcional).');
  }

  const plano = montarPlano({ comUsuariosDemo });
  imprimirPlano(plano, console.log);

  if (!execute) {
    console.log('[seed-hierarquia-ici] nada foi gravado (dry-run). Revise o plano acima antes de rodar com --execute --confirm=SEED_HIERARQUIA_ICI_STAGING.');
    process.exit(0);
  }

  await aplicarPlano({ db, plano });
  console.log('[seed-hierarquia-ici] concluído. Rode validate-staging.mjs para conferir.');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((erro) => {
    console.error(`[seed-hierarquia-ici] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}
