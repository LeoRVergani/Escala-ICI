/**
 * Correção CODB/NOC (FASE-MATRIZ-DEFINITIVA-E-INFORMACOES-DIA-1) — limpa o
 * `equipeId` de UM usuário `GESTOR_UNIDADE` existente cujo cadastro ficou
 * com uma equipe descendente presa nesse campo (causa raiz real: nenhuma
 * tela grava isso hoje deliberadamente — `montarCamposAcessoUsuario()`
 * sempre produz `equipeId: undefined` para este perfil — mas contas
 * criadas por caminhos mais antigos ainda carregam o valor). Isso importa
 * porque, quando `equipesPermitidas` está vazio, `minhasEquipesPermitidas()`
 * (`firestore.rules`) cai para `[equipeId]` — se essa equipe também
 * estiver em `responsaveisEquipe` da Matriz de alguma operação, o
 * coordenador ganha administração dela por acidente, nunca por
 * responsabilidade explícita. Ver `lib/perfilAcessoUsuario.ts`
 * (`usuarioGestorUnidadeComEquipeIdInvalido()`, já aplicada por
 * `salvarUsuario()` para qualquer gravação nova).
 *
 * Este script SÓ limpa `equipeId` — nunca toca `perfil`/`escopo`/
 * `unidadeId`/`unidadesPermitidas`/`ativo`/qualquer outro campo. Recusa
 * corrigir um usuário cujo `perfil` atual não seja `GESTOR_UNIDADE`
 * (nada a corrigir; rode a auditoria de novo se a intenção for outra).
 *
 * DRY-RUN POR PADRÃO — sem `--execute`, só mostra o antes/depois. Só
 * executa de verdade com:
 *
 *   --execute --confirm=CORRIGIR_GESTOR_UNIDADE_EQUIPE_ID
 *
 * Usa o Admin SDK, mesma guarda de `firebaseAdminStaging.mjs`: só roda
 * contra o projeto `escala-ici-staging`, nunca produção.
 *
 * USO
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/corrigir-gestor-unidade-equipe-id.mjs --login=elrauh
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account-staging.json \
 *   node scripts/staging/corrigir-gestor-unidade-equipe-id.mjs --login=elrauh \
 *     --execute --confirm=CORRIGIR_GESTOR_UNIDADE_EQUIPE_ID
 */
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';

const CONFIRMACAO = 'CORRIGIR_GESTOR_UNIDADE_EQUIPE_ID';

function valorDoArgumento(argv, prefixo) {
  const encontrado = argv.find((valor) => valor.startsWith(prefixo));
  return encontrado ? encontrado.slice(prefixo.length).trim() : '';
}

export function analisarArgumentos(argv) {
  return {
    execute: argv.includes('--execute'),
    confirmado: argv.includes(`--confirm=${CONFIRMACAO}`),
    login: valorDoArgumento(argv, '--login='),
  };
}

function resumoUsuario(dados) {
  return {
    perfil: dados?.perfil,
    escopo: dados?.escopo,
    equipeId: dados?.equipeId,
    equipesPermitidas: dados?.equipesPermitidas,
    unidadeId: dados?.unidadeId,
    unidadesPermitidas: dados?.unidadesPermitidas,
    ativo: dados?.ativo,
  };
}

async function main() {
  const { execute, confirmado, login } = analisarArgumentos(process.argv);
  if (login === '') {
    throw new Error('Informe --login=<login>.');
  }
  if (execute && !confirmado) {
    throw new Error(`Para executar de verdade, use --execute --confirm=${CONFIRMACAO}.`);
  }
  const modo = execute ? 'EXECUTANDO (grava no Firestore)' : 'DRY-RUN (só mostra antes/depois)';

  const { db } = inicializarAdminStaging();
  console.log('[corrigir-gestor-unidade-equipe-id] projeto: escala-ici-staging');
  console.log(`[corrigir-gestor-unidade-equipe-id] modo: ${modo}`);
  console.log(`[corrigir-gestor-unidade-equipe-id] login=${login}`);

  const referenciaUsuario = db.doc(`usuarios/${login}`);
  const snapshotUsuario = await referenciaUsuario.get();
  if (!snapshotUsuario.exists) {
    throw new Error(`Usuário "${login}" não encontrado em usuarios/${login}. Nada foi alterado.`);
  }
  const antes = snapshotUsuario.data();

  if (antes?.perfil !== 'GESTOR_UNIDADE') {
    throw new Error(
      `Usuário "${login}" tem perfil "${antes?.perfil}", não GESTOR_UNIDADE. `
      + 'Este script só corrige equipeId de GESTOR_UNIDADE. Nada foi alterado.',
    );
  }

  const equipeIdAtual = typeof antes?.equipeId === 'string' ? antes.equipeId.trim() : '';
  if (equipeIdAtual === '') {
    console.log(`[corrigir-gestor-unidade-equipe-id] "${login}" já não tem equipeId. Nada a corrigir.`);
    process.exit(0);
  }

  const depois = { ...antes, equipeId: '' };

  console.log('[corrigir-gestor-unidade-equipe-id] ANTES:');
  console.log(JSON.stringify(resumoUsuario(antes), null, 2));
  console.log('[corrigir-gestor-unidade-equipe-id] DEPOIS:');
  console.log(JSON.stringify(resumoUsuario(depois), null, 2));

  if (!execute) {
    console.log(`[corrigir-gestor-unidade-equipe-id] nada foi gravado (dry-run). Rode com --execute --confirm=${CONFIRMACAO} para aplicar.`);
    process.exit(0);
  }

  await referenciaUsuario.set({ equipeId: '', atualizadoEm: new Date().toISOString() }, { merge: true });
  console.log(`[corrigir-gestor-unidade-equipe-id] concluído. "${login}" não tem mais equipeId vinculado a uma equipe descendente.`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((erro) => {
    console.error(`[corrigir-gestor-unidade-equipe-id] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}
