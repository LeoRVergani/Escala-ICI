'use client';

import {
  CATALOGO_SOC,
  calcularTotais,
  formatarMinutos,
  parsePlanilhaEscala,
  type Dia,
  type ErroImportacao,
  type ResultadoParse,
  type TurnosMes,
} from '@escala-ici/contrato';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileSpreadsheet,
  Filter,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import { AppFrame, type ItemNavegacao } from '@/components/AppFrame';
import { LoginPanel } from '@/components/LoginPanel';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import {
  EQUIPE_DEMO,
  USUARIOS_DEMO,
  carregarEscalaDemonstracao,
} from '@/lib/demo';
import {
  carregarEscalasEquipe,
  carregarEstadoPublicacao,
  carregarRascunhosEquipe,
  listarHistoricoPublicacoes,
  listarEventosPublicacao,
  listarCatalogo,
  listarUsuarios,
} from '@/lib/firebase/readRepository';
import {
  escritaAdministrativaHabilitada,
  publicarEscalas,
  reverterPublicacao,
  salvarRascunho,
  salvarUsuario,
  salvarUsuarios,
} from '@/lib/firebase/writeRepository';
import { sair } from '@/lib/firebase/authRepository';
import { mensagemErroFirebase } from '@/lib/firebase/errors';
import { mapaLogins, novoUsuario } from '@/lib/importUsers';
import type { EventoEscala, PublicacaoEscala, Usuario } from '@/lib/modelos';

type Tela = 'visao' | 'importar' | 'escalas' | 'grade' | 'usuarios';

const NAVEGACAO: ItemNavegacao[] = [
  { id: 'visao', rotulo: 'Visão geral', icone: 'home' },
  { id: 'importar', rotulo: 'Importar escala', icone: 'upload' },
  { id: 'escalas', rotulo: 'Escalas', icone: 'calendar' },
  { id: 'grade', rotulo: 'Grade', icone: 'grid' },
  { id: 'usuarios', rotulo: 'Usuários', icone: 'users' },
];

interface CelulaEditando {
  documento: TurnosMes;
  data: string;
  dia: Dia;
}

