import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Crosshair, ShieldAlert } from 'lucide-react';

import { agruparProblemasPorPessoa, ROTULO_GRAVIDADE, type AlertaRegra, type GravidadeRegra } from '@/lib/regrasEscala';

/**
 * REGRAS-ESCALA-2 — "Problemas desta escala": tudo o que as regras apontam,
 * por pessoa, em ordem de data, cada um com o motivo escrito e o botão que
 * leva até o dia na grade.
 */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/u);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes.at(-1)?.[0] ?? '' : '')).toUpperCase();
}

function dataCurta(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

const GRAVIDADES: readonly GravidadeRegra[] = ['CRITICO', 'AVISO', 'INFO'];

export function PainelProblemasEscala({ alertas, nomePorLogin, onVerNaEscala }: {
  alertas: readonly AlertaRegra[];
  nomePorLogin: Readonly<Record<string, string>>;
  onVerNaEscala: (alerta: AlertaRegra) => void;
}) {
  const [aberto, setAberto] = useState(true);
  const grupos = agruparProblemasPorPessoa(alertas);
  const porGravidade = GRAVIDADES.map((gravidade) => [gravidade, alertas.filter((alerta) => alerta.gravidade === gravidade).length] as const).filter(([, total]) => total > 0);
  const bloqueiam = alertas.filter((alerta) => alerta.bloqueiaPublicacao).length;

  if (alertas.length === 0) {
    return (
      <section className="problemas-escala problemas-escala-ok" aria-label="Problemas desta escala">
        <CheckCircle2 size={18} aria-hidden="true" />
        <span><strong>Nenhum problema nas regras da escala.</strong> Ninguém descumpre os limites de dias seguidos e de descanso.</span>
      </section>
    );
  }

  return (
    <section className="problemas-escala" aria-label="Problemas desta escala">
      <header className="problemas-escala-cabecalho">
        <span className="problemas-escala-icone"><AlertTriangle size={18} aria-hidden="true" /></span>
        <div>
          <h2>Problemas desta escala <span className="problemas-escala-total">{alertas.length}</span></h2>
          <p>
            {porGravidade.map(([gravidade, total]) => (
              <span key={gravidade} className="problemas-escala-chip" data-gravidade={gravidade}>{total} {ROTULO_GRAVIDADE[gravidade].toLowerCase()}</span>
            ))}
            {bloqueiam > 0 && <span className="problemas-escala-chip" data-gravidade="BLOQUEIA"><ShieldAlert size={12} aria-hidden="true" /> {bloqueiam} impede{bloqueiam === 1 ? '' : 'm'} publicar</span>}
          </p>
        </div>
        <button type="button" className="icon-button" aria-expanded={aberto} aria-label={aberto ? 'Recolher os problemas' : 'Mostrar os problemas'} onClick={() => setAberto((valor) => !valor)}>
          {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </header>
      {aberto && (
        <div className="problemas-escala-corpo">
          {grupos.map((grupo) => {
            const nome = nomePorLogin[grupo.login] ?? grupo.login;
            return (
              <div key={grupo.login} className="problemas-escala-pessoa">
                <div className="problemas-escala-pessoa-titulo">
                  <span className="problemas-escala-avatar" aria-hidden="true">{iniciais(nome)}</span>
                  <strong>{nome}</strong>
                  <small>{grupo.alertas.length} {grupo.alertas.length === 1 ? 'problema' : 'problemas'}</small>
                </div>
                <ul>
                  {grupo.alertas.map((alerta) => (
                    <li key={alerta.chave} data-gravidade={alerta.gravidade}>
                      <span className="problemas-escala-dia">{dataCurta(alerta.data)}</span>
                      <span className="problemas-escala-texto">
                        <strong>{alerta.mensagem}</strong>
                        <small>{alerta.regraNome}</small>
                      </span>
                      <button type="button" className="secondary-button compact-button" onClick={() => onVerNaEscala(alerta)}>
                        <Crosshair size={13} aria-hidden="true" /> Ver na escala
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
