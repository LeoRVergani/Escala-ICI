import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Radio, Users, X } from 'lucide-react';
import { codigoPeriodoDia, formatarData, type TipoTurno, type TurnosMes } from '@escala-ici/contrato';

import type { AtribuicaoPlantaoPersistida, GrupoPlantao } from '@escala-ici/contrato';
import {
  intervaloPlantaoCivil,
  nomeExibicaoPlantonista,
  resolverPlantaoAgora,
  rotuloGrupoPlantao,
  tituloPeriodoPlantao,
} from './plantaoApp';
import {
  deslocarDias,
  PERIODOS_JORNADA,
  resumirEquipeNoDia,
  resumirMesDaPessoa,
  semanaDaData,
} from './visaoCoordenador';

/**
 * VISAO-COORDENADOR-APP-1 — o coordenador enxerga no App as equipes que
 * administra (6x1) e os Plantões que administra. Somente leitura: montar e
 * editar escala continua no Dashboard.
 */
export interface EquipeJornadaVisao {
  id: string;
  nome: string;
  documentos: TurnosMes[];
  nomes: ReadonlyMap<string, string>;
}

export interface PlantaoVisao {
  grupo: GrupoPlantao;
  atribuicoes: AtribuicaoPlantaoPersistida[];
}

const NOMES_PERIODO: Record<string, string> = { MD: 'Madrugada', M: 'Manhã', T: 'Tarde', N: 'Noite' };

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/u)[0] ?? nome;
}

