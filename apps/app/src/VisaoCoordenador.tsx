import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Radio, Users, X } from 'lucide-react';
import { codigoPeriodoDia, formatarData, type TipoTurno, type TurnosMes } from '@escala-ici/contrato';

import type { AtribuicaoPlantaoPersistida, GrupoPlantao, ParticipantePlantao } from '@escala-ici/contrato';
import {
  intervaloPlantaoCivil,
  nomeExibicaoPlantonista,
  resolverPlantaoAgora,
  rotuloGrupoPlantao,
  tituloPeriodoPlantao,
} from './plantaoApp';
import {
  deslocarDias,
  formatarHorasMinutos,
  PERIODOS_JORNADA,
  resumirEquipeNoDia,
  resumirMesDaPessoa,
  resumirPlantonistas,
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
  participantes: ParticipantePlantao[];
  periodo: { inicio: string; fim: string } | null;
}

export interface DiagnosticoVisao {
  estado: 'carregando' | 'pronto';
  falhas: string[];
}

/** VISAO-COORDENADOR-APP-2 — o que mostrar quando ainda não há equipe para exibir. */
function EstadoVazioCoordenacao({ diagnostico }: { diagnostico?: DiagnosticoVisao }) {
  if (diagnostico?.estado === 'carregando') {
    return <p className="empty-inline" role="status">Carregando suas equipes…</p>;
  }
  return (
    <div className="visao-coord-diagnostico" role="status">
      <strong>Não encontramos equipes que você administra.</strong>
      <small>Confira no Dashboard, em Administração → Responsáveis por escala, se você está como responsável.</small>
      {diagnostico && diagnostico.falhas.length > 0 && (
        <ul>{diagnostico.falhas.map((falha) => <li key={falha}>{falha}</li>)}</ul>
      )}
    </div>
  );
}

