import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Fase FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-1 — primeira versão
 * funcional da visão "Plantão" no App/PWA do colaborador (quem está de
 * plantão agora/próximo, meus próprios plantões, meus contatos). Ver
 * docs/spec/APP_PLANTAO_VISUALIZACAO.md.
 */

test('1. a aba "Plantão" existe na navegação do App, entre Trocas e Equipe', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  assert.match(app, /type Tela = [^;]*'plantao'/su, 'o tipo Tela precisa incluir "plantao"');
  const navegacao = /const NAVEGACAO: ItemNavegacao\[\] = \[([\s\S]*?)\];/u.exec(app);
  assert.ok(navegacao, 'NAVEGACAO precisa existir');
  const indiceTrocas = navegacao[1].indexOf("id: 'trocas'");
  const indicePlantao = navegacao[1].indexOf("id: 'plantao'");
  const indiceEquipe = navegacao[1].indexOf("id: 'equipe'");
  assert.ok(indiceTrocas > 0 && indicePlantao > indiceTrocas && indiceEquipe > indicePlantao,
    'a ordem precisa ser hoje, minha, trocas, plantao, equipe, perfil');
  assert.match(app, /icone:\s*'plantao'/u);
  assert.match(app, /\{tela === 'plantao' && usuario && \(/u, 'o bloco de renderização da tela precisa existir');
});

test('2. a visão "Plantão" só lê a competência PUBLICADA — nunca rascunho, nunca localStorage como fonte da escala', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  assert.match(app, /listarAtribuicoesPlantaoPublicada/u);
  assert.match(app, /obterCompetenciaPlantaoPublicada/u);
  for (const proibido of ['listarAtribuicoesPlantaoRascunho', 'obterCompetenciaPlantaoRascunho', 'rascunhosCompetenciasPlantao']) {
    assert.doesNotMatch(app, new RegExp(proibido, 'u'), proibido);
  }
  // localStorage no App continua só para notificações lidas/dispositivo —
  // nunca para guardar a escala/atribuições de Plantão.
  const usosLocalStorage = app.match(/window\.localStorage\.(?:get|set)Item\([^)]*\)/gu) ?? [];
  for (const uso of usosLocalStorage) {
    assert.doesNotMatch(uso, /plantao|atribuic/iu, `localStorage não pode ser fonte da escala de Plantão: ${uso}`);
  }
});

test('3. a lógica pura de Plantão do App (apps/app/src/plantaoApp.ts) não depende de Firestore/React', async () => {
  const fonte = await ler('apps/app/src/plantaoApp.ts');
  for (const proibido of ["from 'firebase/firestore'", "from 'react'", 'useState', 'useEffect', 'getFirestore']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('4. a autoatualização de contatos do plantonista sempre usa o próprio login — nunca outro login', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  assert.match(
    app,
    /atualizarContatosPlantonista\(grupoPlantaoApp\.grupoId, usuario\.login, contatosEdicaoApp\)/u,
    'a chamada de escrita precisa usar usuario.login (o próprio usuário autenticado), nunca um login recebido por parâmetro/props',
  );
});

test('5. o App do colaborador não ganha nenhuma escrita administrativa de Plantão (grupo/participante/publicação)', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  for (const proibido of [
    'salvarGrupoPlantao',
    'salvarParticipantePlantao',
    'desativarParticipantePlantao',
    'publicarCompetenciaPlantao',
    'salvarCompetenciaPlantaoRascunho',
    'salvarAtribuicoesPlantaoRascunho',
  ]) {
    assert.doesNotMatch(app, new RegExp(proibido, 'u'), proibido);
  }
});

test('6. a troca de plantão ainda não tem fluxo de escrita — só uma entrada visual desabilitada, documentada como próxima fase', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  const inicio = app.indexOf("{tela === 'plantao' && usuario && (");
  const fim = app.indexOf("{tela === 'equipe' && (");
  assert.ok(inicio > 0 && fim > inicio, 'a tela "plantao" precisa existir antes da tela "equipe"');
  const telaPlantao = app.slice(inicio, fim);
  assert.match(telaPlantao, /Solicitar troca de plantão/u);
  assert.match(telaPlantao, /disabled/u, 'o botão de solicitar troca de Plantão precisa estar desabilitado nesta fase');
  assert.doesNotMatch(telaPlantao, /criarSolicitacaoTroca/u, 'a tela de Plantão não pode disparar a escrita de troca (o fluxo ainda não existe para Plantão)');
});

