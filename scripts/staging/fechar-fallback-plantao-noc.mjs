/**
 * FASE-PLANTAO-CODB-CANONICO-1 — SENTINELA TEMPORÁRIA DE MIGRAÇÃO, NÃO A
 * ARQUITETURA FINAL (ver `docs/spec/PLANTAO_CODB.md`, seção "Sentinela
 * temporária PLANTAO_NOC"). Fecha o fallback hierárquico legado que
 * concede a Elton (Coordenador CODB) administração do shell abandonado
 * `gruposPlantao/NOC`, mesmo sem nenhuma responsabilidade explícita.
 *
 * CAUSA RAIZ (confirmada rodando `resolverEscoposOperacionais()` de
 * verdade contra dados reais de staging, com os flags REAIS de
 * `.env.staging.dashboard`, ambos `true`:
 * `VITE_ESCALA_FALLBACK_OPERACIONAL_LEGADO`/`VITE_ESCALA_STAGING_PERMISSAO_AMPLA`):
 * `gruposPlantao/NOC` nunca teve nenhum documento em
 * `escoposOperacionais` (nem ativo, nem inativo). Sem NENHUMA Matriz para
 * aquele alvo, o fallback legado (`permitirFallbackLegado` em
 * `lib/escoposOperacionais.ts`, espelhado em `firestore.rules` por
 * `!existeMatrizOperacional('PLANTAO', grupoId) && podeGerenciarGrupoPlantao(...)`)
 * continua ativo — e `podeGerenciarGrupoPlantao()` casa por
 * `unidadeResponsavelId` (`GEDSI_CODB`), que é exatamente a unidade de
 * Elton. Resultado real observado:
 * `gruposPlantaoAdministraveis: ['PLANTAO_CODB', 'NOC']` — o card "NOC"
 * não deveria aparecer.
 *
 * CORREÇÃO (tombstone, não solução definitiva): `alvoTemQualquerMatriz()`
 * (`lib/escoposOperacionaisMatriz.ts`) e o equivalente em
 * `firestore.rules` (`existeMatrizOperacional()`) só checam EXISTÊNCIA do
 * documento — nunca `ativo`, nunca se há responsável. Criar
 * `escoposOperacionais/PLANTAO_NOC` com `ativo: false` E
 * `responsaveisLogin`/`responsaveisEquipe` AMBOS vazios desliga o
 * fallback legado para este alvo especificamente:
 *
 *   gruposPlantao/NOC existe + Matriz PLANTAO_NOC inativa existe
 *   => fallback hierárquico legado NUNCA mais concede este alvo a ninguém.
 *
 * NUNCA concede responsabilidade a Elton nem a ninguém (`responsaveisLogin`/
 * `responsaveisEquipe` vazios — só existe por sua PRESENÇA, nunca por seu
 * conteúdo). NUNCA toca `gruposPlantao/NOC` em si (continua
 * `DEACTIVATE_LATER`, ativo, sem histórico, até a fase própria de
 * desativação), `equipes/GEDSI_CODB_NOC`, a Jornada do NOC, ou a
 * Supervisora. Mudança cirúrgica restrita a este único alvo — NÃO é a
 * FASE D (gate geral do fallback hierárquico system-wide), que continua
 * pendente e é o que eventualmente tornaria esta sentinela desnecessária.
 *
 * Nota de schema: `escopoOperacionalValido()` (`firestore.rules`) exige
 * `responsaveisLogin`/`responsaveisEquipe` não ambos vazios para escrita
 * VIA CLIENTE (`salvarEscopoOperacional()`) — este documento nunca deve
 * ser reeditado por essa tela; ele só existe via este script (Admin SDK,
 * que não passa por Rules). Se algum dia precisar ser tocado pela UI
 * administrativa, a exigência de schema precisará ser revisitada.
 *
 * DRY-RUN POR PADRÃO — sem `--apply`, só mostra o plano. Só aplica com:
 *
 *   --apply --confirm=FECHAR_FALLBACK_PLANTAO_NOC
 *
 * Idempotente: se o documento já existir (com `ativo: false` e
 * responsáveis vazios), reporta KEEP e não regrava nada.
 *
 * Usa o Admin SDK, mesma guarda de `firebaseAdminStaging.mjs`: só roda
 * contra `escala-ici-staging`, nunca produção.
 */
import process from 'node:process';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';

const CONFIRMACAO = 'FECHAR_FALLBACK_PLANTAO_NOC';
const GRUPO_ID = 'NOC';
const ESCOPO_ID = `PLANTAO_${GRUPO_ID}`;

export function analisarArgumentos(argv) {
  return {
    apply: argv.includes('--apply'),
    confirmado: argv.includes(`--confirm=${CONFIRMACAO}`),
  };
}

