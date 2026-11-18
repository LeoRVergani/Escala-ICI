/**
 * DIAGNOSTICO-PUBLICACAO-1 — parte PURA (sem rede, sem Firebase) do diagnóstico "por que a publicação foi recusada?".
 *
 * Fluxo (dois comandos, ver docs/operacao/DIAGNOSTICO_PUBLICACAO.md):
 *   1) `exportar-contexto-regras.mjs` — LÊ o contexto real do staging (usuário, equipes, Matriz, ambiente) e grava num arquivo local;
 *   2) `simular-publicacao.mjs` — dentro do EMULADOR do Firestore, com as Regras de verdade (`firestore.rules`), repete a sequência
 *      de `publicarEscalas()` como esse usuário e diz QUAL gravação é negada e em QUAL linha das Regras.
 * Nada é gravado no staging: a simulação só escreve no emulador.
 */

/** O que as Regras consultam para decidir quem administra uma Jornada (verificado em firestore.rules). */
export const COLECOES_DO_CONTEXTO = ['usuarios', 'equipes', 'escoposOperacionais', 'config', 'gruposPlantao'];

/** Documento do Firestore -> JSON (Timestamp vira `{ __ts: milissegundos }`). `ehTimestamp` é injetado (testável sem o SDK). */
export function serializar(valor, ehTimestamp) {
  if (valor === null || valor === undefined) return null;
  if (ehTimestamp(valor)) return { __ts: valor.toMillis() };
  if (Array.isArray(valor)) return valor.map((item) => serializar(item, ehTimestamp));
  if (typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([chave, item]) => [chave, serializar(item, ehTimestamp)]));
  return valor;
}

/** JSON -> documento (inverso de `serializar`). `criarTimestamp(ms)` é injetado. */
export function reviver(valor, criarTimestamp) {
  if (Array.isArray(valor)) return valor.map((item) => reviver(item, criarTimestamp));
  if (valor !== null && typeof valor === 'object') {
    const chaves = Object.keys(valor);
    if (chaves.length === 1 && chaves[0] === '__ts' && typeof valor.__ts === 'number') return criarTimestamp(valor.__ts);
    return Object.fromEntries(chaves.map((chave) => [chave, reviver(valor[chave], criarTimestamp)]));
  }
  return valor;
}

/** Id do documento da Matriz de uma Jornada (`idEscopoOperacional('JORNADA', equipeId)` das Regras). */
export const idEscopoJornada = (equipeId) => `JORNADA_${equipeId}`;

/** Resumo do contexto — só o que ajuda a entender a decisão (logins e códigos; nenhum dado pessoal além do login). */
export function resumirContexto(contexto, login) {
  const usuario = contexto.colecoes?.usuarios?.[login] ?? null;
  const equipeId = usuario?.equipeId ?? null;
  const matriz = equipeId === null ? null : (contexto.colecoes?.escoposOperacionais?.[idEscopoJornada(equipeId)] ?? null);
  const equipe = equipeId === null ? null : (contexto.colecoes?.equipes?.[equipeId] ?? null);
  return {
    login,
    usuarioExiste: usuario !== null,
    perfil: usuario?.perfil ?? '(sem perfil explícito)',
    equipeId,
    equipesPermitidas: usuario?.equipesPermitidas ?? [],
    unidadesPermitidas: usuario?.unidadesPermitidas ?? [],
    nivelHierarquico: usuario?.nivelHierarquico ?? null,
    ativo: usuario?.ativo ?? null,
    emailCadastrado: Boolean(usuario?.email),
    equipeExiste: equipe !== null,
    equipeUnidadeId: equipe?.unidadeId ?? null,
    matrizExiste: matriz !== null,
    matrizAtiva: matriz?.ativo ?? null,
    matrizResponsaveisLogin: matriz?.responsaveisLogin ?? [],
    matrizResponsaveisEquipe: matriz?.responsaveisEquipe ?? [],
    ambienteStaging: contexto.colecoes?.config?.ambiente?.staging ?? null,
  };
}

/** Todas as linhas de `firestore.rules` citadas pelo emulador (`false for 'create' @ L2049, ...`), sem repetir, na ordem. */
export function linhasDaRegra(mensagem) {
  const linhas = [];
  for (const achado of String(mensagem).matchAll(/@ L(\d+)/gu)) {
    const numero = Number(achado[1]);
    if (!linhas.includes(numero)) linhas.push(numero);
  }
  return linhas;
}

/** Explica uma recusa: as linhas das Regras (com o trecho de cada uma) e se foi limite de expressões/acessos (erro de avaliação, não "false"). */
export function explicarNegacao(mensagem, linhasDasRegras) {
  const texto = String(mensagem);
  return {
    linhas: linhasDaRegra(texto).slice(0, 5).map((numero) => ({ numero, trecho: (linhasDasRegras[numero - 1] ?? '').trim().slice(0, 140) })),
    limiteDeExpressoes: /maximum of \d+ expressions/iu.test(texto),
    limiteDeAcessos: /maximum of \d+ (document )?access/iu.test(texto) || /too many (document )?accesses/iu.test(texto),
    curta: texto.replace(/\s+/gu, ' ').slice(0, 220),
  };
}

