import type { Dia, TurnosMes } from '@escala-ici/contrato';

import type { AlteracaoEscala } from './modelos';

function horario(dia: Dia | undefined): string | null {
  if (dia?.i === undefined || dia.f === undefined) {
    return null;
  }
  return `${dia.i}–${dia.f}`;
}

function assinatura(dia: Dia | undefined): string {
  if (dia === undefined) {
    return '';
  }
  return JSON.stringify({
    c: dia.c,
    i: dia.i ?? null,
    f: dia.f ?? null,
    m: dia.m ?? null,
    vd: dia.vd ?? null,
    seq: dia.seq ?? null,
  });
}

/**
 * Compara por `login`, não por `usuarioUid`: o login é a chave funcional
 * estável. Comparar por `usuarioUid` quebraria a primeira publicação depois
 * de qualquer transição (campo antigo/legado divergente do login), tratando
 * a mesma pessoa como "removida" e "adicionada" ao mesmo tempo.
 */
export function calcularAlteracoesEscala(
  anteriores: readonly TurnosMes[],
  novos: readonly TurnosMes[],
): AlteracaoEscala[] {
  const antigosPorLogin = new Map(
    anteriores.map((documento) => [documento.login, documento]),
  );
  const novosPorLogin = new Map(
    novos.map((documento) => [documento.login, documento]),
  );
  const logins = new Set([...antigosPorLogin.keys(), ...novosPorLogin.keys()]);
  const alteracoes: AlteracaoEscala[] = [];

  for (const login of logins) {
    const antigo = antigosPorLogin.get(login);
    const novo = novosPorLogin.get(login);
    const datas = new Set([
      ...Object.keys(antigo?.dias ?? {}),
      ...Object.keys(novo?.dias ?? {}),
    ]);
    for (const data of [...datas].sort()) {
      const antes = antigo?.dias[data];
      const depois = novo?.dias[data];
      if (assinatura(antes) === assinatura(depois)) {
        continue;
      }
      alteracoes.push({
        usuarioUid: login,
        login,
        data,
        codigoAnterior: antes?.c ?? null,
        horarioAnterior: horario(antes),
        codigoNovo: depois?.c ?? null,
        horarioNovo: horario(depois),
      });
    }
  }
  return alteracoes;
}

export function agruparAlteracoesPorUsuario(
  alteracoes: readonly AlteracaoEscala[],
): Map<string, AlteracaoEscala[]> {
  const grupos = new Map<string, AlteracaoEscala[]>();
  for (const alteracao of alteracoes) {
    const grupo = grupos.get(alteracao.login) ?? [];
    grupo.push(alteracao);
    grupos.set(alteracao.login, grupo);
  }
  return grupos;
}
