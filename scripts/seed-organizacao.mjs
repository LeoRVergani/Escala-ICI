/**
 * Semeia a hierarquia inicial de `unidadesOrganizacionais` (e algumas
 * `equipes` de exemplo já vinculadas a ela) em staging — modelo
 * organizacional flexível descrito em `lib/modelos.ts`
 * (`UnidadeOrganizacional`) e `firestore.rules`
 * (`match /unidadesOrganizacionais/{unidadeId}`).
 *
 * NÃO EXECUTAR SEM APROVAÇÃO — este script escreve em staging. Roda em modo
 * --dry-run por padrão (só lista o que faria); precisa de --execute
 * explícito para gravar. Requer autenticação como ADMIN_SISTEMA (as rules
 * só permitem criar unidade raiz — `parentId: null` — para admin; um
 * GESTOR_UNIDADE só cria filhas dentro do seu próprio escopo).
 *
 * Mesmo script serve para staging e para uma futura versão estável/prod —
 * só o projeto Firebase apontado pelas variáveis de ambiente muda (ver
 * `.env.staging.dashboard`/equivalente de produção quando existir).
 *
 * O QUE SEMEIA
 *   Unidades (hierarquia real da Diretoria de Infraestrutura e Segurança):
 *     DIRETOR_PRESIDENTE (raiz)
 *       -> DIR_INFRA_SEGURANCA
 *            -> GEDSI
 *                 -> COSI
 *                 -> CODB
 *                      -> SUPERVISOR_TI
 *            -> GESUP
 *                 -> COSD
 *                 -> COAT
 *   Equipes (vínculo direto da escala, `turnosMes.equipeId` — nunca
 *   alterado por este script):
 *     EQ_SOC          (sob COSI)
 *     EQ_PLANTAO_COSI (sob COSI)
 *     EQ_NOC          (sob SUPERVISOR_TI)
 *
 *   Fase PROVISIONAMENTO-GRUPO-PLANTAO-1 — também garante, de forma
 *   idempotente, o Grupo de Plantão operacional que a equipe "Plantão
 *   COSI" sozinha NUNCA supre (`docs/spec/ESCOPO_OPERACIONAL_GESTOR_UNIDADE.md`
 *   § "Provisionamento de Grupo de Plantão"):
 *     gruposPlantao/PLANTAO_COSI — equipeResponsavelId=EQ_PLANTAO_COSI,
 *     unidadeResponsavelId=COSI, caminhoUnidadeResponsavel=caminho de COSI,
 *     equipesConsulta ⊇ {EQ_PLANTAO_COSI, EQ_SOC}.
 *
 *   Opcionalmente (só se `ESCALA_SEED_ORG_LOGIN_COORDENADOR_COSI` estiver
 *   definida), também alinha o perfil de um usuário REAL já cadastrado
 *   (nunca cria um usuário novo) para coordenador/gestor de unidade COSI:
 *   `perfil: GESTOR_UNIDADE`, `escopo: UNIDADE`, `unidadeId: COSI`,
 *   `unidadesPermitidas: ['COSI']`. Gate de confirmação PRÓPRIO e mais
 *   restrito que o do resto do script (seção "USO" abaixo) — alterar
 *   permissão de uma pessoa real pede uma confirmação extra, deliberada.
 *
 * `caminho`/`caminhoUnidade` são resolvidos aqui, em memória, a partir de
 * `parentId` — nunca em firestore.rules (que não percorre `parentId`, só
 * lê arrays explícitos de permissão).
 *
 * Convenção para equipes homônimas em áreas diferentes (documentada, NÃO
 * semeada por este script): prefixar o ID com a coordenação, ex.
 * `EQ_COSD_TECNICO_N2` (sob COSD) vs `EQ_COAT_TECNICO_N2` (sob COAT) — o
 * mesmo cargo "Técnico N2" existe nas duas coordenações, mas como equipes
 * distintas.
 *
 * IDEMPOTÊNCIA E CAMPOS EDITADOS À MÃO
 *   Unidades/equipes: `setDoc(..., { merge: true })` — reescreve o mesmo
 *   valor sempre (não há campo "presentacional" nelas que um humano
 *   costume editar fora deste script).
 *   Grupo de Plantão: se o documento já existe, o script NUNCA sobrescreve
 *   `nome`/`descricao`/`timezone`/`ativo`/`padraoHorarioSemanal` (podem ter
 *   sido editados pelo coordenador na Administração) — só GARANTE os
 *   campos estruturais/de autorização (`unidadeResponsavelId`,
 *   `caminhoUnidadeResponsavel`, união de `equipesConsulta`, nunca remove
 *   uma equipe já autorizada). `equipeResponsavelId`/`criadoPorLogin`/
 *   `criadoEm` são imutáveis nas Rules — o script detecta e avisa em vez
 *   de tentar escrever um valor que seria negado.
 *
 * USO
 *   ESCALA_SEED_ORG_EMAIL_ADMIN=admin@empresa.com \
 *   ESCALA_SEED_ORG_SENHA_ADMIN='...' \
 *   node scripts/seed-organizacao.mjs --dry-run
 *
 *   # Depois de revisar o plano impresso, para gravar de fato:
 *   ESCALA_SEED_ORG_EMAIL_ADMIN=admin@empresa.com \
 *   ESCALA_SEED_ORG_SENHA_ADMIN='...' \
 *   node scripts/seed-organizacao.mjs --execute --confirm=SEED_ORGANIZACAO_STAGING
 *
 *   # Para também alinhar o perfil do coordenador COSI (usuário JÁ
 *   # cadastrado — o script nunca cria um usuário novo aqui):
 *   ESCALA_SEED_ORG_EMAIL_ADMIN=admin@empresa.com \
 *   ESCALA_SEED_ORG_SENHA_ADMIN='...' \
 *   ESCALA_SEED_ORG_LOGIN_COORDENADOR_COSI=marina.azevedo \
 *   node scripts/seed-organizacao.mjs --execute --confirm=SEED_ORGANIZACAO_STAGING \
 *     --confirm-coordenador=SEED_ORGANIZACAO_STAGING_COORDENADOR
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseEnv } from 'node:util';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

const arquivoEnv = resolve('.env.staging.dashboard');
if (!existsSync(arquivoEnv)) {
  throw new Error('Crie .env.staging.dashboard a partir do arquivo .example antes de semear.');
}
Object.assign(process.env, parseEnv(readFileSync(arquivoEnv, 'utf8')));

const execute = process.argv.includes('--execute');
const confirmado = process.argv.includes('--confirm=SEED_ORGANIZACAO_STAGING');
/**
 * Gate próprio para o passo opcional de coordenador (seção "Coordenador
 * COSI" abaixo) — alterar perfil/escopo de uma pessoa real é mais sensível
 * que semear unidades/equipes/grupo, então pede uma segunda confirmação
 * explícita além de `--execute --confirm=...`.
 */
