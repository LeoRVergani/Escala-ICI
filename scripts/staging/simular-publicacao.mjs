#!/usr/bin/env node
/**
 * DIAGNOSTICO-PUBLICACAO-1 — passo 2: dentro do EMULADOR do Firestore, com as Regras de verdade (`firestore.rules`) e o contexto
 * real exportado no passo 1, repete a sequência de `publicarEscalas()` como esse usuário e mostra QUAL gravação é negada e em
 * QUAL linha das Regras. Só escreve no emulador — nada vai para o staging.
 *
 *   npx firebase emulators:exec --only firestore --project demo-escala-ici-fase3i \
 *     "node scripts/staging/simular-publicacao.mjs --login=<login> [--competencia=2026-12] [--arquivo=/tmp/contexto-regras.json]"
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where, writeBatch } from 'firebase/firestore';

import { explicarNegacao, montarPayloads, montarVeredito, resumirContexto, reviver } from './diagnosticoPublicacaoLib.mjs';

const argumento = (nome) => process.argv.find((item) => item.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const PROJETO = process.env.GCLOUD_PROJECT ?? 'demo-escala-ici-fase3i';

async function main() {
  const login = (argumento('login') ?? '').trim().toLowerCase();
  const arquivo = argumento('arquivo') ?? '/tmp/contexto-regras.json';
  const competencia = argumento('competencia') ?? '2026-12';
  if (login === '') {
    console.error('Uso: ... "node scripts/staging/simular-publicacao.mjs --login=<login> [--competencia=2026-12] [--arquivo=/tmp/contexto-regras.json]"');
    process.exitCode = 2;
    return;
  }
  const contexto = JSON.parse(readFileSync(arquivo, 'utf8'));
  const resumo = resumirContexto(contexto, login);
  if (!resumo.usuarioExiste) {
    console.error(`Não há usuarios/${login} no contexto exportado: as Regras negariam tudo (o doc ID é o login).`);
    process.exitCode = 1;
    return;
  }
  const equipeId = argumento('equipe') || resumo.equipeId;
  if (!equipeId) {
    // GESTOR_UNIDADE e afins não têm equipe própria: sem dizer QUAL Jornada, a simulação rodaria com equipe vazia e não valeria nada.
    console.error(`"${login}" não tem equipe própria (perfil ${resumo.perfil}): informe a Jornada com --equipe=<id>. Equipes no contexto exportado:`);
    for (const [id, equipe] of Object.entries(contexto.colecoes.equipes ?? {})) console.error(`  ${id}  (${equipe.nome ?? '?'})`);
    process.exitCode = 2;
    return;
  }
  const regrasTexto = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const linhasDasRegras = regrasTexto.split('\n');

  const ambiente = await initializeTestEnvironment({ projectId: PROJETO, firestore: { rules: regrasTexto } });
  try {
    await ambiente.withSecurityRulesDisabled(async (contextoAdmin) => {
      const dbAdmin = contextoAdmin.firestore();
      for (const [nomeColecao, documentos] of Object.entries(contexto.colecoes)) {
        for (const [id, dados] of Object.entries(documentos)) await setDoc(doc(dbAdmin, nomeColecao, id), reviver(dados, (ms) => Timestamp.fromMillis(ms)));
      }
    });
    const email = contexto.colecoes.usuarios[login].email ?? `${login}@diagnostico.local`;
    const db = ambiente.authenticatedContext('sessao-diagnostico', { email }).firestore();

    const agoraIso = new Date().toISOString();
    const base = { login, equipeId, competencia, periodoInicio: '2026-11-17', periodoFim: '2026-12-15', agoraIso };
    const p = montarPayloads(base);
    const resultados = [];
    async function passo(id, tipo, funcao) {
      try {
        await funcao();
        resultados.push({ id, tipo, ok: true });
      } catch (erro) {
        resultados.push({ id, tipo, ok: false, negacao: explicarNegacao(erro instanceof Error ? erro.message : String(erro), linhasDasRegras) });
      }
    }

    // 1) o que publicarEscalas() LÊ antes de escrever
    await passo('ler publicacoesEscala (estado anterior)', 'leitura', () => getDoc(doc(db, 'publicacoesEscala', p.chave)));
    // A consulta como `publicarEscalas()` a faz hoje: com o status FIXADO (as Regras só liberam a quem administra pela Matriz assim).
    await passo('listar turnosMes da equipe/competência (com status=PUBLICADA, como a publicação faz)', 'leitura', () => getDocs(query(collection(db, 'turnosMes'), where('equipeId', '==', equipeId), where('competencia', '==', competencia), where('status', '==', 'PUBLICADA'))));
    await passo('listar rascunhosTurnosMes da equipe/competência', 'leitura', () => getDocs(query(collection(db, 'rascunhosTurnosMes'), where('equipeId', '==', equipeId), where('competencia', '==', competencia))));
    // comparação (não entra no veredito): a mesma consulta SEM o status, como era antes da correção
    await passo('(informativo) a mesma consulta SEM o filtro de status, como era antes', 'informativo', () => getDocs(query(collection(db, 'turnosMes'), where('equipeId', '==', equipeId), where('competencia', '==', competencia))));
    // 2) cada gravação SOZINHA (descobre qual coleção é negada)
    await passo('gravar rascunhosTurnosMes ("Salvar rascunho")', 'rascunho', () => setDoc(doc(db, 'rascunhosTurnosMes', `diag_ind_${p.chave}_1`), p.rascunho(1)));
    await passo('gravar turnosMes', 'publicacao', () => setDoc(doc(db, 'turnosMes', `diag_ind_${p.chave}_1`), p.turnosMes(1)));
    await passo('gravar versoesEscala', 'publicacao', () => setDoc(doc(db, 'versoesEscala', `diag_ind_${p.chave}_1`), p.versao(1, 1)));
    await passo('gravar eventosEscala', 'publicacao', () => setDoc(doc(db, 'eventosEscala', `diag_ind_${p.chave}_1`), { ...p.evento(1, 1), id: `diag_ind_${p.chave}_1` }));
    await passo('gravar historicoPublicacoes', 'publicacao', () => setDoc(doc(db, 'historicoPublicacoes', `diag_ind_${p.chave}`), { ...p.historico(1), id: `diag_ind_${p.chave}` }));
    await passo('gravar publicacoesEscala', 'publicacao', () => setDoc(doc(db, 'publicacoesEscala', `diag_ind_${p.chave}`), { ...p.estado(1), id: `diag_ind_${p.chave}` }));
    // 3) o LOTE inteiro, como o Dashboard faz (9 colaboradores: turnosMes + versao + evento, mais histórico e estado)
    await passo('LOTE da publicação (9 colaboradores)', 'lote', async () => {
      const lote = writeBatch(db);
      for (let n = 1; n <= 9; n += 1) {
        lote.set(doc(db, 'turnosMes', `diag_lote_${p.chave}_${n}`), p.turnosMes(n));
        lote.set(doc(db, 'versoesEscala', `diag_lote_${p.chave}_${n}`), p.versao(n, 2));
        lote.set(doc(db, 'eventosEscala', `diag_lote_${p.chave}_${n}`), { ...p.evento(n, 2), id: `diag_lote_${p.chave}_${n}` });
      }
      lote.set(doc(db, 'historicoPublicacoes', `diag_lote_${p.chave}`), { ...p.historico(2), id: `diag_lote_${p.chave}` });
      lote.set(doc(db, 'publicacoesEscala', `diag_lote_${p.chave}`), { ...p.estado(2), id: `diag_lote_${p.chave}` });
      await lote.commit();
    });

    console.log(`\nSimulação como "${login}" (equipe ${equipeId}, competência ${competencia}) com as Regras atuais de firestore.rules:\n`);
    console.log('Contexto real lido do staging:');
    for (const [chave, valor] of Object.entries(resumo)) console.log(`  ${chave}: ${JSON.stringify(valor)}`);
    console.log('\nResultado de cada passo:');
    for (const resultado of resultados) {
      const marca = resultado.tipo === 'informativo' ? (resultado.ok ? 'ℹ permitido' : 'ℹ negado   ') : (resultado.ok ? '✓ permitido' : '✗ NEGADO   ');
      console.log(`  ${marca}  ${resultado.id}`);
      if (!resultado.ok) {
        for (const linha of resultado.negacao.linhas) console.log(`        firestore.rules:L${linha.numero}  ${linha.trecho}`);
        if (resultado.negacao.linhas.length === 0) console.log(`        ${resultado.negacao.curta}`);
      }
    }
    console.log('\nVeredito:');
    for (const linha of montarVeredito(resultados)) console.log(`  ${linha}`);
  } finally {
    await ambiente.cleanup();
  }
}

main()
  .catch((erro) => {
    console.error('Falha na simulação:', erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  // o SDK do Firestore pode deixar conexões abertas: termina explicitamente (o emulador é desligado pelo `emulators:exec`).
  .finally(() => process.exit(process.exitCode ?? 0));
