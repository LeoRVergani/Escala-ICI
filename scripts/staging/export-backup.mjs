/**
 * STAGING-RESET-HIERARQUIA-ICI-1 — exporta um backup recuperável das
 * coleções operacionais do staging (`escala-ici-staging`) ANTES de
 * qualquer reset. Somente leitura — nunca apaga, nunca escreve no
 * Firestore. Usa o Admin SDK (`firebaseAdminStaging.mjs`), que aborta se a
 * credencial não pertencer literalmente a `escala-ici-staging`.
 *
 * USO
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/export-backup.mjs
 *
 *   # Para nomear a pasta de saída de forma determinística (ex.: em teste):
 *   node scripts/staging/export-backup.mjs --timestamp=2026-08-21-22-00
 *
 * SAÍDA
 *   backups/staging/<timestamp>/<colecao>.json — um arquivo por coleção,
 *   com todos os documentos (`{ id, dados }[]`) tal como estão no Firestore.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';

export const COLECOES_BACKUP = [
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

function timestampPadrao() {
  const argumento = process.argv.find((valor) => valor.startsWith('--timestamp='));
  if (argumento) {
    return argumento.slice('--timestamp='.length);
  }
  return new Date().toISOString()
    .replace(/:/gu, '-')
    .replace(/\..+$/u, '')
    .replace('T', '-');
}

export async function exportarBackup({ db, pastaSaida, colecoes = COLECOES_BACKUP, log = console.log }) {
  await mkdir(pastaSaida, { recursive: true });
  const resumo = [];
  for (const colecao of colecoes) {
    const snapshot = await db.collection(colecao).get();
    const documentos = snapshot.docs.map((doc) => ({ id: doc.id, dados: doc.data() }));
    const arquivo = resolve(pastaSaida, `${colecao}.json`);
    await writeFile(arquivo, JSON.stringify(documentos, null, 2), 'utf8');
    resumo.push({ colecao, quantidade: documentos.length, arquivo });
    log(`[export-backup] ${colecao}: ${documentos.length} documento(s) -> ${arquivo}`);
  }
  return resumo;
}

async function main() {
  const timestamp = timestampPadrao();
  const pastaSaida = resolve('backups', 'staging', timestamp);
  const { db } = inicializarAdminStaging();
  console.log(`[export-backup] projeto: escala-ici-staging`);
  console.log(`[export-backup] destino: ${pastaSaida}`);
  const resumo = await exportarBackup({ db, pastaSaida });
  const total = resumo.reduce((soma, item) => soma + item.quantidade, 0);
  console.log(`[export-backup] concluído: ${resumo.length} coleção(ões), ${total} documento(s) no total.`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((erro) => {
    console.error(`[export-backup] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}
