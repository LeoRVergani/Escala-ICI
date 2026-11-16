import { ICONE_INFORMACAO } from '@/components/iconesInformacao';
import { cobreDia, descricaoHorario, formatarDiaMes, metaDoTipo, rotuloDiaRelativo, tituloExibicao, type InformacaoDia } from '@/lib/informacoesDia';
import { ClipboardList } from 'lucide-react';

/**
 * INFORMACOES-DIA-1 — "Para você": o que a liderança registrou e liberou para o colaborador ver
 * (curso, afastamento por horário, atestado…). Só aparece quando há algo; some quando a data passa.
 */
const LIMITE_VISIVEIS = 5;

function quando(informacao: InformacaoDia, hoje: string): string {
  const periodo = informacao.dataInicio !== informacao.dataFim;
  if (cobreDia(informacao, hoje)) return periodo ? `Hoje · até ${formatarDiaMes(informacao.dataFim)}` : 'Hoje';
  return periodo ? `${rotuloDiaRelativo(informacao.dataInicio, hoje)} · até ${formatarDiaMes(informacao.dataFim)}` : rotuloDiaRelativo(informacao.dataInicio, hoje);
}

export function InformacoesParaVoce({ informacoes, hoje }: { informacoes: readonly InformacaoDia[]; hoje: string }) {
  if (informacoes.length === 0) return null;
  const visiveis = informacoes.slice(0, LIMITE_VISIVEIS);
  return (
    <section className="info-app" aria-label="Informações da liderança para você">
      <header>
        <span className="info-app-cabecalho-icone" aria-hidden="true"><ClipboardList size={18} /></span>
        <div><h2>Para você</h2><small>Registrado pela sua liderança</small></div>
      </header>
      <ul>
        {visiveis.map((informacao) => {
          const meta = metaDoTipo(informacao.tipo);
          const Icone = ICONE_INFORMACAO[meta.icone];
          return (
            <li key={informacao.id} data-cor={meta.cor} data-hoje={cobreDia(informacao, hoje) ? '' : undefined}>
              <span className="info-app-icone" aria-hidden="true"><Icone size={17} /></span>
              <span className="info-app-texto">
                <strong>{tituloExibicao(informacao)}</strong>
                <small>{meta.rotulo} · {descricaoHorario(informacao)}</small>
                {informacao.observacao && <em>{informacao.observacao}</em>}
              </span>
              <span className="info-app-quando">{quando(informacao, hoje)}</span>
            </li>
          );
        })}
      </ul>
      {informacoes.length > LIMITE_VISIVEIS && <p className="info-app-mais">e mais {informacoes.length - LIMITE_VISIVEIS}</p>}
    </section>
  );
}