/** Os documentos que a publicação grava, no mesmo formato das coleções reais (só os campos que as Regras olham, mais o essencial). */
export function montarPayloads({ login, equipeId, competencia, periodoInicio, periodoFim, agoraIso }) {
  const chave = `${equipeId}_${competencia}`;
  const colaborador = (n) => `diag.colaborador${n}`;
  const turno = (n, status) => ({
    schemaVersion: 1, usuarioUid: `diag-uid-${n}`, login: colaborador(n), equipeId, competencia, periodoInicio, periodoFim,
    turnoPadrao: 'M', dias: {}, status, pendenciasImportacao: [], publicadoPor: status === 'PUBLICADA' ? login : null,
    publicadoEm: status === 'PUBLICADA' ? agoraIso : null, atualizadoEm: agoraIso,
  });
  const publicacao = (revisao) => ({
    id: `${chave}_r${revisao}`, chavePublicacao: chave, equipeId, competencia, revisao, tipo: 'PUBLICACAO', totalDocumentos: 9,
    motivo: 'diagnóstico', publicadoPor: login, publicadoEm: agoraIso,
  });
  return {
    chave,
    colaborador,
    rascunho: (n) => turno(n, 'RASCUNHO'),
    turnosMes: (n) => turno(n, 'PUBLICADA'),
    versao: (n, revisao) => ({ ...turno(n, 'PUBLICADA'), chavePublicacao: chave, revisao }),
    evento: (n, revisao) => ({
      id: `${chave}_r${revisao}_${colaborador(n)}`, equipeId, competencia, usuarioUid: `diag-uid-${n}`, login: colaborador(n),
      publicadoPor: login, alteracoes: [], criadoEm: agoraIso,
    }),
    historico: (revisao) => publicacao(revisao),
    estado: (revisao) => ({
      id: chave, equipeId, competencia, revisaoAtual: revisao, ultimaPublicacaoId: `${chave}_r${revisao}`, atualizadoPor: login, atualizadoEm: agoraIso,
    }),
  };
}

/**
 * O veredito, em português, a partir dos resultados dos passos.
 * Cada resultado: `{ id, tipo: 'leitura' | 'rascunho' | 'publicacao' | 'lote', ok, negacao? }`.
 */
export function montarVeredito(resultados) {
  const negados = resultados.filter((item) => !item.ok);
  if (negados.length === 0) {
    return [
      'Nenhuma recusa: com os dados reais de hoje, as Regras PERMITEM a publicação inteira desse usuário.',
      'Então a causa não está nas Regras nem nos dados lidos. Confira: (1) se o Dashboard carregado é o novo (Ctrl+F5; a versão aparece no rodapé do menu);',
      '(2) se a conta logada no navegador é mesmo esse usuário e se não está em "Simular gestor"; (3) o console do navegador (F12) na hora de publicar.',
    ];
  }
  const nomes = (lista) => lista.map((item) => item.id).join(', ');
  const rascunho = resultados.filter((item) => item.tipo === 'rascunho');
  const leituras = resultados.filter((item) => item.tipo === 'leitura');
  const publicacao = resultados.filter((item) => item.tipo === 'publicacao');
  const lote = resultados.filter((item) => item.tipo === 'lote');
  const linhas = [];
  const todosDeEscritaNegados = [...rascunho, ...publicacao].every((item) => !item.ok);
  if (todosDeEscritaNegados && rascunho.length > 0) {
    linhas.push('As Regras NÃO reconhecem esse usuário como administrador desta Jornada: nem o rascunho passa.');
    linhas.push('Veja nas linhas abaixo qual alternativa de `podeAdministrarJornada` falhou (a Matriz da Jornada, o fallback de gestor, o de unidade).');
  } else if (rascunho.every((item) => item.ok) && publicacao.some((item) => !item.ok)) {
    linhas.push(`A autorização básica passa (o rascunho é permitido), mas a PUBLICAÇÃO é recusada em: ${nomes(publicacao.filter((item) => !item.ok))}.`);
  } else if (publicacao.every((item) => item.ok) && lote.some((item) => !item.ok)) {
    linhas.push('Cada gravação passa SOZINHA, mas o LOTE da publicação é recusado: o problema é o limite de acessos/expressões POR LOTE, não a permissão em si.');
  } else {
    linhas.push(`Recusadas: ${nomes(negados)}.`);
  }
  if (leituras.some((item) => !item.ok)) linhas.push(`Atenção: leituras recusadas (${nomes(leituras.filter((item) => !item.ok))}) — a publicação começa lendo o estado anterior.`);
  if (negados.some((item) => item.negacao?.limiteDeExpressoes)) linhas.push('Houve estouro do limite de 1000 expressões por regra: é erro de AVALIAÇÃO (a regra é grande demais para esse caminho), não permissão negada de verdade.');
  if (negados.some((item) => item.negacao?.limiteDeAcessos)) linhas.push('Houve estouro do limite de acessos a documentos por requisição/lote.');
  return linhas;
}
