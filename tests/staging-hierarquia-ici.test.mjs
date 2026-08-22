import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EQUIPES,
  GRUPO_PLANTAO,
  IDS_EQUIPES,
  IDS_MATRIZ,
  IDS_UNIDADES,
  MAPEAMENTO_LEGADO,
  MATRIZ_INICIAL,
  UNIDADES,
  USUARIOS_SEED,
  idEscopoOperacional,
} from '../scripts/staging/hierarquia-ici.mjs';

const IDS_LEGADOS = Object.keys(MAPEAMENTO_LEGADO);
const GRUPO_LEGADO = 'PLANTAO_COSI';
/** STAGING-RESET-HIERARQUIA-ICI-2 — IDs simples de coordenação nunca podem voltar. */
const IDS_UNIDADE_SIMPLES_PROIBIDOS = ['COSI', 'CODB', 'COCR'];

function serializarTudoMenosMapeamento() {
  return JSON.stringify({ UNIDADES, EQUIPES, GRUPO_PLANTAO, MATRIZ_INICIAL, USUARIOS_SEED });
}

test('MAPEAMENTO_LEGADO mapeia exatamente os 3 IDs legados conhecidos', () => {
  assert.deepEqual(MAPEAMENTO_LEGADO, {
    EQ_SOC: 'GEDSI_COSI_SOC',
    EQ_PLANTAO_COSI: 'GEDSI_COSI_PLANTAO',
    EQ_NOC: 'GEDSI_CODB_NOC',
  });
});

test('IDs legados (equipe e grupo) nunca aparecem fora de MAPEAMENTO_LEGADO — só mapeamento/migração, nunca dado novo', () => {
  const serializado = serializarTudoMenosMapeamento();
  for (const idLegado of [...IDS_LEGADOS, GRUPO_LEGADO]) {
    assert.doesNotMatch(serializado, new RegExp(`"${idLegado}"`, 'u'), `${idLegado} não pode aparecer em dado novo`);
  }
});

test('STAGING-RESET-HIERARQUIA-ICI-2 — nenhum unidadeId simples (COSI/CODB/COCR) é usado; só GEDSI_COSI/GEDSI_CODB/GEDSI_COCR', () => {
  const ids = new Set(IDS_UNIDADES);
  for (const idProibido of IDS_UNIDADE_SIMPLES_PROIBIDOS) {
    assert.equal(ids.has(idProibido), false, `"${idProibido}" não pode ser um unidadeId — use o prefixo canônico`);
  }
  for (const idEsperado of ['GEDSI_COSI', 'GEDSI_CODB', 'GEDSI_COCR']) {
    assert.ok(ids.has(idEsperado), `"${idEsperado}" precisa existir em UNIDADES`);
  }
});

test('UNIDADES: organograma canônico completo, sem IDs duplicados, com caminho e nivelHierarquico corretos', () => {
  assert.equal(UNIDADES.length, 17);
  const ids = UNIDADES.map((unidade) => unidade.unidadeId);
  assert.equal(new Set(ids).size, ids.length, 'nenhum unidadeId duplicado');

  const porId = new Map(UNIDADES.map((unidade) => [unidade.unidadeId, unidade]));
  const pre = porId.get('PRE');
  assert.equal(pre.parentId, null);
  assert.equal(pre.tipo, 'PRESIDENCIA');
  assert.equal(pre.nivelHierarquico, 'DELIBERATIVO');
  assert.deepEqual(pre.caminho, ['PRE']);

  const dio = porId.get('DIO');
  assert.equal(dio.parentId, 'PRE');
  assert.equal(dio.nivelHierarquico, 'ESTRATEGICO');
  assert.deepEqual(dio.caminho, ['PRE', 'DIO']);

  const gedsi = porId.get('GEDSI');
  assert.equal(gedsi.parentId, 'DIO');
  assert.equal(gedsi.tipo, 'GERENCIA');
  assert.equal(gedsi.nivelHierarquico, 'TATICO');
  assert.deepEqual(gedsi.caminho, ['PRE', 'DIO', 'GEDSI']);

  const cosi = porId.get('GEDSI_COSI');
  assert.equal(cosi.parentId, 'GEDSI');
  assert.equal(cosi.sigla, 'COSI');
  assert.equal(cosi.tipo, 'COORDENACAO');
  assert.equal(cosi.nivelHierarquico, 'TATICO');
  assert.deepEqual(cosi.caminho, ['PRE', 'DIO', 'GEDSI', 'GEDSI_COSI']);

  const codb = porId.get('GEDSI_CODB');
  assert.deepEqual(codb.caminho, ['PRE', 'DIO', 'GEDSI', 'GEDSI_CODB']);

  const gesup = porId.get('GESUP');
  assert.equal(gesup.parentId, 'DIO');
  const coat = porId.get('GESUP_COAT');
  assert.equal(coat.parentId, 'GESUP');
  assert.deepEqual(coat.caminho, ['PRE', 'DIO', 'GESUP', 'GESUP_COAT']);

  const geope = porId.get('GEOPE');
  assert.equal(geope.parentId, 'DIO');
  const copc = porId.get('GEOPE_COPC');
  assert.equal(copc.parentId, 'GEOPE');

  assert.deepEqual(IDS_UNIDADES.slice().sort(), ids.slice().sort());
});

