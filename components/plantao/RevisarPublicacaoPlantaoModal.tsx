import { ROTULO_FUNCAO_PLANTAO, type FuncaoPlantao } from '@escala-ici/contrato';
import { AlertTriangle, CheckCircle2, Link2, Radio, X, XCircle } from 'lucide-react';

import { useTeclaEsc } from '@/lib/hooks/useTeclaEsc';
import type { ResultadoSaudePlantao, SaudeFuncaoPlantao } from '@/lib/plantaoMultiposto';

/**
 * FASE-PLANTAO-MULTIPOSTO-FECHAMENTO-UX-1 (§21-24 da fase) — "Revisar
 * publicação". `avaliarSaudePlantao()` é a ÚNICA fonte de verdade: este
 * componente nunca recalcula erro/status, só apresenta o que já veio
 * pronto e navega (`onNavegarParaFuncao`) para o contexto certo quando o
 * coordenador clica uma linha problemática. Genérico por construção —
 * nunca acoplado a CODB, funciona para qualquer Grupo multi-função via
 * `funcoesEsperadas`.
 */
export interface RevisarPublicacaoPlantaoModalProps {
  nomeGrupo: string;
  competenciaRotulo: string;
  saude: ResultadoSaudePlantao;
  funcoesEsperadas: readonly FuncaoPlantao[];
  onFechar: () => void;
  /** Clique numa linha de posto problemática — decide navegar para Calendário (posto faltando/conflito) ou Vínculos (pendência). */
  onNavegarParaFuncao: (funcao: FuncaoPlantao, destino: 'calendario' | 'vinculos') => void;
}

function IconeStatus({ status }: { status: SaudeFuncaoPlantao['status'] }) {
  if (status === 'OK') return <CheckCircle2 size={16} className="plantao-revisao-icone-ok" />;
  if (status === 'ATENCAO') return <AlertTriangle size={16} className="plantao-revisao-icone-atencao" />;
  return <XCircle size={16} className="plantao-revisao-icone-critico" />;
}

function destinoDoProblema(saude: SaudeFuncaoPlantao): 'calendario' | 'vinculos' {
  // Vínculo pendente prioriza a aba Vínculos; qualquer outro bloqueio (posto faltando, conflito, erro de origem) prioriza o Calendário.
  if (saude.vinculosPendentes > 0 && saude.postosFaltando === 0 && saude.conflitos === 0 && saude.errosOrigem === 0) {
    return 'vinculos';
  }
  return 'calendario';
}

function descreverProblemas(saude: SaudeFuncaoPlantao): string[] {
  const problemas: string[] = [];
  if (saude.postosFaltando > 0) problemas.push(`${saude.postosFaltando} posto(s) sem plantonista`);
  if (saude.vinculosPendentes > 0) problemas.push(`${saude.vinculosPendentes} vínculo(s) pendente(s)`);
  if (saude.conflitos > 0) problemas.push(`${saude.conflitos} conflito(s) de horário`);
  if (saude.errosOrigem > 0) problemas.push(`${saude.errosOrigem} erro(s) de origem`);
  if (saude.atribuicoesSemFuncao > 0) problemas.push(`${saude.atribuicoesSemFuncao} atribuição(ões) sem posto definido`);
  return problemas;
}

export function RevisarPublicacaoPlantaoModal({
  nomeGrupo,
  competenciaRotulo,
  saude,
  funcoesEsperadas,
  onFechar,
  onNavegarParaFuncao,
}: RevisarPublicacaoPlantaoModalProps) {
  useTeclaEsc(onFechar);
  const problemasGerais = descreverProblemas(saude.todos);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal plantao-revisao-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="revisar-publicacao-plantao-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">Revisar publicação</p>
            <h2 id="revisar-publicacao-plantao-title">{nomeGrupo}</h2>
            <p>{competenciaRotulo}</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="import-summary plantao-resumo-grid">
          <div><span>Ocorrências</span><strong>{saude.todos.ocorrencias}</strong></div>
          <div><span>Atribuições</span><strong>{saude.todos.atribuicoes}</strong></div>
          <div><span>Pessoas</span><strong>{saude.todos.pessoasUnicas}</strong></div>
        </div>

        <div className={`status-badge plantao-revisao-status-geral ${saude.podePublicar ? 'success' : 'danger'}`}>
          <IconeStatus status={saude.podePublicar ? 'OK' : 'CRITICO'} />
          {saude.podePublicar ? 'Pronto para publicação' : 'Existem problemas que precisam ser corrigidos'}
        </div>
        {!saude.podePublicar && problemasGerais.length > 0 && (
          <ul className="warning-list">
            {problemasGerais.map((problema) => <li key={problema}>⚠ {problema}</li>)}
          </ul>
        )}

        <h3 className="plantao-revisao-subtitulo">Por posto</h3>
        <ul className="plantao-revisao-lista">
          {funcoesEsperadas.map((funcao) => {
            const saudeFuncao = saude.porFuncao[funcao];
            if (saudeFuncao === undefined) {
              return null;
            }
            const problemas = descreverProblemas(saudeFuncao);
            const destino = destinoDoProblema(saudeFuncao);
            return (
              <li key={funcao}>
                <button
                  type="button"
                  className={`plantao-revisao-linha ${saudeFuncao.status.toLowerCase()}`}
                  onClick={() => onNavegarParaFuncao(funcao, destino)}
                >
                  <span className="plantao-revisao-linha-titulo">
                    <Radio size={14} /> {ROTULO_FUNCAO_PLANTAO[funcao]}
                  </span>
                  <span className="plantao-revisao-linha-status">
                    <IconeStatus status={saudeFuncao.status} />
                    {problemas.length === 0
                      ? `Pronto · ${saudeFuncao.atribuicoes} atribuições · ${saudeFuncao.pessoasUnicas} pessoas`
                      : problemas.join(' · ')}
                  </span>
                  {problemas.length > 0 && <Link2 size={14} className="plantao-revisao-linha-acao" />}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="rollback-actions plantao-d-modal-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Fechar</button>
        </div>
      </section>
    </div>
  );
}
