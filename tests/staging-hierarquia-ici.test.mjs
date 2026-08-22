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

  const cosi = porId.get('COSI');
  assert.equal(cosi.parentId, 'GEDSI');
  assert.equal(cosi.tipo, 'COORDENACAO');
  assert.equal(cosi.nivelHierarquico, 'TATICO');
  assert.deepEqual(cosi.caminho, ['PRE', 'DIO', 'GEDSI', 'COSI']);

  const codb = porId.get('CODB');
  assert.deepEqual(codb.caminho, ['PRE', 'DIO', 'GEDSI', 'CODB']);

  const gesup = porId.get('GESUP');
  assert.equal(gesup.parentId, 'DIO');
  const coat = porId.get('COAT');
  assert.equal(coat.parentId, 'GESUP');
  assert.deepEqual(coat.caminho, ['PRE', 'DIO', 'GESUP', 'COAT']);

  const geope = porId.get('GEOPE');
  assert.equal(geope.parentId, 'DIO');
  const copc = porId.get('COPC');
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
  }

  assert.equal(porId.get(EQUIPES[0].unidadeId).unidadeId, 'COSI');
  assert.equal(EQUIPES.find((equipe) => equipe.id === 'GEDSI_CODB_NOC').unidadeId, 'CODB');
});

test('GRUPO_PLANTAO: entidade separada da equipe responsável, equipesConsulta sempre inclui a própria equipe responsável', () => {
  assert.equal(GRUPO_PLANTAO.grupoId, 'PLANTAO_GEDSI_COSI');
  assert.equal(GRUPO_PLANTAO.equipeResponsavelId, 'GEDSI_COSI_PLANTAO');
  assert.notEqual(GRUPO_PLANTAO.grupoId, GRUPO_PLANTAO.equipeResponsavelId);
  assert.ok(GRUPO_PLANTAO.equipesConsulta.includes(GRUPO_PLANTAO.equipeResponsavelId));
  assert.equal(GRUPO_PLANTAO.unidadeResponsavelId, 'COSI');
  assert.deepEqual(GRUPO_PLANTAO.caminhoUnidadeResponsavel, ['PRE', 'DIO', 'GEDSI', 'COSI']);
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
});

test('USUARIOS_SEED: os 4 usuários de teste pedidos, com perfil/escopo/equipeId corretos', () => {
  assert.equal(USUARIOS_SEED.length, 4);
  const porLogin = new Map(USUARIOS_SEED.map((usuario) => [usuario.login, usuario]));

  const admin = porLogin.get('admin');
  assert.equal(admin.perfil, 'ADMIN_SISTEMA');
  assert.equal(admin.escopo, 'GLOBAL');

  const marina = porLogin.get('marina.azevedo');
  assert.equal(marina.equipeId, 'GEDSI_COSI_SOC');
  assert.ok(['GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'].includes(marina.perfil));
  assert.equal(marina.escopo, 'EQUIPE');

  const coordenadorPlantao = porLogin.get('coordenador.plantao.cosi');
  assert.equal(coordenadorPlantao.equipeId, 'GEDSI_COSI_PLANTAO');
  assert.ok(['GESTOR_EQUIPE', 'SUPERVISOR_EQUIPE'].includes(coordenadorPlantao.perfil));

  const wanessa = porLogin.get('wanessa.moriyama');
  assert.equal(wanessa.equipeId, 'GEDSI_CODB_NOC');
  assert.equal(wanessa.perfil, 'SUPERVISOR_EQUIPE');

  for (const usuario of USUARIOS_SEED) {
    assert.equal(usuario.ativo, true);
  }
});

test('idEscopoOperacional() espelha exatamente firestore.rules (tipo + "_" + alvoId)', () => {
  assert.equal(idEscopoOperacional('JORNADA', 'GEDSI_COSI_SOC'), 'JORNADA_GEDSI_COSI_SOC');
  assert.equal(idEscopoOperacional('PLANTAO', 'PLANTAO_GEDSI_COSI'), 'PLANTAO_PLANTAO_GEDSI_COSI');
});
