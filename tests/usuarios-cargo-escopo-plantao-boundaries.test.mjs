import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// Fase PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1 — ver docs/spec/EDITOR_ESCALAS.md,
// docs/spec/ESCOPO_OPERACIONAL_MATRIZ.md e docs/spec/ESCALA_ICI_MASTER_SPEC.md.

// --- Parte A: cargo real sobrevive a criar/editar/vincular usuário --------

test('1. abrirEdicaoUsuario preserva o cargo existente no formulário (nunca reseta para vazio)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const corpo = /function abrirEdicaoUsuario\(item: Usuario\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(corpo, 'abrirEdicaoUsuario precisa existir');
  assert.match(corpo[1], /cargo: item\.cargo,/u);
});

test('2. criar E editar usuário gravam o cargo digitado no formulário (candidato de criação e de edição)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /async function salvarFormularioUsuario\(\) \{/u, 'salvarFormularioUsuario precisa existir');

  const candidatoCriacao = /candidato = \{\s*\.\.\.novoUsuario\([\s\S]*?\),\s*nome: formularioUsuario\.nome,\s*email: formularioUsuario\.email,\s*cargo: formularioUsuario\.cargo,/u;
  assert.match(dashboard, candidatoCriacao, 'o ramo de criação (loginOriginal === null) precisa gravar cargo: formularioUsuario.cargo');

  const candidatoEdicao = /candidato = \{\s*\.\.\.original,\s*nome: formularioUsuario\.nome,\s*email: formularioUsuario\.email,\s*cargo: formularioUsuario\.cargo,/u;
  assert.match(dashboard, candidatoEdicao, 'o ramo de edição (loginOriginal existente) precisa gravar cargo: formularioUsuario.cargo');
});

test('3. editar usuário (loginOriginal existente) parte de `...original` e sobrescreve só os campos do formulário — nunca reconstrói do zero perdendo campos não editados', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /const original = usuarios\.find\(\(item\) => item\.login === formularioUsuario\.loginOriginal\);/u);
  assert.match(dashboard, /candidato = \{\s*\.\.\.original,\s*nome: formularioUsuario\.nome,\s*email: formularioUsuario\.email,\s*cargo: formularioUsuario\.cargo,/u);
});

test('4. salvarUsuario persiste com merge:true — atualizar contato/perfil nunca apaga cargo por omissão em outro caminho de escrita', async () => {
  const writeRepo = await ler('lib/firebase/writeRepository.ts');
  const corpo = /export async function salvarUsuario\(usuario: Usuario\): Promise<void> \{([\s\S]*?)\n\}/u.exec(writeRepo);
  assert.ok(corpo, 'salvarUsuario precisa existir');
  assert.match(corpo[1], /setDoc\(doc\(db, 'usuarios', usuario\.login\), removerUndefined\(usuario\), \{ merge: true \}\);/u);
});

test('5. lerUsuario (normalização Firestore → Usuario) preserva cargo — nunca descartado na leitura', async () => {
  const shared = await ler('lib/firebase/shared.ts');
  const corpo = /function lerUsuario\([\s\S]*?\n\}/u.exec(shared);
  assert.ok(corpo, 'lerUsuario precisa existir');
  assert.match(corpo[0], /cargo: String\(dados\.cargo \?\? ''\)/u);
});

// --- Parte B: usuários visíveis por escopo no contexto Plantão -----------

test('6. trocar para um contexto de Plantão carrega o pool de usuários elegíveis (equipe responsável + equipesConsulta + unidade), mesmo sem rascunho aberto', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const funcao = /async function aplicarTrocaContexto\(alvo: ContextoEscalaAtivo\) \{([\s\S]*?)\n {4}\}\n {4}if \(usuarioEfetivo === null\)/u.exec(dashboard);
  assert.ok(funcao, 'aplicarTrocaContexto precisa existir com o branch PLANTAO isolado antes do branch JORNADA');
  const branchPlantao = funcao[1];

  assert.match(
    branchPlantao,
    /listarUsuariosElegiveisPlantao\(grupo\.equipeResponsavelId, grupo\.grupoId, grupo\.unidadeResponsavelId, grupo\.equipesConsulta\)/u,
    'o mesmo pool amplo já usado pelo vínculo/importação precisa ser carregado ao entrar no contexto Plantão',
  );
  assert.match(branchPlantao, /setUsuarios\(valorLeitura\(resultados\[2\], usuarios\)\)/u, 'setUsuarios precisa acontecer incondicionalmente, antes do branch "sem rascunho"');

  // A chamada precisa vir ANTES do early-return "sem rascunho" (linha
  // `if (competenciaExistente === null) { ... return; }`), senão o Plantão
  // já Publicado (sem rascunho aberto) continua sem popular `usuarios`.
  const indiceSetUsuarios = branchPlantao.indexOf('setUsuarios(valorLeitura(resultados[2], usuarios))');
  const indiceEarlyReturn = branchPlantao.indexOf('if (competenciaExistente === null)');
  assert.ok(indiceSetUsuarios >= 0 && indiceEarlyReturn >= 0 && indiceSetUsuarios < indiceEarlyReturn, 'setUsuarios precisa rodar antes do early-return de "sem rascunho"');
});

