import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, ShieldAlert, TriangleAlert, X } from 'lucide-react';

import type { TipoTurno, TurnosMes } from '@escala-ici/contrato';
import {
  conferirRegrasDaInversao, periodosSugeridos, planejarInversao, type PeriodoInversao,
} from '@/lib/inversaoEscalas';
import type { RegraEscala } from '@/lib/regrasEscala';

/**
 * INVERSAO-ESCALAS-1 — "Inverter escalas": duas pessoas combinaram de trocar (ex.: "já combinei com o Daniel, eu folgo no
 * Natal") e o coordenador troca tudo de uma vez, em vez de célula por célula. Escolhe as duas pessoas e o período (padrão: todo o
 * período; atalhos Natal e Ano Novo), vê a PRÉVIA dia a dia e a conferência das regras (o que a troca cria e o que resolve) antes
 * de confirmar. Nada é gravado aqui: aplicar só muda o rascunho; "Salvar alterações" continua sendo o que persiste.
 */
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;
const PERIODO_VAZIO: PeriodoInversao = { inicio: '', fim: '' };

function dataCurta(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function diaDaSemana(iso: string): string {
  return SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()] ?? '';
}

/** Texto claro sobre cor escura e escuro sobre cor clara (os turnos têm cores bem diferentes). */
function corDoTexto(hex: string): string {
  const limpo = /^#[0-9a-f]{6}$/iu.test(hex) ? hex.slice(1) : '64748b';
  const n = Number.parseInt(limpo, 16);
  const luminosidade = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luminosidade > 150 ? '#0f172a' : '#ffffff';
}

function Chip({ codigo, catalogo }: { codigo: string; catalogo: Record<string, TipoTurno> }) {
  const cor = catalogo[codigo]?.corHex ?? '#64748b';
  return <span className="inv-chip" style={{ background: cor, color: corDoTexto(cor) }}>{codigo}</span>;
}

export interface ParametrosInversao {
  loginA: string;
  loginB: string;
  periodo: PeriodoInversao;
}

