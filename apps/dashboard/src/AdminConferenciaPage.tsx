import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, LoaderCircle, Wrench } from 'lucide-react';

import type { AcaoConferencia, ProblemaConferencia } from '@/lib/conferenciaAdministracao';

/**
 * ADMIN-CONFERENCIA-1 — Administração › Conferência: o que está
 * inconsistente, do mais grave ao menos grave, cada um com a correção.
 */
export function AdminConferenciaPage({ problemas, subnav, onAcao }: {
  problemas: readonly ProblemaConferencia[];
  subnav: ReactNode;
  onAcao: (acao: AcaoConferencia) => Promise<void> | void;
}) {
  const [executando, setExecutando] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  async function executar(problema: ProblemaConferencia) {
    setErro('');
    setExecutando(problema.chave);
    try {
      await onAcao(problema.acao);
    } catch (falha) {
      const texto = falha instanceof Error ? falha.message : '';
      setErro(/permission|insufficient/iu.test(texto) ? 'Sem permissão para esta correção.' : texto || 'Não foi possível corrigir agora.');
    } finally {
      setExecutando(null);
    }
  }
  const graves = problemas.filter((item) => item.gravidade === 'alta').length;
  return (
    <section className="admin-equipes">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Conferência</h1>
          <p>O que está inconsistente nas equipes, Plantões e responsáveis — com a correção ao lado.</p>
        </div>
      </header>
      {subnav}
      {erro && <div className="alert error" role="alert">{erro}</div>}
      {problemas.length === 0 ? (
        <div className="trocas-vazio panel">
          <CheckCircle2 size={28} aria-hidden="true" />
          <strong>Tudo em ordem</strong>
          <small>Todas as equipes e Plantões têm responsável, e os vínculos apontam para cadastros que existem.</small>
        </div>
      ) : (
        <>
          <p className="conferencia-resumo">
            <AlertTriangle size={16} aria-hidden="true" />
            {problemas.length === 1 ? '1 ponto para ajustar' : `${problemas.length} pontos para ajustar`}
            {graves > 0 && <span> · {graves} {graves === 1 ? 'importante' : 'importantes'}</span>}
          </p>
          <ul className="conferencia-lista">
            {problemas.map((problema) => (
              <li key={problema.chave} data-gravidade={problema.gravidade}>
                <span className="conferencia-icone" aria-hidden="true">{problema.gravidade === 'alta' ? <AlertTriangle size={17} /> : <Info size={17} />}</span>
                <span className="conferencia-texto">
                  <strong>{problema.titulo}</strong>
                  <small>{problema.detalhe}</small>
                </span>
                <button type="button" className={problema.acao.tipo === 'IR' ? 'secondary-button compact-button' : 'primary-button compact-button'}
                  disabled={executando !== null} onClick={() => void executar(problema)}>
                  {executando === problema.chave ? <LoaderCircle className="spin" size={14} aria-hidden="true" />
                    : problema.acao.tipo === 'IR' ? null : <Wrench size={14} aria-hidden="true" />}
                  {problema.rotuloAcao}
                  {problema.acao.tipo === 'IR' && <ChevronRight size={14} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