const confirmadoCoordenador = process.argv.includes('--confirm-coordenador=SEED_ORGANIZACAO_STAGING_COORDENADOR');
if (execute && !confirmado) {
  throw new Error('Para gravar de fato, use --execute --confirm=SEED_ORGANIZACAO_STAGING.');
}
const modo = execute ? 'EXECUTANDO (grava no Firestore)' : 'DRY-RUN (só lista o plano)';

const email = process.env.ESCALA_SEED_ORG_EMAIL_ADMIN;
const senha = process.env.ESCALA_SEED_ORG_SENHA_ADMIN;
if (!email || !senha) {
  throw new Error('Defina ESCALA_SEED_ORG_EMAIL_ADMIN e ESCALA_SEED_ORG_SENHA_ADMIN.');
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`[seed-organizacao] modo: ${modo}`);
console.log(`[seed-organizacao] projeto: ${process.env.VITE_FIREBASE_PROJECT_ID}`);

await signInWithEmailAndPassword(auth, email, senha);
const currentUser = auth.currentUser;
if (currentUser === null) {
  throw new Error('[seed-organizacao] auth.currentUser indisponível depois do login.');
}
console.log(`[seed-organizacao] autenticado como ${currentUser.email ?? email}`);

/** Mesma derivação de `loginDoAuth()` em firestore.rules. */
function loginDoEmail(emailAutenticado) {
  return emailAutenticado.split('@')[0]?.toLowerCase().trim() ?? '';
}