export function InverterEscalasModal({ documentos, nomePorLogin, catalogo, regras, onFechar, onAplicar }: {
  documentos: readonly TurnosMes[];
  nomePorLogin: Record<string, string>;
  catalogo: Record<string, TipoTurno>;
  regras: readonly RegraEscala[];
  onFechar: () => void;
  onAplicar: (parametros: ParametrosInversao) => void;
}) {
  const pessoas = useMemo(
    () => documentos
      .map((documento) => ({ login: documento.login, nome: nomePorLogin[documento.login] ?? documento.login, turno: documento.turnoPadrao }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [documentos, nomePorLogin],
  );
  const [loginA, setLoginA] = useState('');
  const [loginB, setLoginB] = useState('');
  const [chavePeriodo, setChavePeriodo] = useState('tudo');
  const [personalizado, setPersonalizado] = useState<PeriodoInversao>({ inicio: '', fim: '' });

  const sugestoes = useMemo(() => periodosSugeridos(documentos, loginA, loginB), [documentos, loginA, loginB]);
  const periodo = useMemo<PeriodoInversao>(
    () => (chavePeriodo === 'personalizado'
      ? personalizado
      : (sugestoes.find((sugestao) => sugestao.chave === chavePeriodo) ?? sugestoes[0] ?? PERIODO_VAZIO)),
    [chavePeriodo, personalizado, sugestoes],
  );
  const chaveAtiva = chavePeriodo === 'personalizado' ? 'personalizado' : (sugestoes.find((s) => s.chave === chavePeriodo)?.chave ?? sugestoes[0]?.chave ?? '');

  const escolheuAsDuas = loginA !== '' && loginB !== '';
  const resultado = useMemo(
    () => (escolheuAsDuas ? planejarInversao(documentos, loginA, loginB, periodo, catalogo) : null),
    [escolheuAsDuas, documentos, loginA, loginB, periodo, catalogo],
  );
  const conferencia = useMemo(
    () => (resultado?.ok ? conferirRegrasDaInversao(documentos, resultado.plano, catalogo, regras, nomePorLogin) : null),
    [resultado, documentos, catalogo, regras, nomePorLogin],
  );

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => { if (evento.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const nomeA = pessoas.find((pessoa) => pessoa.login === loginA)?.nome ?? '';
  const nomeB = pessoas.find((pessoa) => pessoa.login === loginB)?.nome ?? '';
  const criaProblemas = (conferencia?.novos.length ?? 0) > 0;
  const plano = resultado?.ok ? resultado.plano : null;
  const erroNoRodape = resultado !== null && !resultado.ok ? resultado.erro : '';

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section className="edit-modal inv" role="dialog" aria-modal="true" aria-labelledby="inv-titulo" onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="inv-topo">
          <span className="inv-topo-icone" aria-hidden="true"><ArrowLeftRight size={20} /></span>
          <div>
            <h2 id="inv-titulo">Inverter escalas</h2>
            <p>Duas pessoas combinaram de trocar? Cada dia do período, uma fica com o que a outra tinha. Você confere antes de aplicar.</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="inv-corpo">
          <div className="inv-pessoas">
            <label className="inv-campo">
              <span>Pessoa 1</span>
              <select value={loginA} onChange={(evento) => setLoginA(evento.target.value)} autoFocus>
                <option value="">Escolha…</option>
                {pessoas.map((pessoa) => <option key={pessoa.login} value={pessoa.login} disabled={pessoa.login === loginB}>{pessoa.nome}</option>)}
              </select>
            </label>
            <span className="inv-seta" aria-hidden="true"><ArrowLeftRight size={18} /></span>
            <label className="inv-campo">
              <span>Pessoa 2</span>
              <select value={loginB} onChange={(evento) => setLoginB(evento.target.value)}>
                <option value="">Escolha…</option>
                {pessoas.map((pessoa) => <option key={pessoa.login} value={pessoa.login} disabled={pessoa.login === loginA}>{pessoa.nome}</option>)}
              </select>
            </label>
          </div>

          <div className="inv-periodo">
            <div className="inv-rotulo">Período</div>
            <div className="inv-atalhos" role="group" aria-label="Atalhos de período">
              {sugestoes.map((sugestao) => (
                <button
                  key={sugestao.chave}
                  type="button"
                  className="inv-atalho"
                  data-ativo={chaveAtiva === sugestao.chave ? '' : undefined}
                  aria-pressed={chaveAtiva === sugestao.chave}
                  onClick={() => setChavePeriodo(sugestao.chave)}
                >
                  {sugestao.rotulo}
                </button>
              ))}
            </div>
            <div className="inv-datas">
              <label className="inv-campo inv-campo-data">
                <span>De</span>
                <input type="date" value={periodo.inicio} onChange={(evento) => { setPersonalizado({ ...periodo, inicio: evento.target.value }); setChavePeriodo('personalizado'); }} />
              </label>
              <label className="inv-campo inv-campo-data">
                <span>Até</span>
                <input type="date" value={periodo.fim} onChange={(evento) => { setPersonalizado({ ...periodo, fim: evento.target.value }); setChavePeriodo('personalizado'); }} />
              </label>
            </div>
          </div>

          {!escolheuAsDuas && <p className="inv-dica">Escolha as duas pessoas para ver o que muda.</p>}

          {plano !== null && (
            <>
              <div className="inv-resumo" role="status">
                <strong>{plano.trocados.length === 1 ? '1 dia muda' : `${plano.trocados.length} dias mudam`}</strong>
                {plano.iguais > 0 && <span>{plano.iguais === 1 ? '1 dia já era igual' : `${plano.iguais} dias já eram iguais`}</span>}
                {plano.semDados.length > 0 && <span>{plano.semDados.length} sem escala em uma das duas (ficam como estão)</span>}
                {plano.trocouTurnoPadrao && <span>o turno-base também troca</span>}
              </div>

              <div className="inv-previa" tabIndex={0} aria-label="Prévia dos dias que mudam">
                <table>
                  <thead>
                    <tr><th scope="col">Dia</th><th scope="col">{nomeA}</th><th scope="col">{nomeB}</th></tr>
                  </thead>
                  <tbody>
                    {plano.trocados.map((troca) => (
                      <tr key={troca.data}>
                        <th scope="row"><b>{dataCurta(troca.data)}</b> <small>{diaDaSemana(troca.data)}</small></th>
                        <td><Chip codigo={troca.deA.c} catalogo={catalogo} /><span className="inv-para" aria-label="passa a">→</span><Chip codigo={troca.deB.c} catalogo={catalogo} /></td>
                        <td><Chip codigo={troca.deB.c} catalogo={catalogo} /><span className="inv-para" aria-label="passa a">→</span><Chip codigo={troca.deA.c} catalogo={catalogo} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {conferencia !== null && !criaProblemas && (
                <p className="inv-regras inv-regras-ok" role="status">
                  <CheckCircle2 size={16} aria-hidden="true" /> Nenhum problema novo nas regras para {nomeA} e {nomeB}.
                  {conferencia.resolvidos.length > 0 && ` Resolve ${conferencia.resolvidos.length === 1 ? '1 problema' : `${conferencia.resolvidos.length} problemas`} que já existia${conferencia.resolvidos.length === 1 ? '' : 'm'}.`}
                </p>
              )}
              {conferencia !== null && criaProblemas && (
                <div className="inv-regras inv-regras-problema" role="alert">
                  <p><TriangleAlert size={16} aria-hidden="true" /> {conferencia.novos.length === 1 ? 'Esta inversão cria 1 problema:' : `Esta inversão cria ${conferencia.novos.length} problemas:`}</p>
                  <ul className="alteracao-problemas-lista">
                    {conferencia.novos.map((alerta) => (
                      <li key={alerta.chave} data-gravidade={alerta.gravidade}>
                        <strong>{alerta.mensagem}</strong>
                        <small>{alerta.regraNome} · dia {dataCurta(alerta.data)}</small>
                      </li>
                    ))}
                  </ul>
                  {conferencia.resolvidos.length > 0 && (
                    <p className="alteracao-problemas-resolve"><CheckCircle2 size={15} aria-hidden="true" /> Também resolve {conferencia.resolvidos.length === 1 ? '1 problema' : `${conferencia.resolvidos.length} problemas`} que já existia{conferencia.resolvidos.length === 1 ? '' : 'm'}.</p>
                  )}
                  {conferencia.novos.some((alerta) => alerta.bloqueiaPublicacao) && (
                    <p className="alteracao-problemas-bloqueia"><ShieldAlert size={15} aria-hidden="true" /> Pelo menos uma destas regras impede a publicação enquanto não for resolvida.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="inv-rodape">
          <p className="inv-erro" role="alert">{erroNoRodape}</p>
          <button type="button" className="secondary-button" onClick={onFechar}>Cancelar</button>
          <button
            type="button"
            className="primary-button"
            disabled={plano === null}
            data-alerta={criaProblemas ? '' : undefined}
            onClick={() => { if (plano !== null) onAplicar({ loginA, loginB, periodo }); }}
          >
            <ArrowLeftRight size={15} aria-hidden="true" /> {criaProblemas ? 'Inverter mesmo assim' : 'Inverter'}
          </button>
        </footer>
      </section>
    </div>
  );
}