test('7. a tela "Hoje" (Jornada SOC) e o fluxo de Trocas SOC continuam intactos — a aba Plantão é aditiva', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  assert.match(app, /\{tela === 'hoje' && \(/u);
  assert.match(app, /function TurnoHoje\(/u);
  assert.match(app, /function ProximoTurno\(/u);
  assert.match(app, /\{tela === 'trocas' && usuario && \(/u);
  assert.match(app, /criarSolicitacaoTroca/u, 'a criação de troca de Jornada SOC continua existindo (fora da tela de Plantão)');
});

test('8. "Meus contatos de plantão" (Perfil) só aparece para quem é participante ativo do Grupo carregado', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  const inicio = app.indexOf("{tela === 'perfil' && (");
  assert.ok(inicio > 0, 'a tela "perfil" precisa existir');
  const trecho = app.slice(inicio, inicio + 4000);
  assert.match(trecho, /Meus contatos de plantão/u);
  assert.match(
    trecho,
    /participantesPlantaoApp\.some\(\(participante\) => participante\.login === usuario\.login && participante\.ativo\)/u,
    'o card de contatos precisa checar participação ativa do próprio usuário antes de aparecer',
  );
});

/**
 * FASE-PLANTAO-POS-PUBLICACAO-APP-VISUALIZACAO-2 — calendário mensal +
 * cor de identificação por plantonista. Ver docs/spec/PLANTOES.md § 33.5.
 */

test('9. o calendário mensal de Plantão do App reaproveita a MESMA grade da Jornada — nenhum sistema de calendário paralelo', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  const inicio = app.indexOf('function CalendarioPlantaoApp(');
  assert.ok(inicio > 0, 'CalendarioPlantaoApp precisa existir');
  const fim = app.indexOf('\nfunction ', inicio + 10);
  const componente = app.slice(inicio, fim > 0 ? fim : inicio + 4000);
  for (const classe of ['calendar-view', 'calendar-weekdays', 'calendar-grid', 'calendar-blank', 'shift-chip']) {
    assert.match(componente, new RegExp(`className="[^"]*\\b${classe}\\b`, 'u'), `precisa reaproveitar .${classe}`);
  }
  assert.doesNotMatch(componente, /className="plantao-grid/u, 'não pode importar o grid do Editor (Dashboard) para o App');
});

test('10. a cor no calendário usa a MESMA paleta de identidade (data-identidade), nunca uma cor livre/hex escolhida pelo usuário', async () => {
  const [app, contrato] = await Promise.all([
    ler('apps/app/src/EmployeeApp.tsx'),
    ler('packages/contrato/src/modeloPlantaoPersistente.ts'),
  ]);
  assert.match(app, /data-identidade=\{indice\}/u, 'o seletor de cor no Perfil precisa usar data-identidade (paleta fixa)');
  assert.doesNotMatch(app, /type="color"/u, 'nunca um <input type="color"> livre');
  assert.match(contrato, /export const TAMANHO_PALETA_IDENTIDADE_PLANTAO = 8;/u);
  assert.match(contrato, /export function corPlantonistaPreferidaValida/u);
});

test('11. a autoatualização da cor de Plantão sempre usa o próprio login — nunca outro login', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  assert.match(
    app,
    /atualizarCorPlantonista\(grupoPlantaoApp\.grupoId, usuario\.login, indice\)/u,
    'a chamada de escrita da cor precisa usar usuario.login (o próprio usuário autenticado)',
  );
});

test('12. Rules: o próprio plantonista pode alterar corPreferida, mas o campo é opcional e validado (0..7)', async () => {
  const rules = await ler('firestore.rules');
  const bloco = /match \/gruposPlantao\/\{grupoId\}\/participantes\/\{login\} \{([\s\S]*?)\n {4}\}/u.exec(rules);
  assert.ok(bloco, 'match de participantes precisa existir');
  assert.match(bloco[1], /hasOnly\(\['contatos', 'corPreferida', 'atualizadoEm'\]\)/u, 'a allowlist do self-update precisa incluir corPreferida');
  assert.match(rules, /function corPlantonistaPreferidaValida\(cor\) \{/u);
});

test('13. a visão "Plantão" não mostra mais o texto genérico de permissão de gestor quando a Matriz nega a consulta — mensagem específica e honesta', async () => {
  const app = await ler('apps/app/src/EmployeeApp.tsx');
  const inicio = app.indexOf('async function carregarPlantaoApp()');
  const fim = app.indexOf('\n  async function salvarMeusContatosApp', inicio);
  assert.ok(inicio > 0 && fim > inicio, 'carregarPlantaoApp precisa existir');
  const corpo = semComentarios(app.slice(inicio, fim));
  assert.match(corpo, /permission-denied/u, 'precisa distinguir especificamente o erro de permissão');
  assert.doesNotMatch(corpo, /permissão de gestor/u, 'nunca sugerir "permissão de gestor" (fora de comentários) para uma ação de CONSULTA do App');
});
