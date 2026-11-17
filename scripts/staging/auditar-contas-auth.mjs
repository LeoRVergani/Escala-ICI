#!/usr/bin/env node
/**
 * SEGURANCA-1 — AUDITORIA SOMENTE LEITURA das contas do Firebase Authentication de staging.
 *
 * Por que existe: as Regras do Firestore identificam a pessoa pelo TEXTO ANTES DO "@" do e-mail
 * (`fulano@qualquer.com` => `fulano`). Se o projeto aceitar cadastro por e-mail/senha sem verificar
 * o e-mail, alguém poderia criar uma conta com o mesmo "fulano" e herdar as permissões dele. Este script
 * lista as contas que fogem do esperado, para você conferir se isso já aconteceu (ou se pode acontecer).
 *
 *   npm run staging:auditar:contas-auth                       # domínio mais comum do cadastro
 *   npm run staging:auditar:contas-auth -- --dominio=ici.tec.br
 *
 * Nunca grava, apaga nem altera nada (o teste de fronteira confere isso). Requer GOOGLE_APPLICATION_CREDENTIALS.
 */
import process from 'node:process';
import { getAuth } from 'firebase-admin/auth';

import { inicializarAdminStaging } from './firebaseAdminStaging.mjs';

const loginDe = (email) => (email ?? '').split('@')[0].toLowerCase().trim();
const dominioDe = (email) => ((email ?? '').split('@')[1] ?? '').toLowerCase().trim();
const data = (texto) => (texto ? new Date(texto).toLocaleDateString('pt-BR') : '—');

async function main() {
  const { app, db } = inicializarAdminStaging({ appName: 'auditar-contas-auth' });
  const auth = getAuth(app);

  const cadastro = new Map();
  for (const documento of (await db.collection('usuarios').get()).docs) cadastro.set(documento.id, documento.data());

  const contas = [];
  let token;
  do {
    const pagina = await auth.listUsers(1000, token);
    contas.push(...pagina.users);
    token = pagina.pageToken;
  } while (token);

  const contagemDominios = new Map();
  for (const dados of cadastro.values()) {
    const dominio = dominioDe(String(dados.email ?? ''));
    if (dominio) contagemDominios.set(dominio, (contagemDominios.get(dominio) ?? 0) + 1);
  }
  const argumento = process.argv.find((item) => item.startsWith('--dominio='))?.split('=')[1]?.toLowerCase();
  const dominioEsperado = argumento ?? [...contagemDominios.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  const achados = [];
  for (const conta of contas) {
    const email = conta.email ?? '';
    const provedores = conta.providerData.map((item) => item.providerId);
    const problemas = [];
    if (dominioEsperado && dominioDe(email) !== dominioEsperado) problemas.push(['ALTO', `domínio "${dominioDe(email)}" diferente de "${dominioEsperado}" — o login "${loginDe(email)}" valeria como o da empresa`]);
    if (provedores.includes('password') && !conta.emailVerified) problemas.push([cadastro.has(loginDe(email)) ? 'ALTO' : 'MÉDIO', 'conta de e-mail/senha com e-mail NÃO verificado']);
    if (!cadastro.has(loginDe(email))) problemas.push(['MÉDIO', 'sem cadastro em usuarios/ (conta autenticada que não é de ninguém)']);
    else if (cadastro.get(loginDe(email)).ativo === false) problemas.push(['MÉDIO', 'cadastro INATIVO, mas a conta de acesso continua existindo']);
    if (problemas.length > 0) achados.push({ email, provedores: provedores.join(',') || '—', criada: data(conta.metadata.creationTime), ultimo: data(conta.metadata.lastSignInTime), problemas });
  }

  console.log(`\nProjeto: escala-ici-staging · ${contas.length} conta(s) no Auth · ${cadastro.size} cadastro(s) em usuarios · domínio esperado: ${dominioEsperado || '(não determinado)'}\n`);
  if (achados.length === 0) {
    console.log('✔ Nenhuma conta fora do esperado.\n');
  } else {
    for (const achado of achados.sort((a, b) => (a.problemas[0][0] === 'ALTO' ? 0 : 1) - (b.problemas[0][0] === 'ALTO' ? 0 : 1))) {
      console.log(`• ${achado.email}  [provedor: ${achado.provedores} · criada ${achado.criada} · último acesso ${achado.ultimo}]`);
      for (const [gravidade, texto] of achado.problemas) console.log(`    ${gravidade}: ${texto}`);
    }
    console.log(`\n${achados.length} conta(s) para revisar.`);
  }
  console.log('\nConfira também NO CONSOLE do Firebase → Authentication → Settings → User actions:');
  console.log('  • "Enable create (sign-up)" deve estar DESLIGADO (contas só criadas por você);');
  console.log('  • "Email enumeration protection" LIGADO;  • em Sign-in method, Microsoft com o Tenant ID da empresa.\n');
  console.log('Este script só leu dados: nada foi alterado.\n');
}

main().catch((erro) => { console.error(erro instanceof Error ? erro.message : erro); process.exit(1); });
