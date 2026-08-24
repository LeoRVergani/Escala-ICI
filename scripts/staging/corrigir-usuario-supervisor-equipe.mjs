/**
 * PATCH-ADMIN-SIMPLIFICAR-CADASTRO-PERFIS-1 — corrige UM usuário existente
 * cujo cadastro ficou com `equipeId` desalinhado de `equipesPermitidas`
 * (causa raiz real: a tela administrativa de cadastro nunca gravava
 * `equipeId` explicitamente ao salvar um Supervisor/Gestor de equipe — só
 * `equipesPermitidas`; `equipeId` ficava herdado da equipe de quem estava
 * cadastrando). Este script SEMPRE grava o mesmo formato de Supervisor de
 * equipe que a tela corrigida agora produz — nunca cria ADMIN_SISTEMA,
 * nunca usa escopo GLOBAL, nunca altera mais de um usuário por execução.
 *
 * DRY-RUN POR PADRÃO — sem `--execute`, só mostra o antes/depois. Só
 * executa de verdade com:
 *
 *   --execute --confirm=CORRIGIR_SUPERVISOR_EQUIPE
 *
 * Usa o Admin SDK, mesma guarda de `firebaseAdminStaging.mjs`: só roda
 * contra o projeto `escala-ici-staging`, nunca produção.
 *
 * USO
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/corrigir-usuario-supervisor-equipe.mjs --login=wmoriyama --equipe=GEDSI_CODB_NOC
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/corrigir-usuario-supervisor-equipe.mjs --login=wmoriyama --equipe=GEDSI_CODB_NOC \
 *     --execute --confirm=CORRIGIR_SUPERVISOR_EQUIPE
 */
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';

const CONFIRMACAO = 'CORRIGIR_SUPERVISOR_EQUIPE';
/** Mesmo nível já usado por `lib/perfilAcessoUsuario.ts` para SUPERVISOR_EQUIPE (Nível 5 — Supervisão). */
const NIVEL_HIERARQUICO_SUPERVISOR_EQUIPE = 5;

function valorDoArgumento(argv, prefixo) {
  const encontrado = argv.find((valor) => valor.startsWith(prefixo));
  return encontrado ? encontrado.slice(prefixo.length).trim() : '';
}

export function analisarArgumentos(argv) {
  return {
    execute: argv.includes('--execute'),
    confirmado: argv.includes(`--confirm=${CONFIRMACAO}`),
    login: valorDoArgumento(argv, '--login='),
    equipeId: valorDoArgumento(argv, '--equipe='),
  };
}

/**
 * Mesmo formato que `montarCamposAcessoUsuario({ tipo: 'SUPERVISOR_EQUIPE', ... })`
 * (`lib/perfilAcessoUsuario.ts`) produziria a partir da tela — este script
 * não importa aquele módulo TypeScript (nenhum script de `scripts/staging/`
 * importa de `lib/`), mas replica deliberadamente o mesmo resultado, para
 * nunca divergir do que a tela corrigida grava.
 */
export function montarCamposCorrecao(equipeId, unidadeId) {
  const campos = {
    perfil: 'SUPERVISOR_EQUIPE',
    escopo: 'EQUIPE',
    equipeId,
    equipesPermitidas: [equipeId],
    nivelHierarquico: NIVEL_HIERARQUICO_SUPERVISOR_EQUIPE,
    ativo: true,
  };
  return unidadeId === undefined ? campos : { ...campos, unidadeId };
}

function resumoUsuario(dados) {
  return {
    perfil: dados?.perfil,
    escopo: dados?.escopo,
    equipeId: dados?.equipeId,
    equipesPermitidas: dados?.equipesPermitidas,
    unidadeId: dados?.unidadeId,
    nivelHierarquico: dados?.nivelHierarquico,
    ativo: dados?.ativo,
  };
}

async function main() {
  const { execute, confirmado, login, equipeId } = analisarArgumentos(process.argv);
  if (login === '') {
    throw new Error('Informe --login=<login>.');
  }
  if (equipeId === '') {
    throw new Error('Informe --equipe=<equipeId>.');
  }
  if (execute && !confirmado) {
    throw new Error(`Para executar de verdade, use --execute --confirm=${CONFIRMACAO}.`);
  }
  const modo = execute ? 'EXECUTANDO (grava no Firestore)' : 'DRY-RUN (só mostra antes/depois)';

  const { db } = inicializarAdminStaging();
  console.log('[corrigir-usuario-supervisor-equipe] projeto: escala-ici-staging');
  console.log(`[corrigir-usuario-supervisor-equipe] modo: ${modo}`);
  console.log(`[corrigir-usuario-supervisor-equipe] login=${login} equipe=${equipeId}`);

  const referenciaUsuario = db.doc(`usuarios/${login}`);
  const snapshotUsuario = await referenciaUsuario.get();
  if (!snapshotUsuario.exists) {
    throw new Error(`Usuário "${login}" não encontrado em usuarios/${login}. Nada foi alterado.`);
  }
  const antes = snapshotUsuario.data();

  const snapshotEquipe = await db.doc(`equipes/${equipeId}`).get();
  if (!snapshotEquipe.exists) {
    throw new Error(`Equipe "${equipeId}" não encontrada em equipes/${equipeId}. Confira o id antes de corrigir o usuário. Nada foi alterado.`);
  }
  const equipe = snapshotEquipe.data();
  const unidadeId = typeof equipe?.unidadeId === 'string' && equipe.unidadeId.trim() !== ''
    ? equipe.unidadeId
    : undefined;

  const campos = montarCamposCorrecao(equipeId, unidadeId);

  console.log('[corrigir-usuario-supervisor-equipe] ANTES:');
  console.log(JSON.stringify(resumoUsuario(antes), null, 2));
  console.log('[corrigir-usuario-supervisor-equipe] DEPOIS:');
  console.log(JSON.stringify(resumoUsuario(campos), null, 2));

  if (!execute) {
    console.log(`[corrigir-usuario-supervisor-equipe] nada foi gravado (dry-run). Rode com --execute --confirm=${CONFIRMACAO} para aplicar.`);
    process.exit(0);
  }

  await referenciaUsuario.set({ ...campos, atualizadoEm: new Date().toISOString() }, { merge: true });
  console.log(`[corrigir-usuario-supervisor-equipe] concluído. "${login}" agora é SUPERVISOR_EQUIPE de "${equipeId}".`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((erro) => {
    console.error(`[corrigir-usuario-supervisor-equipe] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}
