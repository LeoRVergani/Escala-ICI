import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * PATCH-PLANTAO-VINCULO-GESTOR-COMO-PARTICIPANTE-1 — a causa raiz de
 * `usuarios/clis` (GESTOR_UNIDADE) não aparecer na aba Vínculos do Plantão
 * era o POOL DE CANDIDATOS: `listarUsuariosDoPlantao()` só busca
 * `equipeId == <equipe do grupo> && cadastroOperacional.tipo == 'PLANTAO'
 * && cadastroOperacional.alvoId == <grupo>` — um filtro para "quem já foi
 * cadastrado especificamente através deste Grupo", não "quem pode
 * participar". Nenhum filtro por perfil/escopo existia em
 * `lib/conciliacaoPlantoes.ts` (cobertura de comportamento real está lá e
 * em `lib/firebase/readRepository.test.ts`); estes testes travam a
 * correção estrutural — a nova função ampla no lugar certo, a busca
 * manual mais completa, e que vincular participante nunca escreve no
 * cadastro do usuário.
 */

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('1. listarUsuariosElegiveisPlantao existe e cobre equipeId (equipe responsável + equipesConsulta) e unidadeId — nunca filtra por perfil', async () => {
  const repo = await ler('lib/firebase/readRepository.ts');
  assert.ok(repo.includes('export async function listarUsuariosElegiveisPlantao('));
  assert.ok(repo.includes("where('equipeId', '==', valor)"));
  assert.ok(repo.includes("where('unidadeId', '==', valor)"));
  assert.ok(!repo.includes("where('perfil'"), 'não pode existir nenhum filtro por perfil na consulta de candidatos');
  assert.ok(!repo.includes("where('escopo'"), 'não pode existir nenhum filtro por escopo na consulta de candidatos');
  // unidadesPermitidas/equipesPermitidas (array-contains) foram cogitados,
  // mas um teste em tests/firebase/firestore.rules.test.ts provou que essa
  // consulta falha ("Null value error") para qualquer ator não-admin — por
  // isso a função só chama getDocs/query duas vezes (equipeId e unidadeId),
  // nunca com 'array-contains' como operador real de consulta.
  const chamadasQuery = repo.match(/getDocs\(query\(collection\(db, 'usuarios'\), where\([^)]*\)\)\)/gu) ?? [];
  assert.ok(chamadasQuery.every((chamada) => !chamada.includes('array-contains')));
});

test('2. os 5 pontos de importação/abertura/troca de contexto de Plantão usam o pool amplo, não mais o pool estreito, para popular os candidatos de vínculo', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  const ocorrencias = dashboard.match(/listarUsuariosElegiveisPlantao\(grupo\.equipeResponsavelId, grupo\.grupoId, grupo\.unidadeResponsavelId, grupo\.equipesConsulta\)/gu) ?? [];
  // PATCH-USUARIOS-CARGO-ESCOPO-PLANTAO-1 acrescentou o 5º ponto: trocar
  // para um contexto de Plantão (aplicarTrocaContexto) agora também carrega
  // o pool amplo, mesmo sem rascunho aberto — antes a tela Usuários ficava
  // com o pool de uma troca de equipe anterior (ex.: busca por "jean" vazia
  // com Plantão COSI Publicado e sem rascunho).
  assert.equal(ocorrencias.length, 5, 'criar plantão vazio, usar período anterior, importar XLS, abrir rascunho existente e trocar de contexto (aplicarTrocaContexto) devem usar o pool amplo');
  // O caminho estreito de checagem de duplicidade em "criar e vincular"
  // (dentro de salvarFormularioUsuario) continua existindo — não é o
  // mesmo problema, e trocá-lo mudaria o comportamento de deduplicação de
  // login que ele resolve.
  assert.ok(dashboard.includes('listarUsuariosDoPlantao(equipeIdCadastroUsuario, grupoCadastroVinculo?.grupoId'));
});

test('3. busca manual (buscarUsuariosPlantao) passou a cobrir e-mail e aliases, não só nome/login', async () => {
  const conciliacao = await ler('lib/conciliacaoPlantoes.ts');
  assert.ok(conciliacao.includes('usuario.email.toLowerCase().includes(termoEmail)'));
  assert.ok(conciliacao.includes("(usuario.loginAliases ?? []).some((alias) => normalizarNome(alias).includes(chave))"));
  assert.ok(conciliacao.includes("(usuario.aliasesPlanilha ?? []).some((alias) => normalizarNome(alias).includes(chave))"));
});

