import { calcularTotais, periodoDoPonto, type TipoTurno, type TurnosMes } from '@escala-ici/contrato';

/**
 * MATRIZ-TURNOS-1 — junta o TRECHO de uma matriz "turno × data" (ex.: escala de fim de ano) com a escala que já existir da
 * competência. Só os dias do trecho são trocados; todo o resto da escala (os outros dias do período, e as pessoas que não
 * estão na matriz) é preservado. Função pura: quem escolhe e carrega a base é o Dashboard.
 */
export interface ResultadoMesclagemTrecho {
  documentos: TurnosMes[];
  avisos: string[];
}

export type OrigemBase = 'RASCUNHO' | 'PUBLICADA';

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ddmmaaaa = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)}`;

/** O documento vira rascunho: sai tudo o que dizia "publicado" e as pendências da versão anterior. */
function comoRascunho(documento: TurnosMes): TurnosMes {
  const { importacaoId: _importacao, pendenciasImportacao: _pendencias, publicadoPor: _por, publicadoEm: _em, ...resto } = documento;
  void _importacao; void _pendencias; void _por; void _em;
  return { ...resto, status: 'RASCUNHO' };
}

export function mesclarTrechoNaBase(
  trecho: readonly TurnosMes[],
  base: readonly TurnosMes[],
  opcoes: { catalogo: Record<string, TipoTurno>; competencia: string; origemBase?: OrigemBase },
): ResultadoMesclagemTrecho {
  const inicio = trecho[0]?.periodoInicio ?? '';
  const fim = trecho[0]?.periodoFim ?? '';
  const avisos: string[] = [];
  if (trecho.length === 0) return { documentos: [], avisos };

  if (base.length === 0) {
    avisos.push(
      `A escala normal de ${opcoes.competencia} ainda não existe: este rascunho só tem os dias do trecho (${ddmm(inicio)} a ${ddmm(fim)}). `
      + 'Quando importar a escala normal, reaplique este arquivo POR CIMA dela — senão a escala normal apaga o trecho.',
    );
    return { documentos: trecho.map((documento) => ({ ...documento })), avisos };
  }

  const periodoBase = base[0] !== undefined
    ? { periodoInicio: base[0].periodoInicio, periodoFim: base[0].periodoFim }
    : (periodoDoPonto(opcoes.competencia) ?? { periodoInicio: inicio, periodoFim: fim });
  const loginsDoTrecho = new Set(trecho.map((documento) => documento.login));
  const documentos: TurnosMes[] = [];
  const semEscalaNormal: string[] = [];

  for (const documentoBase of base) {
    const doTrecho = trecho.find((candidato) => candidato.login === documentoBase.login);
    if (doTrecho === undefined) {
      documentos.push(comoRascunho(documentoBase));
      continue;
    }
    const dias = { ...documentoBase.dias, ...doTrecho.dias };
    documentos.push({
      ...comoRascunho(documentoBase),
      usuarioUid: doTrecho.usuarioUid !== '' ? doTrecho.usuarioUid : documentoBase.usuarioUid,
      turnoPadrao: documentoBase.turnoPadrao !== '' ? documentoBase.turnoPadrao : doTrecho.turnoPadrao,
      dias,
      totais: calcularTotais(dias, opcoes.catalogo),
    });
  }
  for (const doTrecho of trecho) {
    if (base.some((documentoBase) => documentoBase.login === doTrecho.login)) continue;
    semEscalaNormal.push(doTrecho.login);
    documentos.push({ ...doTrecho, periodoInicio: periodoBase.periodoInicio, periodoFim: periodoBase.periodoFim });
  }

  const origem = opcoes.origemBase === 'PUBLICADA' ? 'publicada' : 'em rascunho';
  avisos.push(
    `Mesclado sobre a escala ${origem} de ${opcoes.competencia}: os dias de ${ddmmaaaa(inicio)} a ${ddmmaaaa(fim)} foram trocados para `
    + `${trecho.length} pessoa(s); todos os outros dias foram mantidos.`,
  );
  const foraDoTrecho = base.filter((documentoBase) => !loginsDoTrecho.has(documentoBase.login)).map((documentoBase) => documentoBase.login);
  if (foraDoTrecho.length > 0) {
    avisos.push(`Não estão na matriz e mantêm os dias da escala normal durante o trecho: ${foraDoTrecho.join(', ')}.`);
  }
  if (semEscalaNormal.length > 0) {
    avisos.push(`Sem escala normal em ${opcoes.competencia} (só terão os dias do trecho): ${semEscalaNormal.join(', ')}.`);
  }
  return { documentos, avisos };
}
