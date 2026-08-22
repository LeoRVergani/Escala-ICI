/**
 * STAGING-RESET-HIERARQUIA-ICI-1 — apaga TODAS as coleções operacionais do
 * staging (`escala-ici-staging`), para depois recriar a base com
 * `seed-hierarquia-ici.mjs`. NUNCA roda contra produção: `firebaseAdminStaging.mjs`
 * aborta se a credencial (`GOOGLE_APPLICATION_CREDENTIALS`) não pertencer
 * literalmente ao projeto `escala-ici-staging`.
 *
 * DRY-RUN POR PADRÃO — sem `--execute`, só conta e lista o que seria
 * apagado, nunca escreve/apaga nada. Só executa de verdade com:
 *
 *   --execute --confirm=RESET_STAGING_ESCALA_ICI
 *
 * NÃO RODE SEM TER UM BACKUP RECUPERÁVEL (`export-backup.mjs`) E APROVAÇÃO
 * HUMANA EXPLÍCITA — este script é destrutivo e não tem desfazer.
 *
 * Usa `db.recursiveDelete()` (Admin SDK) por coleção — apaga também
 * subcoleções (`gruposPlantao/{id}/participantes`,
 * `rascunhosCompetenciasPlantao/{id}/atribuicoes`,
 * `competenciasPlantao/{id}/atribuicoes`, `usuarios/{login}/lembretes`),
 * garantindo que nada fique órfão. Nunca toca `config/ambiente` diretamente
 * aqui — `seed-hierarquia-ici.mjs` é quem escreve esse doc depois.
 *
 * USO
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/reset-staging.mjs --dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/reset-staging.mjs --execute --confirm=RESET_STAGING_ESCALA_ICI
 */
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';

export const COLECOES_RESET = [
  'usuarios',
  'equipes',
  'unidadesOrganizacionais',
  'gruposPlantao',
  'escoposOperacionais',
  'turnosMes',
  'rascunhosTurnosMes',
  'publicacoesEscala',
  'historicoPublicacoes',
  'competenciasPlantao',
  'rascunhosCompetenciasPlantao',
  'atribuicoesPlantao',
  'trocasEscala',
  'notificacoesTroca',
  'auditoriaAdmin',
];

const CONFIRMACAO = 'RESET_STAGING_ESCALA_ICI';

export function analisarArgumentos(argv) {
  return {
    execute: argv.includes('--execute'),
    confirmado: argv.includes(`--confirm=${CONFIRMACAO}`),
  };
}

export async function contarColecoes({ db, colecoes = COLECOES_RESET }) {
  const contagens = [];
  for (const colecao of colecoes) {
    const agregado = await db.collection(colecao).count().get();
    contagens.push({ colecao, quantidade: agregado.data().count });
  }
  return contagens;
}

export async function apagarColecoes({ db, colecoes = COLECOES_RESET, log = console.log }) {
  for (const colecao of colecoes) {
    await db.recursiveDelete(db.collection(colecao));
    log(`[reset-staging] apagado: ${colecao} (e subcoleções, se houver).`);
  }
}

async function main() {
  const { execute, confirmado } = analisarArgumentos(process.argv);
  if (execute && !confirmado) {
    throw new Error(`Para executar de verdade, use --execute --confirm=${CONFIRMACAO}.`);
  }
  const modo = execute ? 'EXECUTANDO (apaga de verdade)' : 'DRY-RUN (só conta, nada é apagado)';

  const { db } = inicializarAdminStaging();
  console.log('[reset-staging] projeto: escala-ici-staging');
  console.log(`[reset-staging] modo: ${modo}`);

  const contagens = await contarColecoes({ db });
  console.log('[reset-staging] plano de apagamento:');
  let total = 0;
  for (const { colecao, quantidade } of contagens) {
    console.log(`  ${colecao}: ${quantidade} documento(s)`);
    total += quantidade;
  }
  console.log(`[reset-staging] total: ${total} documento(s) em ${contagens.length} coleção(ões).`);

  if (!execute) {
    console.log('[reset-staging] nada foi apagado (dry-run). Garanta um backup recuperável (export-backup.mjs) e aprovação humana explícita antes de rodar com --execute --confirm=RESET_STAGING_ESCALA_ICI.');
    process.exit(0);
  }

  await apagarColecoes({ db });
  console.log('[reset-staging] concluído: staging apagado. Rode seed-hierarquia-ici.mjs para recriar a base.');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((erro) => {
    console.error(`[reset-staging] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}
