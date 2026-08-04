import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const PROJECT_ID = 'demo-escala-ici-fase3i';
const EQUIPE_ID = 'EQ_COSI_SOC';
const COMPETENCIA = '2026-08';
const chavePublicacao = `${EQUIPE_ID}_${COMPETENCIA}`;

const ambiente = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  },
});

try {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    const db = contexto.firestore();
    const [estado, historico, versoes, ativas, rascunhos, equipes, usuarios] = await Promise.all([
      getDoc(doc(db, 'publicacoesEscala', chavePublicacao)),
      getDocs(query(
        collection(db, 'historicoPublicacoes'),
        where('chavePublicacao', '==', chavePublicacao),
      )),
      getDocs(query(
        collection(db, 'versoesEscala'),
        where('chavePublicacao', '==', chavePublicacao),
        where('revisao', '==', 1),
      )),
      getDocs(query(
        collection(db, 'turnosMes'),
        where('equipeId', '==', EQUIPE_ID),
        where('competencia', '==', COMPETENCIA),
      )),
      getDocs(collection(db, 'rascunhosTurnosMes')),
      getDocs(collection(db, 'equipes')),
      getDocs(collection(db, 'usuarios')),
    ]);

    assert.equal(estado.exists(), true, 'ponteiro da publicação ausente');
    assert.equal(estado.data()?.revisaoAtual, 1, 'revisão inicial inválida');
    assert.equal(historico.size, 1, 'histórico inicial inválido');
    assert.equal(versoes.size, 3, 'versões individuais da carga inicial inválidas');
    assert.equal(ativas.size, 3, 'escalas publicadas da carga inicial inválidas');
    assert.equal(rascunhos.empty, true, 'o seed não deve criar rascunhos');
    assert.equal(equipes.size, 1, 'o laboratório deve conter apenas a equipe SOC');
    assert.equal(equipes.docs[0]?.data().nome, 'COSI > SOC');
    assert.equal(usuarios.size, 10, 'usuários necessários para a planilha de exemplo ausentes');
    const caio = usuarios.docs.find((snapshot) =>
      snapshot.data().email === 'caio.monteiro@teste.local');
    assert.deepEqual(caio?.data().loginAliases, ['liavilar']);
  });
  console.log('Seed validado: revisão 1, histórico e três escalas fictícias do COSI/SOC.');
} finally {
  await ambiente.cleanup();
}
