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

export function calcularAlteracoesEscala(
  anteriores: readonly TurnosMes[],
  novos: readonly TurnosMes[],
): AlteracaoEscala[] {
  const antigosPorUsuario = new Map(
    anteriores.map((documento) => [documento.usuarioUid, documento]),
  );
  const novosPorUsuario = new Map(
    novos.map((documento) => [documento.usuarioUid, documento]),
  );
  const usuarios = new Set([...antigosPorUsuario.keys(), ...novosPorUsuario.keys()]);
  const alteracoes: AlteracaoEscala[] = [];

  for (const usuarioUid of usuarios) {
    const antigo = antigosPorUsuario.get(usuarioUid);
    const novo = novosPorUsuario.get(usuarioUid);
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
        usuarioUid,
        login: novo?.login ?? antigo?.login ?? usuarioUid,
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
    const grupo = grupos.get(alteracao.usuarioUid) ?? [];
    grupo.push(alteracao);
    grupos.set(alteracao.usuarioUid, grupo);
  }
  return grupos;
}