test('UNIDADES: todos os nomes têm sigla e nome preenchidos, nenhum vazio', () => {
  for (const unidade of UNIDADES) {
    assert.ok(unidade.sigla.length > 0, `${unidade.unidadeId} precisa de sigla`);
    assert.ok(unidade.nome.length > 0, `${unidade.unidadeId} precisa de nome`);
    assert.equal(unidade.ativa, true);
    assert.equal(unidade.schemaVersion, 1);
  }
});

test('EQUIPES: as 3 equipes canônicas, com unidadeId/caminhoUnidade coerentes com UNIDADES', () => {
  assert.equal(EQUIPES.length, 3);
  assert.deepEqual(IDS_EQUIPES, ['GEDSI_COSI_SOC', 'GEDSI_COSI_PLANTAO', 'GEDSI_CODB_NOC']);

  const porId = new Map(UNIDADES.map((unidade) => [unidade.unidadeId, unidade]));
  for (const equipe of EQUIPES) {
    const unidade = porId.get(equipe.unidadeId);
    assert.ok(unidade, `${equipe.id} referencia unidadeId "${equipe.unidadeId}" que precisa existir`);
    assert.deepEqual(equipe.caminhoUnidade, unidade.caminho);
    // Para os IDs canônicos, o código organizacional derivado coincide com o próprio id.
    assert.equal(equipe.codigoOrganizacional, equipe.id);
    // Nunca inverter: uma equipe nunca pode ter o unidadeId de outra equipe.
    assert.equal(IDS_EQUIPES.includes(equipe.unidadeId), false, `${equipe.id}.unidadeId não pode ser um equipeId`);
  }

  assert.equal(porId.get(EQUIPES[0].unidadeId).unidadeId, 'GEDSI_COSI');
  assert.equal(EQUIPES.find((equipe) => equipe.id === 'GEDSI_CODB_NOC').unidadeId, 'GEDSI_CODB');
});

test('GRUPO_PLANTAO: entidade separada da equipe responsável, equipesConsulta sempre inclui a própria equipe responsável', () => {
  assert.equal(GRUPO_PLANTAO.grupoId, 'PLANTAO_GEDSI_COSI');
  assert.equal(GRUPO_PLANTAO.equipeResponsavelId, 'GEDSI_COSI_PLANTAO');
  assert.notEqual(GRUPO_PLANTAO.grupoId, GRUPO_PLANTAO.equipeResponsavelId);
  assert.ok(GRUPO_PLANTAO.equipesConsulta.includes(GRUPO_PLANTAO.equipeResponsavelId));
  assert.equal(GRUPO_PLANTAO.unidadeResponsavelId, 'GEDSI_COSI');
  assert.deepEqual(GRUPO_PLANTAO.caminhoUnidadeResponsavel, ['PRE', 'DIO', 'GEDSI', 'GEDSI_COSI']);
});

