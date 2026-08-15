import { ShieldCheck, UserRound, X } from 'lucide-react';

import {
  rotuloDataLembretePorExtenso,
  rotuloHorarioLembrete,
  rotuloViraDia,
  type ItemLembreteAtribuido,
} from '@/lib/lembretesUi';
import { LembreteBadge } from './LembreteBadge';

/** Somente leitura — o funcionário nunca vê Editar/Excluir aqui (ver docs/spec/LEMBRETES.md, privacidade/autorização). */
export function LembreteAtribuidoDetalheModal({
  lembrete,
  onFechar,
}: {
  lembrete: ItemLembreteAtribuido;
  onFechar: () => void;
}) {
  const viraDia = rotuloViraDia(lembrete.horario);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal lembrete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lembrete-atribuido-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <h2 id="lembrete-atribuido-title">{lembrete.titulo}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="lembrete-atribuido-detalhe">
          <p>{rotuloDataLembretePorExtenso(lembrete.data)}</p>
          <p>
            <strong>{rotuloHorarioLembrete(lembrete.horario)}</strong>
            {viraDia ? ` · ${viraDia}` : ''}
          </p>
          <p className="lembrete-criado-por">
            <UserRound size={14} /> Criado por {lembrete.criadoPorNome}
          </p>
          {lembrete.descricao && (
            <p className="lembrete-descricao-detalhe">{lembrete.descricao}</p>
          )}
        </div>

        <div className="lembrete-atribuido-rodape">
          <LembreteBadge tipo="ATRIBUIDO" />
          <span className="read-only-badge">
            <ShieldCheck size={14} /> Somente leitura
          </span>
        </div>
      </section>
    </div>
  );
}
