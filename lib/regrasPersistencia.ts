import { validarRegra, type RegraEscala } from './regrasEscala';

/**
 * REGRAS-ESCALA-4 — como uma regra da empresa vira documento (`regrasEscala/{id}`) e
 * como um documento volta a ser regra. Puro: o repositório só chama o Firestore.
 * As regras LEGAIS ficam no código (`regrasPadrao.ts`) e nunca são gravadas aqui.
 */
export const COLECAO_REGRAS_ESCALA = 'regrasEscala';

export interface RegraEscalaSalva extends RegraEscala {
  criadoPorLogin: string;
  criadoEm: string;
  atualizadoPorLogin: string;
  atualizadoEm: string;
}

/** Id do documento: regra que só existia em teste ('teste-…') passa a 'regra-…'. */
export function idParaSalvar(regra: Pick<RegraEscala, 'id'>): string {
  const id = regra.id.toLowerCase().replace(/^teste-/u, 'regra-').replace(/[^a-z0-9-]/gu, '-');
  return id.startsWith('regra-') ? id : `regra-${id}`;
}

/**
 * Documento a gravar. Só os campos que as Rules aceitam; `ids` só quando o alcance é por equipe.
 * `existente` preserva quem criou e quando (edição); sem ele, é uma regra nova.
 */
export function montarDocumentoRegra(
  regra: RegraEscala,
  autorLogin: string,
  agoraIso: string,
  existente?: Pick<RegraEscalaSalva, 'criadoPorLogin' | 'criadoEm'> | null,
): RegraEscalaSalva {
  const sugestao = regra.entao.sugestao?.trim() ?? '';
  return {
    id: idParaSalvar(regra),
    nome: regra.nome.replace(/\s+/gu, ' ').trim(),
    descricao: regra.descricao.trim(),
    categoria: 'EMPRESA',
    ativa: regra.ativa,
    quando: {
      logica: regra.quando.logica,
      condicoes: regra.quando.condicoes.map((condicao) => ({ variavel: condicao.variavel, op: condicao.op, valor: condicao.valor })),
    },
    entao: {
      gravidade: regra.entao.gravidade,
      bloqueiaPublicacao: regra.entao.bloqueiaPublicacao,
      mensagem: regra.entao.mensagem.trim(),
      agrupar: regra.entao.agrupar,
      ...(sugestao === '' ? {} : { sugestao }),
    },
    vale: regra.vale.tipo === 'EQUIPE' ? { tipo: 'EQUIPE', ids: [...new Set(regra.vale.ids ?? [])] } : { tipo: 'TODAS' },
    origem: 'ADMIN',
    schemaVersion: 1,
    criadoPorLogin: existente?.criadoPorLogin ?? autorLogin,
    criadoEm: existente?.criadoEm ?? agoraIso,
    atualizadoPorLogin: autorLogin,
    atualizadoEm: agoraIso,
  };
}

/** O documento é gravável? (mesma validação do motor — nada inválido chega ao banco.) */
export function errosParaSalvar(regra: RegraEscala): string[] {
  return validarRegra({ ...regra, categoria: 'EMPRESA' });
}

/**
 * Lê o que veio do banco. Documento malformado ou regra inválida vira `null` (é ignorado,
 * nunca derruba a tela nem roda): quem define o que vale é o motor, não o banco.
 */
export function lerRegraSalva(id: string, dados: Record<string, unknown>): RegraEscalaSalva | null {
  if (typeof dados !== 'object' || dados === null) return null;
  const candidata = { ...dados, id } as unknown as RegraEscalaSalva;
  if (candidata.categoria !== 'EMPRESA' || candidata.schemaVersion !== 1) return null;
  if (typeof candidata.descricao !== 'string') candidata.descricao = '';
  try {
    if (validarRegra(candidata).length > 0) return null;
  } catch {
    return null;
  }
  return {
    ...candidata,
    criadoPorLogin: String(dados.criadoPorLogin ?? ''),
    criadoEm: String(dados.criadoEm ?? ''),
    atualizadoPorLogin: String(dados.atualizadoPorLogin ?? ''),
    atualizadoEm: String(dados.atualizadoEm ?? ''),
  };
}