const login = loginDoEmail(currentUser.email ?? email);

async function confirmarAdminSistema() {
  const snapshot = await getDoc(doc(db, 'usuarios', login));
  if (!snapshot.exists()) {
    throw new Error(`[seed-organizacao] usuarios/${login} não existe — cadastre o ADMIN_SISTEMA antes de semear.`);
  }
  if (snapshot.data().perfil !== 'ADMIN_SISTEMA') {
    throw new Error(`[seed-organizacao] usuarios/${login} não tem perfil ADMIN_SISTEMA — as rules negariam a criação de unidades raiz.`);
  }
}

/**
 * Ordem parent-first — cada unidade referencia o `unidadeId` de uma
 * anterior na lista (ou `null` para raiz). `caminho` é resolvido abaixo, em
 * memória, antes de qualquer escrita.
 */
const UNIDADES_SEM_CAMINHO = [
  { unidadeId: 'DIRETOR_PRESIDENTE', nome: 'Diretor Presidente', sigla: 'PRESIDENCIA', tipo: 'PRESIDENCIA', parentId: null },
  { unidadeId: 'DIR_INFRA_SEGURANCA', nome: 'Diretoria de Infraestrutura e Segurança da Informação', sigla: 'DIR_INFRA_SEG', tipo: 'DIRETORIA', parentId: 'DIRETOR_PRESIDENTE' },
  { unidadeId: 'GEDSI', nome: 'Gerência de Data Center e Segurança da Informação', sigla: 'GEDSI', tipo: 'GERENCIA', parentId: 'DIR_INFRA_SEGURANCA' },
  { unidadeId: 'COSI', nome: 'COSI', sigla: 'COSI', tipo: 'COORDENACAO', parentId: 'GEDSI' },
  { unidadeId: 'CODB', nome: 'CODB', sigla: 'CODB', tipo: 'COORDENACAO', parentId: 'GEDSI' },
  { unidadeId: 'SUPERVISOR_TI', nome: 'Supervisor de TI', sigla: 'SUP_TI', tipo: 'SUPERVISAO', parentId: 'CODB' },
  { unidadeId: 'GESUP', nome: 'Gerência de Suporte Técnico', sigla: 'GESUP', tipo: 'GERENCIA', parentId: 'DIR_INFRA_SEGURANCA' },
  { unidadeId: 'COSD', nome: 'COSD', sigla: 'COSD', tipo: 'COORDENACAO', parentId: 'GESUP' },
  { unidadeId: 'COAT', nome: 'COAT', sigla: 'COAT', tipo: 'COORDENACAO', parentId: 'GESUP' },
];

const EQUIPES_SEM_CAMINHO = [
  { id: 'EQ_SOC', nome: 'SOC', sigla: 'SOC', unidadeId: 'COSI' },
  { id: 'EQ_PLANTAO_COSI', nome: 'Plantão COSI', sigla: 'PLANTAO_COSI', unidadeId: 'COSI' },
  { id: 'EQ_NOC', nome: 'NOC', sigla: 'NOC', unidadeId: 'SUPERVISOR_TI' },
];

