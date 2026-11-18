import { Timestamp, type Firestore } from 'firebase-admin/firestore';

/**
 * RECADOS-3 — a limpeza dos recados e das mensagens VENCIDOS (e dos contadores diários antigos), feita pelo worker.
 * Substitui o TTL do Firestore, que EXIGE o plano pago (billing): com o projeto no plano gratuito a publicação dos índices
 * falhava com "HTTP 403 — billing disabled". O worker já roda 24 h na VM; apagar de hora em hora não custa nada e mantém o
 * armazenamento pequeno mesmo se ninguém abrir o App. (A tela também apaga o que venceu ao abrir.)
 */
export const COLECOES_COM_VALIDADE = ['recados', 'recadosGrupo'] as const;
const TAMANHO_DO_LOTE = 200;
/** Teto por coleção e por rodada (5.000 documentos): a limpeza nunca fica presa num laço. */
const MAXIMO_DE_LOTES = 25;
const UM_DIA_MS = 86_400_000;

/** O dia mais antigo que ainda interessa ao limite diário: hoje e ontem (Brasília); antes disso, o contador pode ir embora. */
export function diaDeCorteDosContadores(agora: Date): string {
  return new Date(agora.getTime() - 3 * 3_600_000 - 2 * UM_DIA_MS).toISOString().slice(0, 10);
}

async function apagarEmLotes(db: Firestore, colecao: string, campo: string, operador: '<=' | '<', valor: unknown): Promise<number> {
  let apagados = 0;
  for (let rodada = 0; rodada < MAXIMO_DE_LOTES; rodada += 1) {
    const resultado = await db.collection(colecao).where(campo, operador, valor).limit(TAMANHO_DO_LOTE).get();
    if (resultado.empty) break;
    const lote = db.batch();
    for (const documento of resultado.docs) lote.delete(documento.ref);
    await lote.commit();
    apagados += resultado.size;
    if (resultado.size < TAMANHO_DO_LOTE) break;
  }
  return apagados;
}

/** Apaga o que venceu (`expiraEm` já passou) e os contadores diários com mais de 2 dias. Devolve quantos documentos foram apagados. */
export async function limparRecadosVencidos(db: Firestore, agora: Date = new Date()): Promise<number> {
  const limite = Timestamp.fromDate(agora);
  let total = 0;
  for (const colecao of COLECOES_COM_VALIDADE) total += await apagarEmLotes(db, colecao, 'expiraEm', '<=', limite);
  total += await apagarEmLotes(db, 'recadosLimite', 'dia', '<', diaDeCorteDosContadores(agora));
  return total;
}

/** Roda uma vez pouco depois de subir e depois de hora em hora. Devolve a função que para o agendador. */
export function iniciarLimpezaDeRecados({ db, intervaloMs = 60 * 60_000, atrasoInicialMs = 60_000 }: { db: Firestore; intervaloMs?: number; atrasoInicialMs?: number }): () => void {
  const rodar = () => {
    limparRecadosVencidos(db)
      .then((quantidade) => { if (quantidade > 0) console.info('recados vencidos apagados', { quantidade }); })
      .catch((erro) => console.error('falha na limpeza de recados vencidos', erro instanceof Error ? erro.message : String(erro)));
  };
  const inicial = setTimeout(rodar, atrasoInicialMs);
  const periodico = setInterval(rodar, intervaloMs);
  return () => { clearTimeout(inicial); clearInterval(periodico); };
}
