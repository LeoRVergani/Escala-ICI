import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

// FASE-PLANTAO-MULTIPOSTO-WORKSPACE-1: tabs Todos/DBA/Linux/Telecom/Windows +
// cards de saúde por posto + Nova escala multiposto. Ver
// docs/spec/PLANTAO_MULTIPOSTO.md.

test('1. lib/plantaoMultiposto.ts é puro — sem Firestore, sem React, sem SDK nenhum', async () => {
  const fonte = semComentarios(await ler('lib/plantaoMultiposto.ts'));
  for (const proibido of ['firebase/firestore', 'firebase/auth', 'setDoc', 'updateDoc', 'getDoc', 'getDocs', "from 'react'", 'useState', 'useEffect']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('2. CardFuncaoPlantao.tsx não importa Firebase — só apresentação em memória', async () => {
  const fonte = semComentarios(await ler('components/plantao/CardFuncaoPlantao.tsx'));
  for (const proibido of ['firebase/firestore', 'firebase/auth', 'setDoc', 'updateDoc', 'getDoc', 'getDocs']) {
    assert.doesNotMatch(fonte, new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), proibido);
  }
});

test('3. nenhum componente CardDBA/CardLinux/CardTelecom/CardWindows específico foi criado — CardFuncaoPlantao é genérico (§33 da fase)', async () => {
  for (const arquivo of ['CardDBA.tsx', 'CardLinux.tsx', 'CardTelecom.tsx', 'CardWindows.tsx']) {
    await assert.rejects(
      access(new URL(`../components/plantao/${arquivo}`, import.meta.url)),
      `componente específico por função não deveria existir: ${arquivo}`,
    );
  }
});

test('4. as tabs de posto no Dashboard são geradas a partir de funcoesEsperadas.map(...), nunca 4 botões DBA/Linux/Telecom/Windows hardcoded', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(
    dashboard,
    /funcoesEsperadas\.map\(\(funcao\) =>/u,
    'as tabs de posto precisam vir de funcoesEsperadas.map(...), nunca hardcoded',
  );
  // Nenhum literal de texto fixo "DBA"/"Linux"/"Telecom"/"Windows" como rótulo de botão de tab — só via ROTULO_FUNCAO_PLANTAO.
  for (const literal of ['>DBA<', '>Linux<', '>Telecom<', '>Windows<']) {
    assert.doesNotMatch(dashboard, new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), `rótulo hardcoded encontrado: ${literal}`);
  }
});

test('5. o filtro por função usa filtrarAtribuicoesPlantaoPorFuncao — nenhuma condicional manual "atribuicao.funcao ===" duplicada no Dashboard', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  assert.match(dashboard, /filtrarAtribuicoesPlantaoPorFuncao\(atribuicoesEditaveis, funcaoSelecionada\)/u);
  assert.doesNotMatch(
    dashboard,
    /atribuicao\.funcao\s*===\s*['"](DBA|LINUX|TELECOM|WINDOWS)['"]/u,
    'nenhuma comparação manual de funcao por posto específico deveria existir fora de lib/plantaoMultiposto.ts',
  );
});

test('6. trocar a função selecionada é só filtro visual — nenhuma chamada a setDoc/salvarAtribuicoesPlantaoRascunho/publicarCompetenciaPlantao no setter de funcaoSelecionadaPlantao', async () => {
  const dashboard = semComentarios(await ler('apps/dashboard/src/DashboardApp.tsx'));
  const declaracao = dashboard.match(/const \[funcaoSelecionadaPlantao, setFuncaoSelecionadaPlantao\] = useState<FiltroFuncaoPlantao>\('TODOS'\);/u);
  assert.ok(declaracao, 'funcaoSelecionadaPlantao precisa ser puro useState, nunca derivado de um efeito com escrita');
});

test('7. construirGrupoPlantaoOficial aceita funcoesEsperadas opcional — Nova escala multiposto nunca cria mais de um GrupoPlantao', async () => {
  const fonte = semComentarios(await ler('lib/gruposPlantaoProvisionamento.ts'));
  assert.match(fonte, /funcoesEsperadas\?:\s*readonly FuncaoPlantao\[\]/u);
  assert.doesNotMatch(fonte, /for\s*\(.*funcoesEsperadas/su, 'nunca iterar funcoesEsperadas para criar múltiplos Grupos');
});