function resolverCaminhos(unidadesSemCaminho) {
  const porId = new Map(unidadesSemCaminho.map((unidade) => [unidade.unidadeId, unidade]));
  const caminhoPorId = new Map();

  function caminhoDe(unidadeId) {
    if (caminhoPorId.has(unidadeId)) {
      return caminhoPorId.get(unidadeId);
    }
    const unidade = porId.get(unidadeId);
    if (unidade === undefined) {
      throw new Error(`[seed-organizacao] parentId "${unidadeId}" não existe em UNIDADES_SEM_CAMINHO.`);
    }
    const caminho = unidade.parentId === null
      ? [unidade.unidadeId]
      : [...caminhoDe(unidade.parentId), unidade.unidadeId];
    caminhoPorId.set(unidadeId, caminho);
    return caminho;
  }

  return unidadesSemCaminho.map((unidade) => ({ ...unidade, caminho: caminhoDe(unidade.unidadeId) }));
}

const agora = new Date().toISOString();
const unidades = resolverCaminhos(UNIDADES_SEM_CAMINHO).map((unidade) => ({
  ...unidade,
  ativa: true,
  criadoPorLogin: login,
  criadoEm: agora,
  atualizadoEm: agora,
}));
const caminhoPorUnidadeId = new Map(unidades.map((unidade) => [unidade.unidadeId, unidade.caminho]));
const equipes = EQUIPES_SEM_CAMINHO.map((equipe) => ({
  ...equipe,
  ativa: true,
  caminhoUnidade: caminhoPorUnidadeId.get(equipe.unidadeId),
}));

console.log('[seed-organizacao] plano de unidadesOrganizacionais:');
for (const unidade of unidades) {
  console.log(`  ${unidade.unidadeId} (${unidade.tipo}) — ${unidade.caminho.join(' > ')}`);
}
console.log('[seed-organizacao] plano de equipes:');
for (const equipe of equipes) {
  console.log(`  ${equipe.id} — unidadeId=${equipe.unidadeId} — caminhoUnidade=${equipe.caminhoUnidade.join(' > ')}`);
}

/**
 * Fase PROVISIONAMENTO-GRUPO-PLANTAO-1 — plano do Grupo de Plantão
 * operacional da equipe "Plantão COSI". `unidadeResponsavelId`/
 * `caminhoUnidadeResponsavel` vêm SEMPRE da equipe responsável já resolvida
 * acima (`caminhoPorUnidadeId`), nunca digitados — mesma fonte usada por
 * `criarGrupoWizard()`/`ModalGrupoPlantao` no Dashboard.
 */
const equipePlantaoCosi = equipes.find((equipe) => equipe.id === 'EQ_PLANTAO_COSI');
if (equipePlantaoCosi === undefined) {
  throw new Error('[seed-organizacao] EQ_PLANTAO_COSI não está em EQUIPES_SEM_CAMINHO — não é possível planejar o Grupo de Plantão.');
}
const GRUPO_PLANTAO_COSI_ID = 'PLANTAO_COSI';
const grupoPlantaoDesejado = {
  grupoId: GRUPO_PLANTAO_COSI_ID,
  nome: 'Plantão COSI',
  equipeResponsavelId: equipePlantaoCosi.id,
  equipesConsulta: [equipePlantaoCosi.id, 'EQ_SOC'],
  unidadeResponsavelId: equipePlantaoCosi.unidadeId,
  caminhoUnidadeResponsavel: equipePlantaoCosi.caminhoUnidade,
  timezone: 'America/Sao_Paulo',
  ativo: true,
  schemaVersion: 1,
  criadoPorLogin: login,
  criadoEm: agora,
  atualizadoEm: agora,
};

const grupoPlantaoExistenteSnapshot = await getDoc(doc(db, 'gruposPlantao', GRUPO_PLANTAO_COSI_ID));
const grupoPlantaoExistente = grupoPlantaoExistenteSnapshot.exists() ? grupoPlantaoExistenteSnapshot.data() : null;