function AvisoFalhas({ diagnostico }: { diagnostico?: DiagnosticoVisao }) {
  if (!diagnostico || diagnostico.falhas.length === 0) return null;
  return (
    <div className="visao-coord-diagnostico" role="status">
      <strong>Parte das informações não carregou:</strong>
      <ul>{diagnostico.falhas.map((falha) => <li key={falha}>{falha}</li>)}</ul>
    </div>
  );
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
  diagnostico,
}: {
  equipes: readonly EquipeJornadaVisao[];
  plantoes: readonly PlantaoVisao[];
  dataHoje: string;
  agoraIso: string;
  catalogo: Record<string, TipoTurno>;
  onAbrir: () => void;
  diagnostico?: DiagnosticoVisao;
}) {
  if (equipes.length === 0 && plantoes.length === 0) {
    return (
      <article className="panel visao-coord-hoje">
        <div className="panel-title"><div><p className="eyebrow">Coordenação</p><h2>Hoje nas suas equipes</h2></div></div>
        <div className="visao-coord-hoje-grade"><EstadoVazioCoordenacao diagnostico={diagnostico} /></div>
      </article>
    );
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
      <AvisoFalhas diagnostico={diagnostico} />
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
type Visualizacao6x1 = 'mes' | 'semana' | 'totais';
type VisualizacaoPlantao = 'calendario' | 'lista' | 'totais';

export function VisaoEquipesCoordenador({
  equipes,
  plantoes,
  dataHoje,
  catalogo,
  diagnostico,
  renderizarMes6x1,
  renderizarCalendarioPlantao,
}: {
  equipes: readonly EquipeJornadaVisao[];
  plantoes: readonly PlantaoVisao[];
  dataHoje: string;
  catalogo: Record<string, TipoTurno>;
  diagnostico?: DiagnosticoVisao;
  /** VISAO-COORDENADOR-APP-4 — o mesmo calendário completo que o colaborador vê. */
  renderizarMes6x1?: (equipe: EquipeJornadaVisao) => ReactNode;
  renderizarCalendarioPlantao?: (plantao: PlantaoVisao) => ReactNode;
}) {
  const abas = [
    ...equipes.map((equipe) => ({ chave: `J:${equipe.id}`, nome: equipe.nome, tipo: '6x1' as const })),
    ...plantoes.map((item) => ({ chave: `P:${item.grupo.grupoId}`, nome: rotuloGrupoPlantao(item.grupo.nome), tipo: 'Plantão' as const })),
  ];
  const [abaSelecionada, setAbaSelecionada] = useState<string>('');
  const [visao6x1, setVisao6x1] = useState<Visualizacao6x1>('mes');
  const [visaoPlantao, setVisaoPlantao] = useState<VisualizacaoPlantao>('calendario');
  const [inicioSemana, setInicioSemana] = useState(() => semanaDaData(dataHoje)[0] ?? dataHoje);
  const [pessoaAberta, setPessoaAberta] = useState<{ documento: TurnosMes; nome: string } | null>(null);
  const aba = abas.find((item) => item.chave === abaSelecionada) ?? abas[0];
  if (aba === undefined) {
    return (
      <article className="panel visao-coord-equipes">
        <div className="panel-title"><div><p className="eyebrow">Coordenação</p><h2>Suas equipes</h2></div></div>
        <EstadoVazioCoordenacao diagnostico={diagnostico} />
      </article>
    );
  }
  const equipe = aba.chave.startsWith('J:') ? equipes.find((item) => `J:${item.id}` === aba.chave) : undefined;
  const plantao = aba.chave.startsWith('P:') ? plantoes.find((item) => `P:${item.grupo.grupoId}` === aba.chave) : undefined;
  const semana = semanaDaData(inicioSemana);
  const resumoHoje = equipe ? resumirEquipeNoDia(equipe.documentos, dataHoje, catalogo, equipe.nomes) : null;
  const plantonistas = plantao ? resumirPlantonistas(plantao.atribuicoes) : [];

  return (
    <article className="panel visao-coord-equipes">
      <header className="visao-coord-cabecalho">
        <div>
          <p className="eyebrow">Coordenação</p>
          <h2>Suas equipes</h2>
          <p>Consulta das escalas que você administra. Para alterar, use o Dashboard.</p>
        </div>
      </header>

      <AvisoFalhas diagnostico={diagnostico} />

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
              {item.tipo === 'Plantão' ? <Radio size={15} aria-hidden="true" /> : <Users size={15} aria-hidden="true" />}
              <span>{item.nome}</span>
              <small>{item.tipo}</small>
            </button>
          ))}
        </div>
      )}

      {equipe !== undefined && (
        <section className="visao-coord-conteudo">
          <div className="visao-coord-numeros">
            <div><small>Pessoas</small><strong>{equipe.documentos.length}</strong></div>
            <div><small>Trabalhando hoje</small><strong>{resumoHoje ? PERIODOS_JORNADA.reduce((soma, periodo) => soma + resumoHoje.porPeriodo[periodo].length, 0) : 0}</strong></div>
            <div><small>De folga hoje</small><strong>{resumoHoje?.folga.length ?? 0}</strong></div>
            <div data-alerta={resumoHoje && resumoHoje.descobertos.length > 0 ? '' : undefined}>
              <small>Turnos descobertos</small>
              <strong>{resumoHoje?.descobertos.length ? resumoHoje.descobertos.join(', ') : 'Nenhum'}</strong>
            </div>
          </div>

          <div className="visao-coord-seletor" role="tablist" aria-label="Visualização">
            {([['mes', 'Mês'], ['semana', 'Semana'], ['totais', 'Totais']] as const).map(([valor, rotulo]) => (
              <button key={valor} type="button" role="tab" aria-selected={visao6x1 === valor} className={visao6x1 === valor ? 'active' : ''} onClick={() => setVisao6x1(valor)}>
                {rotulo}
              </button>
            ))}
          </div>

          {equipe.documentos.length === 0 ? (
            <p className="empty-inline">Sem escala publicada para {equipe.nome} neste mês.</p>
          ) : visao6x1 === 'mes' && renderizarMes6x1 ? (
            <div className="visao-coord-mes-equipe">{renderizarMes6x1(equipe)}</div>
          ) : visao6x1 === 'totais' ? (
            <div className="visao-coord-tabela-rolagem">
              <table className="visao-coord-tabela visao-coord-tabela-resumo">
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th>Dias trabalhados</th>
                    <th>Horas</th>
                    <th>Folgas sáb.</th>
                    <th>Folgas dia de semana</th>
                    <th>Folgas dom.</th>
                    <th>Hora extra</th>
                  </tr>
                </thead>
                <tbody>
                  {[...equipe.documentos]
                    .map((documento) => ({ documento, nome: equipe.nomes.get(documento.login) ?? documento.login, resumo: resumirMesDaPessoa(documento, catalogo) }))
                    .sort((a, b) => a.nome.localeCompare(b.nome))
                    .map(({ documento, nome, resumo }) => (
                      <tr key={documento.login}>
                        <th scope="row">
                          <button type="button" className="link-button" onClick={() => setPessoaAberta({ documento, nome })}>{nome}</button>
                        </th>
                        <td><strong>{resumo.diasTrabalhados}</strong></td>
                        <td>{formatarHorasMinutos(resumo.minutos)}</td>
                        <td>{resumo.folgasSabado}</td>
                        <td>{resumo.folgasSemana}</td>
                        <td>{resumo.folgasDomingo}</td>
                        <td>{resumo.horasExtras || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
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
                              <button type="button" className="link-button" onClick={() => setPessoaAberta({ documento, nome })}>{nome}</button>
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
            </>
          )}
        </section>
      )}

      {plantao !== undefined && (
        <section className="visao-coord-conteudo">
          <div className="visao-coord-numeros">
            <div><small>Plantonistas</small><strong>{plantonistas.length}</strong></div>
            <div><small>Plantões no mês</small><strong>{plantao.atribuicoes.length}</strong></div>
            <div><small>Fim de semana / feriado</small><strong>{plantonistas.reduce((soma, item) => soma + item.plantoes24h, 0)}</strong></div>
            <div><small>Dia útil</small><strong>{plantonistas.reduce((soma, item) => soma + item.plantoesCurtos, 0)}</strong></div>
          </div>

          <div className="visao-coord-seletor" role="tablist" aria-label="Visualização">
            {([['calendario', 'Calendário'], ['lista', 'Próximos'], ['totais', 'Totais']] as const).map(([valor, rotulo]) => (
              <button key={valor} type="button" role="tab" aria-selected={visaoPlantao === valor} className={visaoPlantao === valor ? 'active' : ''} onClick={() => setVisaoPlantao(valor)}>
                {rotulo}
              </button>
            ))}
          </div>

          {plantao.atribuicoes.length === 0 ? (
            <p className="empty-inline">Sem plantão publicado neste período.</p>
          ) : visaoPlantao === 'calendario' && renderizarCalendarioPlantao ? (
            <div className="visao-coord-mes-equipe">{renderizarCalendarioPlantao(plantao)}</div>
          ) : visaoPlantao === 'totais' ? (
            <div className="visao-coord-tabela-rolagem">
              <table className="visao-coord-tabela visao-coord-tabela-resumo">
                <thead>
                  <tr>
                    <th>Plantonista</th>
                    <th>Plantões</th>
                    <th>Fim de semana / feriado (24h)</th>
                    <th>Dia útil</th>
                    <th>Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {plantonistas.map((item) => (
                    <tr key={item.login}>
                      <th scope="row">{nomeExibicaoPlantonista(item.login, [])}</th>
                      <td><strong>{item.plantoes}</strong></td>
                      <td>{item.plantoes24h}</td>
                      <td>{item.plantoesCurtos}</td>
                      <td>{formatarHorasMinutos(item.minutos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="visao-coord-plantoes">
              {[...plantao.atribuicoes]
                .filter((atribuicao) => atribuicao.fim.slice(0, 10) >= dataHoje)
                .sort((a, b) => a.inicio.localeCompare(b.inicio))
                .slice(0, 21)
                .map((atribuicao) => {
                  const intervalo = intervaloPlantaoCivil(atribuicao, plantao.grupo.timezone);
                  const nome = nomeExibicaoPlantonista(atribuicao.plantonistaLogin, []);
                  return (
                    <li key={`${atribuicao.plantonistaLogin}-${atribuicao.inicio}`}>
                      <span className="visao-coord-avatar" aria-hidden="true">{nome.split(/\s+/u).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join('')}</span>
                      <span>
                        <strong>{nome}</strong>
                        <small>{tituloPeriodoPlantao(intervalo)}</small>
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
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
  /*
   * VISAO-COORDENADOR-MOBILE-3 — o modal é desenhado direto no <body>
   * (portal). Antes ele era filho do card "Suas equipes" e herdava as
   * margens dos filhos do card: o escurecido ficava recuado e, no celular,
   * a folha não ocupava a largura nem encostava embaixo. As cores do tema
   * ficam em :root, então continuam valendo fora da árvore do app.
   */
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(
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
    </div>,
    document.body,
  );
}