export function DashboardApp() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [modoDemo, setModoDemo] = useState(true);
  const [tela, setTela] = useState<Tela>('importar');
  const [usuarios, setUsuarios] = useState<Usuario[]>(USUARIOS_DEMO);
  const [catalogo, setCatalogo] = useState(CATALOGO_SOC);
  const [resultado, setResultado] = useState<ResultadoParse | null>(null);
  const [arquivo, setArquivo] = useState<ArrayBuffer | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('Escala-SOC-Controle-Agosto.xls');
  const [processando, setProcessando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [correcoes, setCorrecoes] = useState<Record<number, string>>({});
  const [filtroTurno, setFiltroTurno] = useState('TODOS');
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [celulaEditando, setCelulaEditando] = useState<CelulaEditando | null>(null);
  const [historico, setHistorico] = useState<PublicacaoEscala[]>([]);
  const [revisaoAtual, setRevisaoAtual] = useState(0);
  const [revisaoParaRestaurar, setRevisaoParaRestaurar] = useState<PublicacaoEscala | null>(null);
  const [publicacaoPendente, setPublicacaoPendente] = useState(false);
  const [motivoPublicacao, setMotivoPublicacao] = useState('');
  const [publicacaoExpandida, setPublicacaoExpandida] = useState<string | null>(null);
  const [detalhesPublicacao, setDetalhesPublicacao] = useState<Record<string, EventoEscala[]>>({});
  const inputArquivo = useRef<HTMLInputElement>(null);
  const escritaBloqueada = !modoDemo && !escritaAdministrativaHabilitada;

  const documentos = useMemo(
    () => resultado?.documentos ?? [],
    [resultado?.documentos],
  );
  const publicados = documentos.filter(({ status }) => status === 'PUBLICADA');
  const totaisGerais = useMemo(() => {
    const totalMin = documentos.reduce((soma, documento) =>
      soma + calcularTotais(documento.dias, catalogo).min, 0);
    return {
      pessoas: documentos.length,
      dias: resultado?.totalDias ?? 0,
      horas: formatarMinutos(totalMin),
    };
  }, [catalogo, documentos, resultado?.totalDias]);

  useEffect(() => {
    if (usuario === null || !modoDemo || resultado !== null) {
      return;
    }
    let cancelado = false;
    void carregarEscalaDemonstracao()
      .then((escala) => {
        if (!cancelado) {
          setResultado({
            ...escala,
            documentos: escala.documentos.map((documento) => ({
              ...documento,
              status: 'RASCUNHO',
              publicadoPor: null,
              publicadoEm: null,
            })),
          });
        }
      })
      .catch((falha: unknown) => {
        if (!cancelado) {
          setMensagem(falha instanceof Error ? falha.message : 'Falha ao carregar demonstração.');
        }
      })
      .finally(() => {
        if (!cancelado) {
          setProcessando(false);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [modoDemo, resultado, usuario]);

  async function carregarDemo() {
    setProcessando(true);
    try {
      if (!modoDemo && usuario !== null) {
        const resposta = await fetch('/demo/Escala-SOC-Controle-Agosto.xls');
        if (!resposta.ok) {
          throw new Error('Não foi possível carregar a planilha de exemplo.');
        }
        interpretar(await resposta.arrayBuffer(), 'Escala-SOC-Controle-Agosto.xls');
        return;
      }
      const escala = await carregarEscalaDemonstracao();
      setResultado({
        ...escala,
        documentos: escala.documentos.map((documento) => ({
          ...documento,
          status: 'RASCUNHO',
          publicadoPor: null,
          publicadoEm: null,
        })),
      });
    } catch (falha) {
      setMensagem(falha instanceof Error ? falha.message : 'Falha ao carregar demonstração.');
    } finally {
      setProcessando(false);
    }
  }

  async function autenticar(autenticado: Usuario, demonstracao: boolean) {
    setUsuario(autenticado);
    setModoDemo(demonstracao);
    if (!demonstracao) {
      const [
        usuariosRemotos,
        catalogoRemoto,
        escalasRemotas,
        rascunhosRemotos,
        historicoRemoto,
        estadoPublicacao,
      ] = await Promise.all([
        listarUsuarios(autenticado.equipeId),
        listarCatalogo(autenticado.equipeId),
        carregarEscalasEquipe(autenticado.equipeId, '2026-08', true),
        carregarRascunhosEquipe(autenticado.equipeId, '2026-08'),
        listarHistoricoPublicacoes(autenticado.equipeId, '2026-08'),
        carregarEstadoPublicacao(autenticado.equipeId, '2026-08'),
      ]);
      setUsuarios(usuariosRemotos);
      setCatalogo(catalogoRemoto);
      setHistorico(historicoRemoto);
      setRevisaoAtual(estadoPublicacao?.revisaoAtual ?? 0);
      const documentosCarregados = rascunhosRemotos.length > 0
        ? rascunhosRemotos
        : escalasRemotas;
      if (documentosCarregados.length > 0) {
        const datas = documentosCarregados.flatMap((documento) => Object.keys(documento.dias));
        const periodoInicio = datas.sort()[0] ?? '2026-07-26';
        const periodoFim = datas.sort().at(-1) ?? '2026-08-25';
        setResultado({
          ok: true,
          equipeNome: autenticado.equipeId,
          periodoInicio,
          periodoFim,
          totalDias: new Set(datas).size,
          documentos: documentosCarregados,
          erros: [],
          avisos: [],
        });
        setTela('escalas');
      }
    }
  }

  function interpretar(buffer: ArrayBuffer, nome: string) {
    setProcessando(true);
    setMensagem('');
    try {
      const parseado = parsePlanilhaEscala(buffer, {
        equipeId: usuario?.equipeId ?? EQUIPE_DEMO.id,
        competencia: '2026-08',
        catalogo,
        loginParaUid: mapaLogins(usuarios),
      });
      setArquivo(buffer);
      setNomeArquivo(nome);
      setResultado(parseado);
      setCorrecoes({});
      if (!parseado.ok) {
        setMensagem(`${parseado.erros.length} erro(s) encontrado(s). Corrija antes de salvar.`);
      }
    } catch (falha) {
      setMensagem(falha instanceof Error ? falha.message : 'Arquivo inválido.');
    } finally {
      setProcessando(false);
    }
  }

  async function receberArquivo(file: File | undefined) {
    if (file === undefined) {
      return;
    }
    const extensaoValida = /\.(xls|xlsx)$/iu.test(file.name);
    if (!extensaoValida) {
      setMensagem('Selecione um arquivo XLS ou XLSX.');
      return;
    }
    interpretar(await file.arrayBuffer(), file.name);
  }

  function soltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastando(false);
    void receberArquivo(evento.dataTransfer.files[0]);
  }

  function corrigirErro(erro: ErroImportacao, indice: number) {
    const valor = correcoes[indice]?.trim();
    if (arquivo === null || !valor) {
      return;
    }
    const workbook = XLSX.read(arquivo, { type: 'array', cellStyles: true });
    const planilha = workbook.Sheets.Escalistas;
    if (planilha === undefined) {
      setMensagem('A aba Escalistas não foi encontrada.');
      return;
    }
    planilha[`${erro.coluna}${erro.linha}`] = { t: 's', v: valor };
    const bookType = nomeArquivo.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'xls';
    const corrigido = XLSX.write(workbook, {
      type: 'array',
      bookType,
      cellStyles: true,
    }) as ArrayBuffer;
    interpretar(corrigido, nomeArquivo);
  }

  async function cadastrarFaltantes() {
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    if (usuario === null) {
      return;
    }
    setProcessando(true);
    try {
      const logins = [...new Set(
        (resultado?.erros ?? [])
          .filter((erro) => erro.motivo.includes('loginParaUid'))
          .map((erro) => erro.login)
          .filter((login): login is string => login !== undefined),
      )];
      const novos = logins.map((login, indice) =>
        novoUsuario(usuarios.length + indice + 1, usuario, login, true));
      if (!modoDemo) {
        await salvarUsuarios(novos);
      }
      const atualizados = [...usuarios, ...novos];
      setUsuarios(atualizados);
      if (arquivo !== null) {
        const parseado = parsePlanilhaEscala(arquivo, {
          equipeId: usuario.equipeId,
          competencia: '2026-08',
          catalogo,
          loginParaUid: mapaLogins(atualizados),
        });
        setResultado(parseado);
        setMensagem(parseado.ok
          ? `${novos.length} usuário(s) cadastrado(s). A escala está pronta para salvar.`
          : `${parseado.erros.length} inconsistência(s) ainda precisam de correção.`);
      }
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível cadastrar os usuários faltantes.'));
    } finally {
      setProcessando(false);
    }
  }

  async function salvar() {
    if (resultado === null || usuario === null || !resultado.ok) {
      return;
    }
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    setProcessando(true);
    try {
      if (!modoDemo) {
        await salvarRascunho(resultado, usuario, nomeArquivo);
      }
      setResultado({
        ...resultado,
        documentos: resultado.documentos.map((documento) => ({
          ...documento,
          status: 'RASCUNHO',
        })),
      });
      setMensagem('Rascunho salvo com sucesso. Nenhum arquivo foi enviado.');
      setTela('escalas');
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível salvar.'));
    } finally {
      setProcessando(false);
    }
  }

  async function publicar() {
    if (resultado === null || usuario === null || !resultado.ok) {
      setMensagem('Corrija todos os logins e inconsistências antes de publicar.');
      return;
    }
    if (escritaBloqueada) {
      setMensagem('A publicação está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    if (revisaoAtual > 0 && motivoPublicacao.trim().length < 3) {
      setMensagem('Informe um motivo curto para explicar o que mudou nesta publicação.');
      return;
    }
    setProcessando(true);
    try {
      if (!modoDemo) {
        const publicacao = await publicarEscalas(
          resultado.documentos,
          usuario.uid,
          motivoPublicacao,
        );
        setHistorico((atual) => [publicacao, ...atual]);
        setRevisaoAtual(publicacao.revisao);
      } else {
        setRevisaoAtual((atual) => atual + 1);
      }
      const agora = new Date().toISOString();
      setResultado({
        ...resultado,
        documentos: resultado.documentos.map((documento) => ({
          ...documento,
          status: 'PUBLICADA',
          publicadoPor: usuario.uid,
          publicadoEm: agora,
        })),
      });
      setMensagem('Escala publicada para a equipe.');
      setPublicacaoPendente(false);
      setMotivoPublicacao('');
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Falha na publicação.'));
    } finally {
      setProcessando(false);
    }
  }

  async function alternarDetalhes(publicacao: PublicacaoEscala) {
    if (publicacaoExpandida === publicacao.id) {
      setPublicacaoExpandida(null);
      return;
    }
    setPublicacaoExpandida(publicacao.id);
    if (modoDemo || detalhesPublicacao[publicacao.id] !== undefined || usuario === null) {
      return;
    }
    try {
      const eventos = await listarEventosPublicacao(usuario.equipeId, publicacao.id);
      setDetalhesPublicacao((atuais) => ({ ...atuais, [publicacao.id]: eventos }));
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível carregar os detalhes da revisão.'));
    }
  }

  async function restaurar() {
    if (usuario === null || revisaoParaRestaurar === null || modoDemo) {
      setRevisaoParaRestaurar(null);
      return;
    }
    if (escritaBloqueada) {
      setMensagem('O rollback está bloqueado fora do laboratório local.');
      setRevisaoParaRestaurar(null);
      return;
    }
    setProcessando(true);
    try {
      const restaurada = await reverterPublicacao(
        usuario.equipeId,
        revisaoParaRestaurar.competencia,
        revisaoParaRestaurar.revisao,
        usuario.uid,
      );
      setHistorico((atual) => [restaurada.publicacao, ...atual]);
      setRevisaoAtual(restaurada.publicacao.revisao);
      const datas = restaurada.documentos.flatMap((documento) => Object.keys(documento.dias));
      setResultado({
        ok: true,
        equipeNome: usuario.equipeId,
        periodoInicio: datas.sort()[0] ?? '2026-07-26',
        periodoFim: datas.sort().at(-1) ?? '2026-08-25',
        totalDias: new Set(datas).size,
        documentos: restaurada.documentos,
        erros: [],
        avisos: [],
      });
      setMensagem(
        `Revisão ${revisaoParaRestaurar.revisao} restaurada como revisão ${restaurada.publicacao.revisao}.`,
      );
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Falha ao restaurar a revisão.'));
    } finally {
      setProcessando(false);
      setRevisaoParaRestaurar(null);
    }
  }

  function editarCelula(codigo: string) {
    if (celulaEditando === null || resultado === null) {
      return;
    }
    const tipo = catalogo[codigo];
    if (tipo === undefined) {
      return;
    }
    const novoDia: Dia = tipo.categoria === 'TRABALHO'
      ? {
          c: tipo.codigo,
          i: tipo.horaInicio,
          f: tipo.horaFim,
          m: tipo.duracaoMinutos,
          vd: tipo.viraDia,
          seq: celulaEditando.dia.seq ?? 1,
        }
      : { c: tipo.codigo };

    const atualizados = resultado.documentos.map((documento) => {
      if (documento.usuarioUid !== celulaEditando.documento.usuarioUid) {
        return documento;
      }
      const dias = { ...documento.dias, [celulaEditando.data]: novoDia };
      return { ...documento, dias, totais: calcularTotais(dias, catalogo) };
    });
    setResultado({ ...resultado, documentos: atualizados });
    setCelulaEditando(null);
    setMensagem('Célula atualizada no rascunho local. Salve para persistir.');
  }

  async function adicionarUsuario() {
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    if (usuario === null) {
      return;
    }
    const novo = novoUsuario(usuarios.length + 1, usuario);
    if (!modoDemo) {
      await salvarUsuario(novo);
    }
    setUsuarios((atuais) => [...atuais, novo]);
  }

  async function encerrarSessao() {
    await sair();
    setUsuario(null);
    setResultado(null);
    setMensagem('');
  }

  if (usuario === null) {
    return <LoginPanel tipo="dashboard" onEntrar={autenticar} />;
  }

  return (
    <AppFrame
      produto="dashboard"
      usuario={usuario}
      competencia="Agosto 2026"
      itens={NAVEGACAO}
      ativo={tela}
      onNavegar={(id) => setTela(id as Tela)}
      onSair={encerrarSessao}
      produtoHref={import.meta.env.VITE_EMPLOYEE_APP_URL ?? '/app'}
    >
      {mensagem && (
        <div className={`toast ${resultado?.ok === false ? 'error' : ''}`}>
          <span>{mensagem}</span>
          <button type="button" onClick={() => setMensagem('')} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
      )}
      {escritaBloqueada && (
        <div className="alert warning" role="status">
          Ambiente real conectado em modo de validação somente leitura.
          Salvar, cadastrar e publicar exigem habilitação administrativa explícita.
        </div>
      )}

      {tela === 'visao' && (
        <section>
          <header className="page-heading">
            <div><p className="eyebrow">Operação SOC</p><h1>Visão geral</h1></div>
            <button className="primary-button" type="button" onClick={() => setTela('importar')}>
              <Plus size={17} /> Nova importação
            </button>
          </header>
          <div className="metric-grid">
            <article><span>Competência ativa</span><strong>Agosto 2026</strong><small>26 jul – 25 ago</small></article>
            <article><span>Colaboradores</span><strong>{totaisGerais.pessoas}</strong><small>vinculados ao SOC</small></article>
            <article><span>Dias no período</span><strong>{totaisGerais.dias}</strong><small>fechamento 26 → 25</small></article>
            <article><span>Horas planejadas</span><strong>{totaisGerais.horas}</strong><small>recalculadas dos dias</small></article>
          </div>
          <div className="content-grid two-columns">
            <article className="panel">
              <div className="panel-title"><div><h2>Estado da publicação</h2><p>Documentos da competência atual</p></div><ShieldCheck /></div>
              <div className="publication-progress">
                <strong>{publicados.length}/{documentos.length}</strong>
                <span>documentos publicados</span>
                <div><i style={{ width: documentos.length ? `${(publicados.length / documentos.length) * 100}%` : '0%' }} /></div>
              </div>
            </article>
            <article className="panel quick-actions">
              <div className="panel-title"><div><h2>Próximas ações</h2><p>Fluxo recomendado</p></div></div>
              <button type="button" onClick={() => setTela('importar')}><UploadCloud /> Validar nova planilha <ArrowUpRight /></button>
              <button type="button" onClick={() => setTela('grade')}><Pencil /> Revisar a grade <ArrowUpRight /></button>
            </article>
          </div>
        </section>
      )}

      {tela === 'importar' && (
        <section>
          <header className="page-heading">
            <div><p className="eyebrow">Importação segura</p><h1>Importar escala</h1><p>O arquivo é processado somente na memória deste navegador.</p></div>
          </header>
          <article className="import-panel panel">
            <div
              className={`dropzone ${arrastando ? 'dragging' : ''}`}
              onDragOver={(evento) => {
                evento.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={soltar}
              role="button"
              tabIndex={0}
              onClick={() => inputArquivo.current?.click()}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter' || evento.key === ' ') {
                  inputArquivo.current?.click();
                }
              }}
            >
              <input
                ref={inputArquivo}
                type="file"
                accept=".xls,.xlsx"
                hidden
                onChange={(evento: ChangeEvent<HTMLInputElement>) =>
                  void receberArquivo(evento.target.files?.[0])}
              />
              <span className="drop-icon"><FileSpreadsheet size={28} /></span>
              <div>
                <h2>Enviar planilha</h2>
                <p>Arraste o arquivo aqui ou <strong>selecione do computador</strong></p>
                <small>XLS legado ou XLSX · leitura local</small>
              </div>
            </div>
            <div className="import-summary">
              <div><span>Período</span><strong>{resultado ? '26 jul – 25 ago' : '—'}</strong></div>
              <div><span>Colaboradores</span><strong>{resultado?.documentos.length ?? '—'}</strong></div>
              <div><span>Dias</span><strong>{resultado?.totalDias ?? '—'}</strong></div>
            </div>
            <div className="file-row">
              <FileSpreadsheet size={20} />
              <div><strong>{nomeArquivo}</strong><span>{resultado?.ok ? 'Pronto para salvar' : 'Aguardando correções'}</span></div>
              {processando
                ? <LoaderCircle className="spin" />
                : resultado?.ok
                  ? <CheckCircle2 className="success-icon" />
                  : <AlertTriangle className="warning-icon" />}
            </div>
            <div className="import-actions">
              <button className="secondary-button" type="button" onClick={() => void carregarDemo()}>
                Carregar exemplo
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!resultado?.ok || processando || escritaBloqueada}
                onClick={() => void salvar()}
              >
                <Save size={17} /> Salvar rascunho
              </button>
            </div>
          </article>

          {resultado && resultado.erros.length > 0 && (
            <article className="panel error-panel">
              <div className="panel-title">
                <div><h2>Corrigir inconsistências</h2><p>Nada será gravado enquanto houver erros.</p></div>
                {resultado.erros.some((erro) => erro.motivo.includes('loginParaUid')) && (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={escritaBloqueada}
                    onClick={() => void cadastrarFaltantes()}
                  >
                    <UserPlus size={16} /> Cadastrar usuários faltantes
                  </button>
                )}
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Local</th><th>Login</th><th>Valor</th><th>Motivo</th><th>Correção</th></tr></thead>
                  <tbody>
                    {resultado.erros.map((erro, indice) => (
                      <tr key={`${erro.linha}-${erro.coluna}-${indice}`}>
                        <td>{erro.coluna}{erro.linha}</td>
                        <td>{erro.login ?? '—'}</td>
                        <td><code>{erro.valorEncontrado}</code></td>
                        <td>{erro.motivo}<small>{erro.sugestao}</small></td>
                        <td>
                          <div className="inline-edit">
                            <input
                              value={correcoes[indice] ?? ''}
                              onChange={(evento) => setCorrecoes((atuais) => ({
                                ...atuais,
                                [indice]: evento.target.value,
                              }))}
                              aria-label={`Correção para ${erro.coluna}${erro.linha}`}
                            />
                            <button type="button" onClick={() => corrigirErro(erro, indice)}>
                              Aplicar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {resultado && resultado.documentos.length > 0 && (
            <article className="panel grid-panel">
              <div className="panel-title">
                <div><h2>Prévia da escala</h2><p>{resultado.equipeNome} · {resultado.periodoInicio} a {resultado.periodoFim}</p></div>
                <span className={`status-badge ${resultado.ok ? 'success' : 'danger'}`}>
                  {resultado.ok ? 'Sem erros' : `${resultado.erros.length} erros`}
                </span>
              </div>
              <ScheduleGrid documentos={resultado.documentos} usuarios={usuarios} catalogo={catalogo} compacta />
            </article>
          )}
        </section>
      )}

      {tela === 'escalas' && (
        <section>
          <header className="page-heading">
            <div><p className="eyebrow">Competências</p><h1>Escalas</h1><p>Rascunhos e publicações disponíveis para a equipe.</p></div>
            <button className="primary-button" type="button" onClick={() => setTela('importar')}>
              <Plus size={17} /> Importar
            </button>
          </header>
          <article className="panel scale-record">
            <div className="scale-period"><span>AGO</span><strong>2026</strong></div>
            <div className="scale-info">
              <h2>COSI &gt; SOC</h2>
              <p>26/07/2026 até 25/08/2026 · {documentos.length} colaboradores</p>
              <span className={`status-badge ${publicados.length === documentos.length && documentos.length ? 'success' : 'warning'}`}>
                {publicados.length === documentos.length && documentos.length ? 'Publicada' : 'Rascunho'}
              </span>
              {revisaoAtual > 0 && <span className="revision-label">Revisão ativa {revisaoAtual}</span>}
            </div>
            <div className="scale-actions">
              <button className="secondary-button" type="button" onClick={() => setTela('grade')}>Revisar grade</button>
              <button
                className="primary-button"
                type="button"
                disabled={!documentos.length || !resultado?.ok || processando || escritaBloqueada}
                onClick={() => setPublicacaoPendente(true)}
              >
                <Send size={16} /> Publicar
              </button>
            </div>
          </article>
          <article className="panel publication-history-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Rastreabilidade local</p>
                <h2>Histórico de publicações</h2>
                <p>Cada publicação é imutável; um rollback sempre cria uma nova revisão.</p>
              </div>
              <ShieldCheck />
            </div>
            {historico.length === 0 ? (
              <div className="history-empty">
                <RotateCcw size={22} />
                <span>{modoDemo ? 'Entre no laboratório local para testar o histórico e o rollback.' : 'Nenhuma revisão encontrada.'}</span>
              </div>
            ) : (
              <div className="publication-history-list">
                {historico.map((publicacao) => {
                  const eventos = detalhesPublicacao[publicacao.id] ?? [];
                  const alteracoes = eventos.flatMap((evento) => evento.alteracoes);
                  return (
                    <div className="publication-history-entry" key={publicacao.id}>
                      <div className="publication-history-item">
                        <span className={`revision-dot ${publicacao.tipo.toLowerCase()}`} />
                        <div>
                          <strong>
                            Revisão {publicacao.revisao}
                            {publicacao.revisao === revisaoAtual ? ' — ativa' : ''}
                          </strong>
                          <span>{publicacao.motivo ?? (
                            publicacao.tipo === 'ROLLBACK'
                              ? `Rollback da revisão ${publicacao.revisaoOrigem}`
                              : publicacao.tipo === 'SEED' ? 'Carga inicial do laboratório' : 'Publicação da escala'
                          )}</span>
                          <small>
                            {publicacao.totalColaboradoresAfetados ?? publicacao.totalDocumentos} colaborador(es) ·{' '}
                            {publicacao.totalDiasAlterados ?? '—'} dia(s) alterado(s)
                          </small>
                        </div>
                        <time dateTime={publicacao.publicadoEm}>
                          {new Intl.DateTimeFormat('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(publicacao.publicadoEm))}
                        </time>
                        <div className="history-actions">
                          <button
                            className="secondary-button compact-button"
                            type="button"
                            onClick={() => void alternarDetalhes(publicacao)}
                          >
                            {publicacaoExpandida === publicacao.id ? 'Ocultar' : 'Ver alterações'}
                          </button>
                          {publicacao.revisao !== revisaoAtual && (
                            <button
                              className="secondary-button compact-button"
                              type="button"
                              disabled={modoDemo || processando || escritaBloqueada}
                              onClick={() => setRevisaoParaRestaurar(publicacao)}
                            >
                              <RotateCcw size={14} /> Restaurar
                            </button>
                          )}
                        </div>
                      </div>
                      {publicacaoExpandida === publicacao.id && (
                        <div className="publication-history-details">
                          {alteracoes.length === 0 ? (
                            <p>
                              {publicacao.tipo === 'SEED'
                                ? 'Esta é a carga inicial do laboratório; não existe uma revisão anterior para comparar.'
                                : 'Nenhuma alteração detalhada foi encontrada para esta revisão.'}
                            </p>
                          ) : (
                            <div className="history-change-list">
                              {alteracoes.map((alteracao) => {
                                const pessoa = usuarios.find((item) => item.uid === alteracao.usuarioUid);
                                const antes = alteracao.codigoAnterior === null
                                  ? 'Sem escala'
                                  : `${catalogo[alteracao.codigoAnterior]?.descricao ?? alteracao.codigoAnterior}${alteracao.horarioAnterior ? ` · ${alteracao.horarioAnterior}` : ''}`;
                                const depois = alteracao.codigoNovo === null
                                  ? 'Removido da escala'
                                  : `${catalogo[alteracao.codigoNovo]?.descricao ?? alteracao.codigoNovo}${alteracao.horarioNovo ? ` · ${alteracao.horarioNovo}` : ''}`;
                                return (
                                  <div className="history-change" key={`${alteracao.usuarioUid}-${alteracao.data}`}>
                                    <div>
                                      <strong>{pessoa?.nome ?? alteracao.login}</strong>
                                      <span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${alteracao.data}T12:00:00Z`))}</span>
                                    </div>
                                    <span className="history-before">{antes}</span>
                                    <ArrowUpRight size={15} />
                                    <span className="history-after">{depois}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      )}

      {tela === 'grade' && (
        <section>
          <header className="page-heading">
            <div><p className="eyebrow">Revisão completa</p><h1>Grade da equipe</h1><p>Clique em uma célula para editar o rascunho.</p></div>
            <button
              className="primary-button"
              type="button"
              disabled={!documentos.length || escritaBloqueada}
              onClick={() => void salvar()}
            >
              <Save size={16} /> Salvar alterações
            </button>
          </header>
          <article className="panel grid-panel">
            <div className="toolbar">
              <label><Filter size={16} /><select value={filtroTurno} onChange={(evento) => setFiltroTurno(evento.target.value)}>
                <option value="TODOS">Todos os turnos</option>
                <option value="MD">Madrugada</option><option value="M">Manhã</option>
                <option value="T">Tarde</option><option value="N">Noite</option>
              </select></label>
              <span>{documentos.filter((documento) => filtroTurno === 'TODOS' || documento.turnoPadrao === filtroTurno).length} colaboradores</span>
            </div>
            <ScheduleGrid
              documentos={documentos}
              usuarios={usuarios}
              catalogo={catalogo}
              filtroTurno={filtroTurno}
              onEditar={(documento, data, dia) => setCelulaEditando({ documento, data, dia })}
            />
          </article>
        </section>
      )}

      {tela === 'usuarios' && (
        <section>
          <header className="page-heading">
            <div><p className="eyebrow">Identidades de importação</p><h1>Usuários</h1><p>O login em destaque deve coincidir com a planilha.</p></div>
            <button
              className="primary-button"
              type="button"
              disabled={escritaBloqueada}
              onClick={() => void adicionarUsuario()}
            >
              <UserPlus size={17} /> Cadastrar usuário
            </button>
          </header>
          <article className="panel">
            <div className="toolbar">
              <label className="search-control"><Search size={16} /><input value={buscaUsuario} onChange={(evento) => setBuscaUsuario(evento.target.value)} placeholder="Buscar nome ou login" /></label>
              <span><Users size={16} /> {usuarios.length} usuários</span>
            </div>
            <div className="table-scroll">
              <table className="data-table users-table">
                <thead><tr><th>Colaborador</th><th>Login de importação</th><th>Turno</th><th>Perfil</th><th>Status</th></tr></thead>
                <tbody>
                  {usuarios
                    .filter((item) => `${item.nome} ${item.login}`.toLowerCase().includes(buscaUsuario.toLowerCase()))
                    .map((item) => (
                      <tr key={item.uid}>
                        <td><strong>{item.nome}</strong><small>{item.email}</small></td>
                        <td><code className="login-code">{item.login}</code></td>
                        <td>{item.turnoPadrao}</td>
                        <td>{item.cargo}</td>
                        <td><span className={`status-badge ${item.ativo ? 'success' : 'neutral'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {publicacaoPendente && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPublicacaoPendente(false)}>
          <section
            className="edit-modal publication-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publication-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Comunicação da mudança</p>
                <h2 id="publication-title">Publicar nova versão da escala?</h2>
                <p>Os colaboradores afetados receberão esta informação no sino do App.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setPublicacaoPendente(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <label className="publication-reason">
              Motivo da publicação
              <textarea
                value={motivoPublicacao}
                onChange={(evento) => setMotivoPublicacao(evento.target.value)}
                placeholder="Ex.: Ajuste da cobertura da madrugada"
                maxLength={180}
                autoFocus
              />
              <small>{motivoPublicacao.trim().length}/180 caracteres</small>
            </label>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => setPublicacaoPendente(false)}>Cancelar</button>
              <button
                className="primary-button"
                type="button"
                disabled={processando || (revisaoAtual > 0 && motivoPublicacao.trim().length < 3)}
                onClick={() => void publicar()}
              >
                {processando ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
                Publicar e notificar
              </button>
            </div>
          </section>
        </div>
      )}

      {celulaEditando && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCelulaEditando(null)}>
          <section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title" onMouseDown={(evento) => evento.stopPropagation()}>
            <div className="panel-title">
              <div><p className="eyebrow">{celulaEditando.data}</p><h2 id="edit-title">Editar célula</h2><p>{celulaEditando.documento.login}</p></div>
              <button className="icon-button" type="button" onClick={() => setCelulaEditando(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="code-picker">
              {Object.values(catalogo).map((tipo) => (
                <button key={tipo.codigo} type="button" data-code={tipo.codigo} onClick={() => editarCelula(tipo.codigo)}>
                  <span className="shift-chip" data-code={tipo.codigo}>{tipo.codigo}</span>
                  <strong>{tipo.descricao}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {revisaoParaRestaurar && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setRevisaoParaRestaurar(null)}>
          <section
            className="edit-modal rollback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rollback-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Rollback seguro</p>
                <h2 id="rollback-title">Restaurar revisão {revisaoParaRestaurar.revisao}?</h2>
                <p>A revisão atual não será apagada. Uma nova revisão de rollback será registrada.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setRevisaoParaRestaurar(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => setRevisaoParaRestaurar(null)}>Cancelar</button>
              <button className="primary-button" type="button" disabled={processando} onClick={() => void restaurar()}>
                <RotateCcw size={16} /> Criar rollback
              </button>
            </div>
          </section>
        </div>
      )}
    </AppFrame>
  );
}