if (grupoPlantaoExistente === null) {
  console.log(`[seed-organizacao] plano de gruposPlantao: ${GRUPO_PLANTAO_COSI_ID} NÃO existe — será criado com:`);
  console.log(`  equipeResponsavelId=${grupoPlantaoDesejado.equipeResponsavelId} unidadeResponsavelId=${grupoPlantaoDesejado.unidadeResponsavelId} caminhoUnidadeResponsavel=${grupoPlantaoDesejado.caminhoUnidadeResponsavel.join(' > ')} equipesConsulta=${grupoPlantaoDesejado.equipesConsulta.join(', ')}`);
} else if (grupoPlantaoExistente.equipeResponsavelId !== grupoPlantaoDesejado.equipeResponsavelId) {
  console.log(`[seed-organizacao] AVISO: gruposPlantao/${GRUPO_PLANTAO_COSI_ID} já existe com equipeResponsavelId="${grupoPlantaoExistente.equipeResponsavelId}" (esperado "${grupoPlantaoDesejado.equipeResponsavelId}") — campo imutável nas Rules; este script NÃO tentará corrigi-lo. Resolva manualmente antes de prosseguir.`);
} else {
  const equipesConsultaUniao = [...new Set([...(grupoPlantaoExistente.equipesConsulta ?? []), ...grupoPlantaoDesejado.equipesConsulta])];
  console.log(`[seed-organizacao] plano de gruposPlantao: ${GRUPO_PLANTAO_COSI_ID} já existe — só garante unidadeResponsavelId/caminhoUnidadeResponsavel/equipesConsulta (nome/descricao/timezone/ativo/padraoHorarioSemanal ficam como estão, presumidos editados pelo coordenador):`);
  console.log(`  unidadeResponsavelId=${grupoPlantaoDesejado.unidadeResponsavelId} caminhoUnidadeResponsavel=${grupoPlantaoDesejado.caminhoUnidadeResponsavel.join(' > ')} equipesConsulta(união)=${equipesConsultaUniao.join(', ')}`);
}

/**
 * Fase PROVISIONAMENTO-GRUPO-PLANTAO-1 — coordenador COSI (opcional, só se
 * a env var estiver definida). Nunca cria usuário novo; só lê o cadastro
 * já existente e alinha os 4 campos de escopo — nunca mexe em
 * `equipeId`/`nome`/`cargo`/qualquer outro campo, e nunca rebaixa um
 * ADMIN_SISTEMA existente.
 */
const loginCoordenadorCosi = process.env.ESCALA_SEED_ORG_LOGIN_COORDENADOR_COSI?.trim();
let coordenadorPlano = null;
if (loginCoordenadorCosi) {
  const snapshot = await getDoc(doc(db, 'usuarios', loginCoordenadorCosi));
  if (!snapshot.exists()) {
    console.log(`[seed-organizacao] AVISO: usuarios/${loginCoordenadorCosi} (ESCALA_SEED_ORG_LOGIN_COORDENADOR_COSI) não existe — nenhum perfil de coordenador será alterado.`);
  } else {
    const atual = snapshot.data();
    if (atual.perfil === 'ADMIN_SISTEMA') {
      console.log(`[seed-organizacao] usuarios/${loginCoordenadorCosi} já é ADMIN_SISTEMA — nada a fazer (nunca rebaixado por este script).`);
    } else {
      const desejado = {
        perfil: 'GESTOR_UNIDADE',
        escopo: 'UNIDADE',
        unidadeId: 'COSI',
        unidadesPermitidas: ['COSI'],
      };
      const jaCorreto = atual.perfil === desejado.perfil
        && atual.escopo === desejado.escopo
        && atual.unidadeId === desejado.unidadeId
        && JSON.stringify(atual.unidadesPermitidas ?? []) === JSON.stringify(desejado.unidadesPermitidas);
      if (jaCorreto) {
        console.log(`[seed-organizacao] usuarios/${loginCoordenadorCosi} já está com o perfil de coordenador COSI — nada a fazer.`);
      } else {
        console.log(`[seed-organizacao] plano de coordenador COSI para usuarios/${loginCoordenadorCosi}:`);
        console.log(`  atual:    perfil=${atual.perfil ?? '(ausente)'} escopo=${atual.escopo ?? '(ausente)'} unidadeId=${atual.unidadeId ?? '(ausente)'} unidadesPermitidas=${JSON.stringify(atual.unidadesPermitidas ?? [])}`);
        console.log(`  desejado: perfil=${desejado.perfil} escopo=${desejado.escopo} unidadeId=${desejado.unidadeId} unidadesPermitidas=${JSON.stringify(desejado.unidadesPermitidas)}`);
        if (!confirmadoCoordenador) {
          console.log('  (não será gravado sem --confirm-coordenador=SEED_ORGANIZACAO_STAGING_COORDENADOR, mesmo com --execute)');
        }
        coordenadorPlano = { login: loginCoordenadorCosi, desejado };
      }
    }
  }
}

