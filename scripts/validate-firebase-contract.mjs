import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  ambiente,
  cliente,
  autenticacao,
  escrita,
  politica,
  regras,
  appColaborador,
  preflight,
] = await Promise.all([
  readFile(new URL('../.env.example', import.meta.url), 'utf8'),
  readFile(new URL('../lib/firebase/client.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/firebase/authRepository.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/firebase/writeRepository.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/firebase/environment.ts', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../apps/app/src/EmployeeApp.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./firebase-preflight-lib.mjs', import.meta.url), 'utf8'),
]);

assert.match(
  ambiente,
  /VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false/,
  'A escrita oficial deve permanecer desabilitada no exemplo.',
);
assert.match(
  cliente,
  /persistentLocalCache/,
  'O App deve manter suporte a cache persistente.',
);
assert.match(
  politica,
  /HOSTS_LOCAIS[\s\S]*localhost[\s\S]*127\.0\.0\.1/,
  'Os emuladores localhost devem permanecer limitados ao ambiente local.',
);
assert.match(
  politica,
  /VITE_FIREBASE_LAN_MODE[\s\S]*VITE_FIREBASE_ENVIRONMENT[\s\S]*hostIpv4Privado/,
  'O laboratório LAN deve exigir modo explícito, ambiente local e IPv4 privado.',
);
assert.match(
  autenticacao,
  /onAuthStateChanged/,
  'A sessão autenticada deve ser restaurada ao reabrir o App.',
);
assert.match(
  autenticacao,
  /browserLocalPersistence[\s\S]*browserSessionPersistence/,
  'A persistência deve diferenciar dispositivo confiável e sessão temporária.',
);
assert.equal(
  escrita.match(/exigirEscritaAdministrativaHabilitada\(\);/g)?.length,
  7,
  'Toda operação administrativa exportada deve exigir ambiente local ou habilitação oficial explícita.',
);
assert.match(
  escrita,
  /export async function salvarUsuarios[\s\S]*exigirEscritaAdministrativaHabilitada\(\);[\s\S]*writeBatch/,
  'O cadastro em lote de usuários importados deve permanecer protegido e atômico.',
);
assert.match(
  escrita,
  /rascunhosTurnosMes[\s\S]*historicoPublicacoes[\s\S]*versoesEscala/,
  'Rascunho, histórico e versões devem permanecer separados da escala publicada.',
);
assert.match(
  escrita,
  /export async function reverterPublicacao[\s\S]*tipo: 'ROLLBACK'/,
  'O rollback deve criar uma nova revisão auditável.',
);
assert.match(
  politica,
  /escritaAdministrativa: emuladoresLaboratorio \|\| escritaOficial/,
  'A escrita de laboratório deve ser independente da escrita oficial.',
);
assert.match(
  regras,
  /resource\.data\.status == 'PUBLICADA'[\s\S]*souGestor\(\)/,
  'As regras devem ocultar rascunhos de colaboradores.',
);
assert.match(
  regras,
  /match \/eventosEscala[\s\S]*resource\.data\.usuarioUid == request\.auth\.uid[\s\S]*allow update, delete: if false/,
  'Cada colaborador deve ler somente os próprios eventos, que permanecem imutáveis.',
);
assert.doesNotMatch(
  appColaborador,
  /writeRepository|salvarRascunho|publicarEscalas|salvarUsuario/,
  'O App do colaborador não pode importar operações administrativas.',
);
assert.match(
  preflight,
  /resumoSeguroFirebase/,
  'O preflight deve produzir somente um diagnóstico sanitizado.',
);
assert.match(
  preflight,
  /A escrita oficial está habilitada/,
  'O preflight deve reprovar escrita oficial por padrão.',
);

console.log(
  'Contrato Firebase validado: sessão, cache, emuladores, diagnóstico seguro e bloqueio de escrita oficial.',
);