async function main() {
  const { apply, confirmado } = analisarArgumentos(process.argv);
  if (apply && !confirmado) {
    throw new Error(`Para aplicar de verdade, use --apply --confirm=${CONFIRMACAO}.`);
  }
  const modo = apply ? 'APLICANDO (grava no Firestore)' : 'DRY-RUN (só mostra o plano)';

  const { db } = inicializarAdminStaging();
  console.log('[fechar-fallback-plantao-noc] projeto: escala-ici-staging');
  console.log(`[fechar-fallback-plantao-noc] modo: ${modo}`);

  const [grupoSnap, escopoSnap, participantes, competencias, rascunhos] = await Promise.all([
    db.doc(`gruposPlantao/${GRUPO_ID}`).get(),
    db.doc(`escoposOperacionais/${ESCOPO_ID}`).get(),
    db.collection(`gruposPlantao/${GRUPO_ID}/participantes`).limit(1).get(),
    db.collection('competenciasPlantao').where('grupoId', '==', GRUPO_ID).limit(1).get(),
    db.collection('rascunhosCompetenciasPlantao').where('grupoId', '==', GRUPO_ID).limit(1).get(),
  ]);

  if (!grupoSnap.exists) {
    throw new Error(`gruposPlantao/${GRUPO_ID} não existe. Nada foi verificado/gravado.`);
  }
  const grupo = grupoSnap.data();
  const aindaVazio = participantes.empty && competencias.empty && rascunhos.empty;
  console.log(`[fechar-fallback-plantao-noc] gruposPlantao/${GRUPO_ID} continua vazio (0 participantes/competências/rascunhos)? ${aindaVazio}`);
  if (!aindaVazio) {
    throw new Error(
      `gruposPlantao/${GRUPO_ID} deixou de estar vazio — reauditar antes de continuar. Nada foi gravado.`,
    );
  }

  const jaExiste = escopoSnap.exists;
  const escopoAtual = jaExiste ? escopoSnap.data() : null;
  const jaCorreto = jaExiste
    && escopoAtual.ativo === false
    && Array.isArray(escopoAtual.responsaveisLogin) && escopoAtual.responsaveisLogin.length === 0
    && Array.isArray(escopoAtual.responsaveisEquipe) && escopoAtual.responsaveisEquipe.length === 0;
  const acao = !jaExiste ? 'CREATE' : jaCorreto ? 'KEEP' : 'REVISAR_MANUALMENTE';

  console.log('\n=== PLANO ===');
  console.log(`${acao}:`);
  console.log(`  escoposOperacionais/${ESCOPO_ID}`);
  console.log('\nativo:');
  console.log('  false');
  console.log('\nresponsaveisLogin:');
  console.log('  []');
  console.log('\nresponsaveisEquipe:');
  console.log('  []');
  console.log('\nEFFECT:');
  console.log('  disable legacy fallback only — grants no responsibility to anyone');
  console.log('\nNO CHANGE:');
  console.log('  equipes/GEDSI_CODB_NOC');
  console.log('  escoposOperacionais/JORNADA_GEDSI_CODB_NOC (NOC Jornada)');
  console.log('  usuarios/wmoriyama (Supervisora NOC)');
  console.log('  usuarios/elrauh responsibilities (Elton keeps only PLANTAO_PLANTAO_CODB)');
  console.log('  gruposPlantao/NOC (continua ativo=true, DEACTIVATE_LATER — fase própria)');

  if (acao === 'REVISAR_MANUALMENTE') {
    throw new Error(
      `escoposOperacionais/${ESCOPO_ID} já existe com formato inesperado `
      + `(ativo=${escopoAtual.ativo}, responsaveisLogin=${JSON.stringify(escopoAtual.responsaveisLogin)}, `
      + `responsaveisEquipe=${JSON.stringify(escopoAtual.responsaveisEquipe)}) — revise manualmente. Nada foi gravado.`,
    );
  }

  if (!apply) {
    console.log(`\n[fechar-fallback-plantao-noc] nada foi gravado (dry-run). Rode com --apply --confirm=${CONFIRMACAO} para aplicar.`);
    process.exit(0);
  }

  if (acao === 'KEEP') {
    console.log('\n[fechar-fallback-plantao-noc] já está correto — nada para gravar.');
    process.exit(0);
  }

  const agora = new Date().toISOString();
  await db.doc(`escoposOperacionais/${ESCOPO_ID}`).set({
    tipo: 'PLANTAO',
    alvoId: GRUPO_ID,
    alvoNome: 'NOC (sentinela temporária — shell vazio, nunca usado, DEACTIVATE_LATER; ver docs/spec/PLANTAO_CODB.md)',
    unidadeId: grupo.unidadeResponsavelId ?? null,
    caminhoUnidade: grupo.caminhoUnidadeResponsavel ?? [],
    responsaveisLogin: [],
    responsaveisEquipe: [],
    equipesConsulta: [],
    ativo: false,
    criadoEm: agora,
    atualizadoEm: agora,
    criadoPorLogin: 'fechar-fallback-plantao-noc',
    atualizadoPorLogin: 'fechar-fallback-plantao-noc',
    schemaVersion: 1,
  });
  console.log(`\n[fechar-fallback-plantao-noc] concluído. escoposOperacionais/${ESCOPO_ID} criado com ativo:false.`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((erro) => {
    console.error(`[fechar-fallback-plantao-noc] falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exitCode = 1;
  });
}