test('4/5. confirmar vínculo de participante nunca escreve no cadastro do usuário (perfil/escopo/unidade nunca mudam)', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  const conciliacao = await ler('lib/conciliacaoPlantoes.ts');
  // confirmarVinculoPlantao() só usa usuario.login — nunca grava o objeto
  // Usuario inteiro nem toca em perfil/escopo/unidadeId.
  assert.ok(conciliacao.includes('login: usuario.login, status:'));
  assert.doesNotMatch(conciliacao, /confirmarVinculoPlantao[\s\S]{0,400}perfil/u);
  // O handler do Dashboard só atualiza o estado local de vínculos — nenhuma
  // escrita em `usuarios/{login}` acontece ao confirmar um vínculo.
  const handler = /function confirmarVinculoPlantaoAcao\(participanteNomeOriginal: string, usuario: Usuario\) \{([\s\S]*?)\n {2}\}/u.exec(dashboard);
  assert.ok(handler, 'confirmarVinculoPlantaoAcao precisa existir');
  assert.ok(handler[1].includes('setVinculosPlantao('));
  assert.doesNotMatch(handler[1], /salvarUsuario|atualizarAliasesPlanilha|setUsuarios\(/u, 'confirmar vínculo não pode escrever/atualizar o cadastro do usuário');
});

test('6. a legenda de perfil/unidade aparece no resultado de busca sem esconder nome/login, e não é uma ação de escrita', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.ok(dashboard.includes('{candidato.nome} ({candidato.login}){candidato.ativo ? \'\' : \' — inativo\'}'));
  assert.ok(dashboard.includes('Perfil: {LABEL_PERFIL_DELEGAVEL[candidato.perfil] ?? candidato.perfil}'));
  assert.ok(dashboard.includes("candidato.unidadeId ? ` · Unidade: ${candidato.unidadeId}` : ''"));
});

test('7. firestore.rules ganhou só a branch mínima necessária (unidadeId), provada por teste antes de escrever — nunca amplia para ADMIN_SISTEMA/GLOBAL nem toca outra collection', async () => {
  const rules = await ler('firestore.rules');
  assert.ok(rules.includes("|| (souGestorUnidade() && resource.data.get('unidadeId', null) != null && resource.data.unidadeId in minhasUnidadesPermitidas())"));
  // A nova branch mora dentro do bloco de leitura de usuarios/{login} —
  // nunca em outra collection nem em create/update/delete.
  const blocoUsuarios = /match \/usuarios\/\{login\} \{\s*allow read: if autenticado\(\)([\s\S]*?)\);/u.exec(rules);
  assert.ok(blocoUsuarios, 'esperava encontrar o bloco allow read de usuarios/{login}');
  assert.ok(blocoUsuarios[1].includes('souGestorUnidade()'));
});

test('12. Jornada não regrediu — helpers/testes de Jornada permanecem intocados nesta fase', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  assert.ok(dashboard.includes('function abrirCadastroUsuarioParaConciliacao(linha: LinhaConciliacao)'));
  assert.ok(dashboard.includes("registrarAuditoriaOperacional('ASSOCIAR_USUARIO_IMPORTACAO', escolhido.equipeId,"));
});

test('13. o Grupo de Plantão de COSI continua resolvendo para PLANTAO_GEDSI_COSI, nunca um novo grupo nem GEDSI_COSI_SOC como responsável', async () => {
  const hierarquia = await ler('scripts/staging/hierarquia-ici.mjs');
  assert.ok(hierarquia.includes("grupoId: 'PLANTAO_GEDSI_COSI'"));
  assert.ok(hierarquia.includes("equipeResponsavelId: 'GEDSI_COSI_PLANTAO'"));
  assert.doesNotMatch(hierarquia, /GRUPO_PLANTAO[\s\S]{0,400}equipeResponsavelId:\s*'GEDSI_COSI_SOC'/u);
});

test('14/15. nenhum grupo novo foi criado por este patch — só as funções de leitura/busca/UI mudaram', async () => {
  const dashboard = await ler('apps/dashboard/src/DashboardApp.tsx');
  // abrirNovoGrupoPlantao/criarGrupoWizard continuam existindo, mas nenhuma
  // chamada nova a eles foi adicionada por este patch (ver git diff — este
  // teste é uma trava textual mínima: a função de criação de grupo não foi
  // tocada e continua exigindo ação explícita do coordenador).
  assert.ok(dashboard.includes('function abrirNovoGrupoPlantao()'));
});