test('MATRIZ_INICIAL: 3 entradas cobrindo SOC/Plantão COSI/NOC, com id derivado corretamente', () => {
  assert.equal(MATRIZ_INICIAL.length, 3);
  assert.deepEqual(
    IDS_MATRIZ,
    MATRIZ_INICIAL.map((escopo) => idEscopoOperacional(escopo.tipo, escopo.alvoId)),
  );
  assert.deepEqual(IDS_MATRIZ.slice().sort(), [
    'JORNADA_GEDSI_CODB_NOC',
    'JORNADA_GEDSI_COSI_SOC',
    'PLANTAO_PLANTAO_GEDSI_COSI',
  ]);

  const loginsSeed = new Set(USUARIOS_SEED.map((usuario) => usuario.login));
  for (const escopo of MATRIZ_INICIAL) {
    assert.ok(escopo.ativo);
    assert.equal(escopo.schemaVersion, 1);
    for (const login of escopo.responsaveisLogin) {
      assert.ok(loginsSeed.has(login), `responsável "${login}" precisa estar em USUARIOS_SEED`);
    }
  }

  const plantao = MATRIZ_INICIAL.find((escopo) => escopo.tipo === 'PLANTAO');
  assert.ok(plantao.responsaveisLogin.includes('marina.azevedo'), 'Marina (GESTOR_UNIDADE de GEDSI_COSI) também administra o Plantão COSI');
});

test('USUARIOS_SEED: os 4 usuários de teste pedidos, com perfil/escopo/equipeId/unidadeId corretos', () => {
  assert.equal(USUARIOS_SEED.length, 4);
  const porLogin = new Map(USUARIOS_SEED.map((usuario) => [usuario.login, usuario]));

  const admin = porLogin.get('admin');
  assert.equal(admin.perfil, 'ADMIN_SISTEMA');
  assert.equal(admin.escopo, 'GLOBAL');

  // STAGING-RESET-HIERARQUIA-ICI-2 — Marina é GESTOR_UNIDADE de GEDSI_COSI
  // (a coordenação inteira), não mais GESTOR_EQUIPE só de SOC.
  const marina = porLogin.get('marina.azevedo');
  assert.equal(marina.perfil, 'GESTOR_UNIDADE');
  assert.equal(marina.escopo, 'UNIDADE');
  assert.equal(marina.unidadeId, 'GEDSI_COSI');
  assert.deepEqual(marina.unidadesPermitidas, ['GEDSI_COSI']);
  assert.equal(marina.equipeId, 'GEDSI_COSI_SOC', 'equipeId continua só como compatibilidade visual');
  assert.equal(IDS_EQUIPES.includes(marina.unidadeId), false, 'unidadeId de Marina não pode ser um equipeId');

  const coordenadorPlantao = porLogin.get('coordenador.plantao.cosi');
  assert.equal(coordenadorPlantao.equipeId, 'GEDSI_COSI_PLANTAO');
  assert.ok(['GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'].includes(coordenadorPlantao.perfil));
  assert.equal(coordenadorPlantao.escopo, 'EQUIPE');

  // STAGING-RESET-HIERARQUIA-ICI-2 — Wanessa é GESTOR_UNIDADE de GEDSI_CODB.
  const wanessa = porLogin.get('wanessa.moriyama');
  assert.equal(wanessa.perfil, 'GESTOR_UNIDADE');
  assert.equal(wanessa.escopo, 'UNIDADE');
  assert.equal(wanessa.unidadeId, 'GEDSI_CODB');
  assert.deepEqual(wanessa.unidadesPermitidas, ['GEDSI_CODB']);
  assert.equal(wanessa.equipeId, 'GEDSI_CODB_NOC');
  assert.equal(IDS_EQUIPES.includes(wanessa.unidadeId), false, 'unidadeId de Wanessa não pode ser um equipeId');

  for (const usuario of USUARIOS_SEED) {
    assert.equal(usuario.ativo, true);
    if (usuario.unidadeId !== undefined) {
      assert.equal(IDS_UNIDADE_SIMPLES_PROIBIDOS.includes(usuario.unidadeId), false, `${usuario.login}.unidadeId não pode ser um ID simples`);
    }
  }
});

test('idEscopoOperacional() espelha exatamente firestore.rules (tipo + "_" + alvoId)', () => {
  assert.equal(idEscopoOperacional('JORNADA', 'GEDSI_COSI_SOC'), 'JORNADA_GEDSI_COSI_SOC');
  assert.equal(idEscopoOperacional('PLANTAO', 'PLANTAO_GEDSI_COSI'), 'PLANTAO_PLANTAO_GEDSI_COSI');
});