if (execute) {
  await confirmarAdminSistema();
  for (const unidade of unidades) {
    await setDoc(doc(db, 'unidadesOrganizacionais', unidade.unidadeId), unidade, { merge: true });
  }
  for (const equipe of equipes) {
    await setDoc(doc(db, 'equipes', equipe.id), equipe, { merge: true });
  }
  console.log(`[seed-organizacao] gravado: ${unidades.length} unidade(s), ${equipes.length} equipe(s).`);

  if (grupoPlantaoExistente === null) {
    await setDoc(doc(db, 'gruposPlantao', GRUPO_PLANTAO_COSI_ID), grupoPlantaoDesejado);
    console.log(`[seed-organizacao] gravado: gruposPlantao/${GRUPO_PLANTAO_COSI_ID} (criado).`);
  } else if (grupoPlantaoExistente.equipeResponsavelId === grupoPlantaoDesejado.equipeResponsavelId) {
    const equipesConsultaUniao = [...new Set([...(grupoPlantaoExistente.equipesConsulta ?? []), ...grupoPlantaoDesejado.equipesConsulta])];
    await setDoc(doc(db, 'gruposPlantao', GRUPO_PLANTAO_COSI_ID), {
      unidadeResponsavelId: grupoPlantaoDesejado.unidadeResponsavelId,
      caminhoUnidadeResponsavel: grupoPlantaoDesejado.caminhoUnidadeResponsavel,
      equipesConsulta: equipesConsultaUniao,
      atualizadoEm: agora,
    }, { merge: true });
    console.log(`[seed-organizacao] gravado: gruposPlantao/${GRUPO_PLANTAO_COSI_ID} (campos estruturais garantidos, presentacionais preservados).`);
  } else {
    console.log(`[seed-organizacao] gruposPlantao/${GRUPO_PLANTAO_COSI_ID} NÃO foi tocado (conflito de equipeResponsavelId, ver aviso acima).`);
  }

  if (coordenadorPlano !== null && confirmadoCoordenador) {
    await setDoc(doc(db, 'usuarios', coordenadorPlano.login), coordenadorPlano.desejado, { merge: true });
    console.log(`[seed-organizacao] gravado: usuarios/${coordenadorPlano.login} (perfil de coordenador COSI aplicado).`);
  } else if (coordenadorPlano !== null) {
    console.log(`[seed-organizacao] usuarios/${coordenadorPlano.login} NÃO foi tocado (falta --confirm-coordenador=SEED_ORGANIZACAO_STAGING_COORDENADOR).`);
  }
} else {
  console.log('[seed-organizacao] confirmação: nada foi gravado no Firestore (dry-run). Revise o plano acima antes de rodar com --execute --confirm=SEED_ORGANIZACAO_STAGING.');
}

// O SDK cliente mantém streams gRPC abertos; sem isso o processo não termina sozinho.
process.exit(0);