function diaCurto(data: string): string {
  const texto = formatarData(data, { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Card da tela Hoje: um resumo do dia por equipe e por Plantão. */
export function PainelHojeEquipes({
  equipes,
  plantoes,
  dataHoje,
  agoraIso,
  catalogo,
  onAbrir,
}: {
  equipes: readonly EquipeJornadaVisao[];
  plantoes: readonly PlantaoVisao[];
  dataHoje: string;
  agoraIso: string;
  catalogo: Record<string, TipoTurno>;
  onAbrir: () => void;
}) {
  if (equipes.length === 0 && plantoes.length === 0) {
    return null;
  }
  return (
    <article className="panel visao-coord-hoje">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Coordenação</p>
          <h2>Hoje nas suas equipes</h2>
        </div>
        <button className="secondary-button compact-button" type="button" onClick={onAbrir}>
          Ver equipes <ChevronRight size={15} />
        </button>
      </div>
      <div className="visao-coord-hoje-grade">
        {equipes.map((equipe) => {
          const resumo = resumirEquipeNoDia(equipe.documentos, dataHoje, catalogo, equipe.nomes);
          return (
            <section key={equipe.id} className="visao-coord-cartao">
              <header>
                <CalendarDays size={16} aria-hidden="true" />
                <strong>{equipe.nome}</strong>
                <small>6x1</small>
              </header>
              {equipe.documentos.length === 0 ? (
                <p className="empty-inline">Sem escala publicada neste mês.</p>
              ) : (
                <>
                  <ul className="visao-coord-turnos">
                    {PERIODOS_JORNADA.map((periodo) => {
                      const pessoas = resumo.porPeriodo[periodo];
                      const descoberto = resumo.descobertos.includes(periodo);
                      if (pessoas.length === 0 && !descoberto) return null;
                      return (
                        <li key={periodo} data-descoberto={descoberto ? '' : undefined}>
                          <span className="shift-chip" data-code={periodo}>{periodo}</span>
                          <span>
                            <strong>{NOMES_PERIODO[periodo]} · {pessoas.length}</strong>
                            <small>{descoberto ? 'Turno descoberto hoje' : pessoas.map((pessoa) => primeiroNome(pessoa.nome)).join(', ')}</small>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {resumo.folga.length > 0 && (
                    <p className="visao-coord-folgas"><strong>Folga:</strong> {resumo.folga.map((pessoa) => primeiroNome(pessoa.nome)).join(', ')}</p>
                  )}
                  {resumo.ausentes.length > 0 && (
                    <p className="visao-coord-folgas"><strong>Ausentes:</strong> {resumo.ausentes.map((pessoa) => `${primeiroNome(pessoa.nome)} (${pessoa.codigo})`).join(', ')}</p>
                  )}
                </>
              )}
            </section>
          );
        })}
        {plantoes.map(({ grupo, atribuicoes }) => {
          const { atual, proximo } = resolverPlantaoAgora(atribuicoes, agoraIso);
          return (
            <section key={grupo.grupoId} className="visao-coord-cartao">
              <header>
                <Radio size={16} aria-hidden="true" />
                <strong>{rotuloGrupoPlantao(grupo.nome)}</strong>
                <small>Plantão</small>
              </header>
              {atribuicoes.length === 0 ? (
                <p className="empty-inline">Sem plantão publicado para hoje.</p>
              ) : (
                <ul className="visao-coord-turnos">
                  <li>
                    <span className="visao-coord-selo" data-tipo="agora">Agora</span>
                    <span>
                      <strong>{atual ? nomeExibicaoPlantonista(atual.plantonistaLogin, []) : 'Ninguém de plantão'}</strong>
                      {atual && <small>{tituloPeriodoPlantao(intervaloPlantaoCivil(atual, grupo.timezone))}</small>}
                    </span>
                  </li>
                  {proximo && (
                    <li>
                      <span className="visao-coord-selo">Próximo</span>
                      <span>
                        <strong>{nomeExibicaoPlantonista(proximo.plantonistaLogin, [])}</strong>
                        <small>{tituloPeriodoPlantao(intervaloPlantaoCivil(proximo, grupo.timezone))}</small>
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </article>
  );
}

/** Aba Equipe: uma aba por equipe 6x1 e por Plantão administrado. */
export function VisaoEquipesCoordenador({
  equipes,
  plantoes,
  dataHoje,
  catalogo,
}: {
  equipes: readonly EquipeJornadaVisao[];
  plantoes: readonly PlantaoVisao[];
  dataHoje: string;
  catalogo: Record<string, TipoTurno>;
}) {
  const abas = [
    ...equipes.map((equipe) => ({ chave: `J:${equipe.id}`, nome: equipe.nome, tipo: '6x1' as const })),
    ...plantoes.map((item) => ({ chave: `P:${item.grupo.grupoId}`, nome: rotuloGrupoPlantao(item.grupo.nome), tipo: 'Plantão' as const })),
  ];
  const [abaSelecionada, setAbaSelecionada] = useState<string>('');
  const [inicioSemana, setInicioSemana] = useState(() => semanaDaData(dataHoje)[0] ?? dataHoje);
  const [pessoaAberta, setPessoaAberta] = useState<{ documento: TurnosMes; nome: string } | null>(null);
  const aba = abas.find((item) => item.chave === abaSelecionada) ?? abas[0];
  if (aba === undefined) {
    return null;
  }
  const equipe = aba.chave.startsWith('J:') ? equipes.find((item) => `J:${item.id}` === aba.chave) : undefined;
  const plantao = aba.chave.startsWith('P:') ? plantoes.find((item) => `P:${item.grupo.grupoId}` === aba.chave) : undefined;
  const semana = semanaDaData(inicioSemana);

  return (
    <article className="panel visao-coord-equipes">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Coordenação</p>
          <h2>Suas equipes</h2>
          <p>Consulta das escalas que você administra. Para alterar, use o Dashboard.</p>
        </div>
      </div>

      {abas.length > 1 && (
        <div className="visao-coord-abas" role="tablist" aria-label="Equipes e Plantões">
          {abas.map((item) => (
            <button
              key={item.chave}
              type="button"
              role="tab"
              aria-selected={item.chave === aba.chave}
              className={item.chave === aba.chave ? 'active' : ''}
              onClick={() => setAbaSelecionada(item.chave)}
            >
              {item.tipo === 'Plantão' ? <Radio size={14} aria-hidden="true" /> : <Users size={14} aria-hidden="true" />}
              <span>{item.nome}</span>
              <small>{item.tipo}</small>
            </button>
          ))}
        </div>
      )}

      {equipe !== undefined && (
        <>
          <div className="visao-coord-semana-nav">
            <button className="icon-button" type="button" onClick={() => setInicioSemana(deslocarDias(inicioSemana, -7))} aria-label="Semana anterior">
              <ChevronLeft size={16} />
            </button>
            <strong>{diaCurto(semana[0] ?? inicioSemana)} a {diaCurto(semana[6] ?? inicioSemana)}</strong>
            <button className="icon-button" type="button" onClick={() => setInicioSemana(deslocarDias(inicioSemana, 7))} aria-label="Próxima semana">
              <ChevronRight size={16} />
            </button>
          </div>
          {equipe.documentos.length === 0 ? (
            <p className="empty-inline">Sem escala publicada para {equipe.nome} neste mês.</p>
          ) : (
            <div className="visao-coord-tabela-rolagem">
              <table className="visao-coord-tabela">
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    {semana.map((data) => (
                      <th key={data} data-hoje={data === dataHoje ? '' : undefined}>{diaCurto(data)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...equipe.documentos]
                    .sort((a, b) => (equipe.nomes.get(a.login) ?? a.login).localeCompare(equipe.nomes.get(b.login) ?? b.login))
                    .map((documento) => {
                      const nome = equipe.nomes.get(documento.login) ?? documento.login;
                      return (
                        <tr key={documento.login}>
                          <th scope="row">
                            <button type="button" className="link-button" onClick={() => setPessoaAberta({ documento, nome })}>
                              {nome}
                            </button>
                          </th>
                          {semana.map((data) => {
                            const dia = documento.dias[data];
                            const periodo = codigoPeriodoDia(dia);
                            return (
                              <td key={data} data-hoje={data === dataHoje ? '' : undefined}>
                                {periodo ? (
                                  <span className="shift-chip" data-code={periodo} data-hora-extra={dia?.t !== undefined ? '' : undefined} title={catalogo[dia?.c ?? '']?.descricao}>
                                    {periodo}
                                    {dia?.t !== undefined && <span className="shift-chip-he" aria-hidden="true">HE</span>}
                                  </span>
                                ) : <span className="visao-coord-vazio">·</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {plantao !== undefined && (
        <ul className="visao-coord-plantoes">
          {[...plantao.atribuicoes]
            .filter((atribuicao) => atribuicao.fim.slice(0, 10) >= dataHoje)
            .sort((a, b) => a.inicio.localeCompare(b.inicio))
            .slice(0, 21)
            .map((atribuicao) => {
              const intervalo = intervaloPlantaoCivil(atribuicao, plantao.grupo.timezone);
              return (
                <li key={`${atribuicao.plantonistaLogin}-${atribuicao.inicio}`}>
                  <strong>{nomeExibicaoPlantonista(atribuicao.plantonistaLogin, [])}</strong>
                  <small>{tituloPeriodoPlantao(intervalo)}</small>
                </li>
              );
            })}
          {plantao.atribuicoes.length === 0 && <li className="empty-inline">Sem plantão publicado neste período.</li>}
        </ul>
      )}

      {pessoaAberta && (
        <ModalMesDaPessoa
          documento={pessoaAberta.documento}
          nome={pessoaAberta.nome}
          catalogo={catalogo}
          onFechar={() => setPessoaAberta(null)}
        />
      )}
    </article>
  );
}

function ModalMesDaPessoa({
  documento,
  nome,
  catalogo,
  onFechar,
}: {
  documento: TurnosMes;
  nome: string;
  catalogo: Record<string, TipoTurno>;
  onFechar: () => void;
}) {
  const datas = Object.keys(documento.dias).sort();
  const deslocamento = datas.length === 0 ? 0 : new Date(`${datas[0]}T12:00:00Z`).getUTCDay();
  const resumo = resumirMesDaPessoa(documento, catalogo);
  const horas = `${Math.floor(resumo.minutos / 60)}:${String(resumo.minutos % 60).padStart(2, '0')}`;
  return (
    <div className="modal-backdrop modal-backdrop-sheet" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal visao-coord-mes"
        role="dialog"
        aria-modal="true"
        aria-labelledby="visao-coord-mes-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">Escala do mês</p>
            <h2 id="visao-coord-mes-title">{nome}</h2>
            <p>{documento.login}</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="visao-coord-mes-grade">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => <span key={dia} className="visao-coord-mes-cabecalho">{dia}</span>)}
          {Array.from({ length: deslocamento }, (_, indice) => <span key={`vazio-${indice}`} aria-hidden="true" />)}
          {datas.map((data) => {
            const dia = documento.dias[data];
            const periodo = codigoPeriodoDia(dia);
            return (
              <div key={data} className="visao-coord-mes-dia" title={catalogo[dia?.c ?? '']?.descricao}>
                <small>{data.slice(8, 10)}</small>
                {periodo ? (
                  <span className="shift-chip" data-code={periodo} data-hora-extra={dia?.t !== undefined ? '' : undefined}>
                    {periodo}
                  </span>
                ) : <span className="visao-coord-vazio">·</span>}
              </div>
            );
          })}
        </div>
        <dl className="visao-coord-mes-resumo">
          <div><dt>Dias trabalhados</dt><dd>{resumo.diasTrabalhados}</dd></div>
          <div><dt>Horas</dt><dd>{horas}</dd></div>
          <div><dt>Folgas sábado</dt><dd>{resumo.folgasSabado}</dd></div>
          <div><dt>Folgas dia de semana</dt><dd>{resumo.folgasSemana}</dd></div>
          <div><dt>Folgas domingo</dt><dd>{resumo.folgasDomingo}</dd></div>
          {resumo.folgasFeriado > 0 && <div><dt>Folga feriado</dt><dd>{resumo.folgasFeriado}</dd></div>}
          {resumo.horasExtras > 0 && <div><dt>Hora extra</dt><dd>{resumo.horasExtras}</dd></div>}
        </dl>
      </section>
    </div>
  );
}
