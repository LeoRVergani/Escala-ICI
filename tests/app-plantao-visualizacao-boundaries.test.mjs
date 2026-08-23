import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

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