test('7. o pool de usuários do Plantão nunca derruba a troca de contexto — listarUsuariosElegiveisPlantao é tolerante e participa do Promise.allSettled, não de um await isolado que poderia rejeitar', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const readRepo = semComentarios(await ler('lib/firebase/readRepository.ts'));

  const funcao = /async function aplicarTrocaContexto\(alvo: ContextoEscalaAtivo\) \{([\s\S]*?)\n {4}\}\n {4}if \(usuarioEfetivo === null\)/u.exec(dashboard);
  assert.ok(funcao);
  assert.match(funcao[1], /Promise\.allSettled\(\[\s*obterCompetenciaPlantaoRascunho\(grupo\.grupoId, alvo\.competencia\),\s*obterCompetenciaPlantaoPublicada\(grupo\.grupoId, alvo\.competencia\),[\s\S]*?listarUsuariosElegiveisPlantao\(/u);

  const corpoListar = /export async function listarUsuariosElegiveisPlantao\([\s\S]*?\n\}/u.exec(readRepo);
  assert.ok(corpoListar, 'listarUsuariosElegiveisPlantao precisa existir');
  assert.match(corpoListar[0], /\.catch\(\(\) => \[\]\)/u, 'a sub-consulta de listarUsuariosDoPlantao precisa ser tolerante');
  assert.match(corpoListar[0], /catch \{\s*return \[\];\s*\}/u, 'as sub-consultas por equipeId/unidadeId precisam ser tolerantes (nunca rejeitam ao chamador)');
});

test('8. a tela Usuários não tem filtro de contexto próprio duplicado — ela só renderiza o estado `usuarios`, que quem alimenta corretamente é aplicarTrocaContexto/abrirRascunhoNoEditorAcao/carregarDadosDaEquipe (nenhuma segunda fonte de verdade)', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const bloco = /tela === 'usuarios' && \([\s\S]*?\n {6}\)\}/u.exec(dashboard);
  assert.ok(bloco, "o bloco de renderização da tela 'usuarios' precisa existir");
  assert.doesNotMatch(bloco[0], /listarUsuarios(ElegiveisPlantao)?\(|getDocs\(|collection\(/u, 'a tela de renderização não pode buscar dados por conta própria — só consome o estado `usuarios` já carregado');
});

test('9. participar do Plantão (ParticipantePlantao) nunca é confundido com o cadastro de usuários — o schema não tem perfil/escopo/equipeId', async () => {
  const contrato = semComentarios(await ler('packages/contrato/src/modeloPlantaoPersistente.ts'));
  const interfaceParticipante = /export interface ParticipantePlantao \{([\s\S]*?)\n\}/u.exec(contrato);
  assert.ok(interfaceParticipante, 'ParticipantePlantao precisa existir');
  assert.doesNotMatch(interfaceParticipante[1], /\bperfil\b|\bescopo\b|\bequipeId\b/u, 'participação de Plantão nunca pode carregar perfil/escopo/equipeId — vínculo é registro separado do cadastro principal (usuarios/{login})');

  const writeRepo = semComentarios(await ler('lib/firebase/plantaoWriteRepository.ts'));
  const corpo = /export async function salvarParticipantePlantao\(participante: ParticipantePlantao\): Promise<void> \{([\s\S]*?)\n\}/u.exec(writeRepo);
  assert.ok(corpo, 'salvarParticipantePlantao precisa existir');
  assert.match(corpo[1], /setDoc\(\s*doc\(db, 'gruposPlantao', participante\.grupoId, 'participantes', participante\.login\),\s*removerUndefined\(participante\)/u, 'grava só o objeto ParticipantePlantao tipado, nunca um payload solto que poderia incluir campos do usuário');
});
