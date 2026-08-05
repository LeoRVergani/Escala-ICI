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
  Ban,
  Bell,
  BellRing,
  CheckCircle2,
  FileSpreadsheet,
  Filter,
  HelpCircle,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserMinus,
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
  conciliarPlanilha,
  contarPendenciasConciliacao,
  ignorarLinha,
  loginParaUidComConciliacao,
  marcarPendente,
  publicacaoBloqueadaPorConciliacao,
  resolverManualmente,
} from '@/lib/conciliacaoUsuarios';
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
  adicionarMembroRascunho,
  atualizarAliasesPlanilha,
  escritaAdministrativaHabilitada,
  excluirRascunho,
  publicarEscalas,
  reverterPublicacao,
  salvarRascunho,
  salvarUsuario,
  salvarUsuarios,
} from '@/lib/firebase/writeRepository';
import { sair } from '@/lib/firebase/authRepository';
import { mensagemErroFirebase } from '@/lib/firebase/errors';
import { ambienteFirebaseAtual } from '@/lib/firebase/shared';
import {
  construirIndiceAlertasGrade,
  gerarAlertasEscala,
  type AlertaEscala,
} from '@/lib/alertasEscala';
import {
  adicionarMembroGrade,
  criarMembroGrade,
  membroJaNaGrade,
  removerMembroGrade,
} from '@/lib/gradeMembros';
import { mapaLogins, normalizarAliasesPlanilha, novoUsuario, validarEdicaoUsuario } from '@/lib/importUsers';
import type { EventoEscala, LinhaConciliacao, PublicacaoEscala, Usuario } from '@/lib/modelos';

type Tela = 'visao' | 'importar' | 'escalas' | 'grade' | 'usuarios';

function formatarDataCurta(dataIso: string): string {
  const [, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}`;
}

function formatarHorasDescanso(horas: number): string {
  const inteiras = Math.floor(horas);
  const minutos = Math.round((horas - inteiras) * 60);
  return minutos === 0 ? `${inteiras}h` : `${inteiras}h${String(minutos).padStart(2, '0')}`;
}

interface AlertasOperacionaisBellProps {
  alertas: AlertaEscala[];
  usuarios: Usuario[];
  aberta: boolean;
  onAlternar: () => void;
  onFocarGrade: () => void;
}

function AlertasOperacionaisBell({
  alertas,
  usuarios,
  aberta,
  onAlternar,
  onFocarGrade,
}: AlertasOperacionaisBellProps) {
  function nomeColaborador(usuarioUid: string, login: string): string {
    return usuarios.find((item) => item.uid === usuarioUid)?.nome ?? login;
  }

  return (
    <div className="notification-center">
      <button
        className={`icon-button notification-button ${alertas.length ? 'has-unread' : ''}`}
        type="button"
        onClick={onAlternar}
        aria-label={`${alertas.length} alerta(s) operacional(is) da escala`}
        aria-expanded={aberta}
      >
        {alertas.length ? <BellRing size={19} /> : <Bell size={19} />}
        {alertas.length > 0 && <span className="notification-badge">{Math.min(alertas.length, 9)}</span>}
      </button>
      {aberta && (
        <section className="notification-popover alert-popover" aria-label="Alertas operacionais da escala">
          <header>
            <div>
              <strong>Alertas operacionais</strong>
              <span>{alertas.length ? `${alertas.length} ativo(s)` : 'Nenhuma violação encontrada'}</span>
            </div>
            {alertas.length > 0 && (
              <button type="button" onClick={onFocarGrade}>Ver na grade</button>
            )}
          </header>
          <div className="notification-list">
            {alertas.length === 0 ? (
              <div className="notification-empty"><ShieldCheck size={22} /><span>6x1 e descanso mínimo dentro da regra.</span></div>
            ) : alertas.map((alerta, indice) => (
              <article key={`${alerta.tipo}-${alerta.usuarioUid}-${indice}`} className="alert-item">
                <AlertTriangle
                  size={15}
                  className={alerta.tipo === 'SEQUENCIA_6X1' ? 'alert-icon-critico' : 'alert-icon-aviso'}
                />
                {alerta.tipo === 'SEQUENCIA_6X1' ? (
                  <div>
                    <strong>{nomeColaborador(alerta.usuarioUid, alerta.login)} — 7 dias consecutivos de trabalho</strong>
                    <small>
                      Dia crítico: {formatarDataCurta(alerta.diaCritico)} · Período:{' '}
                      {formatarDataCurta(alerta.periodoInicio)} a {formatarDataCurta(alerta.periodoFim)}
                    </small>
                  </div>
                ) : (
                  <div>
                    <strong>{nomeColaborador(alerta.usuarioUid, alerta.login)} — descanso inferior a 11 horas</strong>
                    <small>
                      Anterior: {formatarDataCurta(alerta.dataAnterior)} {alerta.horarioAnterior} · Seguinte:{' '}
                      {formatarDataCurta(alerta.dataAtual)} {alerta.horarioAtual} · Descanso calculado:{' '}
                      {formatarHorasDescanso(alerta.descansoHoras)}
                    </small>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface FormularioUsuario {
  uid: string | null;
  nome: string;
  email: string;
  login: string;
  cargo: string;
  nivelHierarquico: number;
  turnoPadrao: string;
  ativo: boolean;
  aliasesPlanilha: string[];
  uidAutenticacao: string;
}

const STATUS_CONCILIACAO_LABEL: Record<LinhaConciliacao['status'], string> = {
  VINCULADO_UID: 'Vinculado automaticamente por UID/e-mail',
  VINCULADO_ALIAS: 'Vinculado por alias',
  PRECISA_MAPEAR: 'Precisa mapear',
  USUARIO_INATIVO: 'Usuário inativo',
  USUARIO_NAO_ENCONTRADO: 'Usuário não encontrado',
  CONFLITO_ALIAS: 'Conflito de aliases',
  IGNORADA: 'Ignorada',
};

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
  const [erroPublicacao, setErroPublicacao] = useState('');
  const [motivoPublicacao, setMotivoPublicacao] = useState('');
  const [publicacaoExpandida, setPublicacaoExpandida] = useState<string | null>(null);
  const [detalhesPublicacao, setDetalhesPublicacao] = useState<Record<string, EventoEscala[]>>({});
  const [linhasConciliacao, setLinhasConciliacao] = useState<LinhaConciliacao[]>([]);
  const [formularioUsuario, setFormularioUsuario] = useState<FormularioUsuario | null>(null);
  const [errosFormularioUsuario, setErrosFormularioUsuario] = useState<string[]>([]);
  const [novoAliasDraft, setNovoAliasDraft] = useState('');
  const [descarteRascunhoPendente, setDescarteRascunhoPendente] = useState(false);
  const [membroGradeDraft, setMembroGradeDraft] = useState<{ usuarioUid: string; turnoPadrao: string } | null>(null);
  const [removerMembroPendente, setRemoverMembroPendente] = useState<TurnosMes | null>(null);
  const [alertasAbertos, setAlertasAbertos] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const escritaBloqueada = !modoDemo && !escritaAdministrativaHabilitada;
  const conciliacaoBloqueiaPublicacao = publicacaoBloqueadaPorConciliacao(linhasConciliacao);
  const pendenciasConciliacao = contarPendenciasConciliacao(linhasConciliacao);

  const documentos = useMemo(
    () => resultado?.documentos ?? [],
    [resultado?.documentos],
  );
  const publicados = documentos.filter(({ status }) => status === 'PUBLICADA');
  const alertasOperacionais = useMemo(
    () => gerarAlertasEscala(documentos, catalogo),
    [documentos, catalogo],
  );
  const indiceAlertasGrade = useMemo(
    () => construirIndiceAlertasGrade(documentos, catalogo),
    [documentos, catalogo],
  );
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

  function reparsear(buffer: ArrayBuffer, loginParaUid: Record<string, string>): ResultadoParse {
    return parsePlanilhaEscala(buffer, {
      equipeId: usuario?.equipeId ?? EQUIPE_DEMO.id,
      competencia: '2026-08',
      catalogo,
      loginParaUid,
    });
  }

  /**
   * Concilia os nomes da planilha com os usuários cadastrados e, quando a
   * conciliação resolve algo que o login exato não resolveu, reprocessa a
   * planilha com o mapa estendido — sem precisar reescrever o parser.
   */
  function aplicarConciliacao(buffer: ArrayBuffer, linhas: LinhaConciliacao[]) {
    setLinhasConciliacao(linhas);
    const parseado = linhas.some((linha) => linha.usuarioUid !== null)
      ? reparsear(buffer, loginParaUidComConciliacao(mapaLogins(usuarios), linhas))
      : reparsear(buffer, mapaLogins(usuarios));
    setResultado(parseado);
    return parseado;
  }

  function interpretar(buffer: ArrayBuffer, nome: string) {
    setProcessando(true);
    setMensagem('');
    try {
      const primeiraLeitura = reparsear(buffer, mapaLogins(usuarios));
      const linhas = conciliarPlanilha(
        primeiraLeitura.documentos.map((documento) => documento.login),
        usuarios,
      );
      setArquivo(buffer);
      setNomeArquivo(nome);
      const parseado = aplicarConciliacao(buffer, linhas);
      setCorrecoes({});
      if (!parseado.ok) {
        setMensagem(`${parseado.erros.length} erro(s) encontrado(s). Corrija antes de salvar.`);
      } else if (publicacaoBloqueadaPorConciliacao(linhas)) {
        setMensagem('Revise a conciliação de nomes da planilha antes de salvar ou publicar.');
      }
    } catch (falha) {
      setMensagem(falha instanceof Error ? falha.message : 'Arquivo inválido.');
    } finally {
      setProcessando(false);
    }
  }

  function selecionarVinculoConciliacao(linha: LinhaConciliacao, usuarioUid: string) {
    if (arquivo === null) {
      return;
    }
    const escolhido = usuarios.find((item) => item.uid === usuarioUid);
    if (escolhido === undefined) {
      return;
    }
    aplicarConciliacao(
      arquivo,
      linhasConciliacao.map((item) => (item === linha ? resolverManualmente(item, escolhido) : item)),
    );
  }

  function marcarConciliacaoPendente(linha: LinhaConciliacao) {
    if (arquivo === null) {
      return;
    }
    aplicarConciliacao(
      arquivo,
      linhasConciliacao.map((item) => (item === linha ? marcarPendente(item) : item)),
    );
  }

  function ignorarConciliacao(linha: LinhaConciliacao) {
    if (arquivo === null) {
      return;
    }
    aplicarConciliacao(
      arquivo,
      linhasConciliacao.map((item) => (item === linha ? ignorarLinha(item) : item)),
    );
  }

  async function salvarAliasConciliacao(linha: LinhaConciliacao) {
    if (linha.usuarioUid === null) {
      return;
    }
    const escolhido = usuarios.find((item) => item.uid === linha.usuarioUid);
    if (escolhido === undefined) {
      return;
    }
    const aliasesAtualizados = normalizarAliasesPlanilha([...(escolhido.aliasesPlanilha ?? []), linha.nomePlanilha]);
    const agora = new Date().toISOString();
    try {
      // Atualiza só os aliases + o carimbo de data — não regrava o usuário
      // inteiro, então um cadastro antigo sem `criadoEm` não é afetado.
      if (!modoDemo) {
        await atualizarAliasesPlanilha(escolhido.uid, aliasesAtualizados);
      }
      const atualizado: Usuario = { ...escolhido, aliasesPlanilha: aliasesAtualizados, atualizadoEm: agora };
      setUsuarios((atuais) => atuais.map((item) => (item.uid === atualizado.uid ? atualizado : item)));
      setMensagem(`Alias "${linha.nomePlanilha}" salvo para ${atualizado.nome}.`);
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível salvar o alias.', ambienteFirebaseAtual));
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
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível cadastrar os usuários faltantes.', ambienteFirebaseAtual));
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
    if (conciliacaoBloqueiaPublicacao) {
      setMensagem('Resolva as pendências de conciliação de nomes antes de salvar.');
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
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível salvar.', ambienteFirebaseAtual));
    } finally {
      setProcessando(false);
    }
  }

  async function publicar() {
    setErroPublicacao('');
    if (resultado === null || usuario === null || !resultado.ok) {
      setErroPublicacao('Corrija todos os logins e inconsistências antes de publicar.');
      return;
    }
    if (escritaBloqueada) {
      setErroPublicacao('A publicação está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    if (conciliacaoBloqueiaPublicacao) {
      setErroPublicacao('Resolva as pendências de conciliação de nomes antes de publicar.');
      return;
    }
    if (revisaoAtual > 0 && motivoPublicacao.trim().length < 3) {
      setErroPublicacao('Informe um motivo curto para explicar o que mudou nesta publicação.');
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
      const texto = mensagemErroFirebase(falha, 'Falha na publicação.', ambienteFirebaseAtual);
      // O modal continua aberto (não chamamos setPublicacaoPendente(false))
      // e mostra o erro localmente — o toast global fica atrás do modal
      // visualmente, então não basta avisar só por ele.
      setErroPublicacao(texto);
      setMensagem(texto);
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
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível carregar os detalhes da revisão.', ambienteFirebaseAtual));
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
      setMensagem(mensagemErroFirebase(falha, 'Falha ao restaurar a revisão.', ambienteFirebaseAtual));
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

  function abrirNovoUsuario() {
    setFormularioUsuario({
      uid: null,
      nome: '',
      email: '',
      login: '',
      cargo: 'ANALISTA_SOC',
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
      aliasesPlanilha: [],
      uidAutenticacao: '',
    });
    setErrosFormularioUsuario([]);
    setNovoAliasDraft('');
  }

  function abrirEdicaoUsuario(item: Usuario) {
    setFormularioUsuario({
      uid: item.uid,
      nome: item.nome,
      email: item.email,
      login: item.login,
      cargo: item.cargo,
      nivelHierarquico: item.nivelHierarquico,
      turnoPadrao: item.turnoPadrao,
      ativo: item.ativo,
      aliasesPlanilha: item.aliasesPlanilha ?? [],
      uidAutenticacao: '',
    });
    setErrosFormularioUsuario([]);
    setNovoAliasDraft('');
  }

  function fecharFormularioUsuario() {
    setFormularioUsuario(null);
    setErrosFormularioUsuario([]);
    setNovoAliasDraft('');
  }

  function adicionarAliasDraft() {
    if (formularioUsuario === null || novoAliasDraft.trim() === '') {
      return;
    }
    setFormularioUsuario({
      ...formularioUsuario,
      aliasesPlanilha: normalizarAliasesPlanilha([...formularioUsuario.aliasesPlanilha, novoAliasDraft]),
    });
    setNovoAliasDraft('');
  }

  function removerAliasDraft(alias: string) {
    if (formularioUsuario === null) {
      return;
    }
    setFormularioUsuario({
      ...formularioUsuario,
      aliasesPlanilha: formularioUsuario.aliasesPlanilha.filter((item) => item !== alias),
    });
  }

  async function salvarFormularioUsuario() {
    if (formularioUsuario === null || usuario === null) {
      return;
    }
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }

    let candidato: Usuario;
    if (formularioUsuario.uid === null) {
      candidato = {
        ...novoUsuario(
          usuarios.length + 1,
          usuario,
          formularioUsuario.login || `novo.login${usuarios.length + 1}`,
          formularioUsuario.ativo,
          formularioUsuario.uidAutenticacao,
        ),
        nome: formularioUsuario.nome,
        email: formularioUsuario.email,
        cargo: formularioUsuario.cargo,
        nivelHierarquico: formularioUsuario.nivelHierarquico,
        turnoPadrao: formularioUsuario.turnoPadrao,
        aliasesPlanilha: formularioUsuario.aliasesPlanilha,
      };
    } else {
      const original = usuarios.find((item) => item.uid === formularioUsuario.uid);
      if (original === undefined) {
        return;
      }
      candidato = {
        ...original,
        nome: formularioUsuario.nome,
        email: formularioUsuario.email,
        login: formularioUsuario.login,
        cargo: formularioUsuario.cargo,
        nivelHierarquico: formularioUsuario.nivelHierarquico,
        turnoPadrao: formularioUsuario.turnoPadrao,
        ativo: formularioUsuario.ativo,
        aliasesPlanilha: formularioUsuario.aliasesPlanilha,
        atualizadoEm: new Date().toISOString(),
      };
    }

    const erros = validarEdicaoUsuario(candidato, usuarios);
    if (erros.length > 0) {
      setErrosFormularioUsuario(erros);
      return;
    }

    try {
      if (!modoDemo) {
        await salvarUsuario(candidato);
      }
      setUsuarios((atuais) => (atuais.some((item) => item.uid === candidato.uid)
        ? atuais.map((item) => (item.uid === candidato.uid ? candidato : item))
        : [...atuais, candidato]));
      setMensagem(formularioUsuario.uid === null
        ? 'Usuário cadastrado com sucesso.'
        : 'Usuário atualizado com sucesso.');
      fecharFormularioUsuario();
    } catch (falha) {
      setErrosFormularioUsuario([mensagemErroFirebase(falha, 'Não foi possível salvar o usuário.', ambienteFirebaseAtual)]);
    }
  }

  async function alternarAtivoUsuario(item: Usuario) {
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    const atualizado: Usuario = { ...item, ativo: !item.ativo, atualizadoEm: new Date().toISOString() };
    try {
      if (!modoDemo) {
        await salvarUsuario(atualizado);
      }
      setUsuarios((atuais) => atuais.map((existente) => (existente.uid === item.uid ? atualizado : existente)));
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível atualizar o status do usuário.', ambienteFirebaseAtual));
    }
  }

  function abrirAdicionarMembroGrade() {
    setMembroGradeDraft({ usuarioUid: '', turnoPadrao: 'M' });
  }

  function fecharAdicionarMembroGrade() {
    setMembroGradeDraft(null);
  }

  async function confirmarAdicionarMembroGrade() {
    if (membroGradeDraft === null || resultado === null || usuario === null) {
      return;
    }
    if (escritaBloqueada) {
      setMensagem('A escrita está bloqueada. Use o laboratório local ou um ambiente administrativo aprovado.');
      return;
    }
    const colaborador = usuarios.find((item) => item.uid === membroGradeDraft.usuarioUid);
    if (colaborador === undefined) {
      setMensagem('Selecione um colaborador cadastrado.');
      return;
    }
    if (membroJaNaGrade(resultado.documentos, colaborador.uid)) {
      setMensagem('Este colaborador já está na grade desta competência.');
      return;
    }
    const referencia = {
      equipeId: usuario.equipeId,
      competencia: resultado.documentos[0]?.competencia ?? '2026-08',
      periodoInicio: resultado.periodoInicio,
      periodoFim: resultado.periodoFim,
    };
    const membro = criarMembroGrade(colaborador, membroGradeDraft.turnoPadrao, referencia, catalogo);
    try {
      if (!modoDemo) {
        await adicionarMembroRascunho(membro);
      }
      setResultado((atual) => (atual === null ? atual : {
        ...atual,
        documentos: adicionarMembroGrade(atual.documentos, membro),
      }));
      setMensagem(`${colaborador.nome} incluído(a) na grade desta competência.`);
      setMembroGradeDraft(null);
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível incluir o colaborador na grade.', ambienteFirebaseAtual));
    }
  }

  async function confirmarRemocaoMembroGrade() {
    if (removerMembroPendente === null) {
      return;
    }
    const documento = removerMembroPendente;
    setRemoverMembroPendente(null);
    try {
      if (!modoDemo) {
        await excluirRascunho(documento);
      }
      setResultado((atual) => (atual === null ? atual : {
        ...atual,
        documentos: removerMembroGrade(atual.documentos, documento.usuarioUid),
      }));
      setMensagem('Colaborador removido da grade desta competência.');
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível remover o colaborador da grade. Se a escala já foi publicada, não é possível remover por aqui.', ambienteFirebaseAtual));
    }
  }

  async function descartarRascunho() {
    setDescarteRascunhoPendente(false);
    if (resultado === null) {
      return;
    }
    setProcessando(true);
    try {
      if (!modoDemo) {
        for (const documento of resultado.documentos) {
          if (documento.status === 'RASCUNHO') {
            await excluirRascunho(documento);
          }
        }
      }
      setResultado(null);
      setArquivo(null);
      setLinhasConciliacao([]);
      setTela('importar');
      setMensagem('Rascunho descartado.');
    } catch (falha) {
      setMensagem(mensagemErroFirebase(falha, 'Não foi possível descartar o rascunho.', ambienteFirebaseAtual));
    } finally {
      setProcessando(false);
    }
  }

  async function encerrarSessao() {
    await sair();
    setUsuario(null);
    setResultado(null);
    setLinhasConciliacao([]);
    setFormularioUsuario(null);
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
      acoesTopo={(
        <AlertasOperacionaisBell
          alertas={alertasOperacionais}
          usuarios={usuarios}
          aberta={alertasAbertos}
          onAlternar={() => setAlertasAbertos((atual) => !atual)}
          onFocarGrade={() => {
            setAlertasAbertos(false);
            setTela('grade');
          }}
        />
      )}
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
                disabled={!resultado?.ok || processando || escritaBloqueada || conciliacaoBloqueiaPublicacao}
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

          {linhasConciliacao.length > 0 && (
            <article className="panel conciliation-panel">
              <div className="panel-title">
                <div>
                  <h2>Conciliação de nomes da planilha</h2>
                  <p>Confira quem cada nome da planilha representa antes de salvar ou publicar.</p>
                </div>
                <span className={`status-badge ${pendenciasConciliacao ? 'warning' : 'success'}`}>
                  {pendenciasConciliacao ? `${pendenciasConciliacao} pendência(s)` : 'Tudo conciliado'}
                </span>
              </div>
              <div className="table-scroll">
                <table className="data-table conciliation-table">
                  <thead>
                    <tr>
                      <th>Nome encontrado na planilha</th>
                      <th>Usuário vinculado</th>
                      <th>Status</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasConciliacao.map((linha) => {
                      const vinculado = usuarios.find((item) => item.uid === linha.usuarioUid);
                      return (
                        <tr key={linha.nomePlanilha} data-status={linha.status}>
                          <td>{linha.nomePlanilha}</td>
                          <td>
                            <select
                              value={linha.usuarioUid ?? ''}
                              onChange={(evento) => {
                                if (evento.target.value) {
                                  selecionarVinculoConciliacao(linha, evento.target.value);
                                }
                              }}
                              aria-label={`Usuário vinculado a ${linha.nomePlanilha}`}
                            >
                              <option value="">Selecionar usuário…</option>
                              {usuarios.map((item) => (
                                <option key={item.uid} value={item.uid}>
                                  {item.nome}{item.ativo ? '' : ' (inativo)'}
                                </option>
                              ))}
                            </select>
                            {linha.status === 'CONFLITO_ALIAS' && (
                              <small>
                                Candidatos: {linha.candidatos
                                  .map((uid) => usuarios.find((item) => item.uid === uid)?.nome ?? uid)
                                  .join(', ')}
                              </small>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge ${
                              linha.status === 'VINCULADO_UID' || linha.status === 'VINCULADO_ALIAS' || linha.status === 'IGNORADA'
                                ? 'success'
                                : 'warning'
                            }`}
                            >
                              {STATUS_CONCILIACAO_LABEL[linha.status]}
                            </span>
                          </td>
                          <td>
                            <div className="conciliation-actions">
                              {linha.usuarioUid !== null && linha.status !== 'VINCULADO_UID' && (
                                <button
                                  className="icon-button"
                                  type="button"
                                  title={`Salvar "${linha.nomePlanilha}" como alias de ${vinculado?.nome ?? ''}`}
                                  disabled={escritaBloqueada}
                                  onClick={() => void salvarAliasConciliacao(linha)}
                                >
                                  <Link2 size={15} />
                                </button>
                              )}
                              {linha.status !== 'PRECISA_MAPEAR' && linha.status !== 'IGNORADA' && (
                                <button
                                  className="icon-button"
                                  type="button"
                                  title="Marcar como pendente"
                                  onClick={() => marcarConciliacaoPendente(linha)}
                                >
                                  <HelpCircle size={15} />
                                </button>
                              )}
                              {linha.status !== 'IGNORADA' && (
                                <button
                                  className="icon-button"
                                  type="button"
                                  title="Ignorar esta linha"
                                  onClick={() => ignorarConciliacao(linha)}
                                >
                                  <Ban size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
              <ScheduleGrid
                documentos={resultado.documentos}
                usuarios={usuarios}
                catalogo={catalogo}
                indiceAlertas={indiceAlertasGrade}
                compacta
              />
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
              {documentos.length > 0 && publicados.length !== documentos.length && (
                <button
                  className="secondary-button danger-button"
                  type="button"
                  disabled={processando || escritaBloqueada}
                  onClick={() => setDescarteRascunhoPendente(true)}
                >
                  <Trash2 size={16} /> Descartar rascunho
                </button>
              )}
              <button
                className="primary-button"
                type="button"
                disabled={!documentos.length || !resultado?.ok || processando || escritaBloqueada || conciliacaoBloqueiaPublicacao}
                onClick={() => {
                  setErroPublicacao('');
                  setPublicacaoPendente(true);
                }}
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
            <div>
              <p className="eyebrow">Revisão completa</p>
              <h1>Grade da equipe</h1>
              <p>Clique em uma célula para editar o rascunho.</p>
            </div>
            <div className="grade-header-actions">
              <span className={`status-badge ${publicados.length === documentos.length && documentos.length ? 'success' : 'warning'}`}>
                {publicados.length === documentos.length && documentos.length ? 'Revisão publicada' : 'Rascunho não publicado'}
              </span>
              <button
                className="secondary-button"
                type="button"
                disabled={escritaBloqueada || !usuarios.length}
                onClick={abrirAdicionarMembroGrade}
              >
                <UserPlus size={16} /> Adicionar colaborador
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!documentos.length || escritaBloqueada}
                onClick={() => void salvar()}
              >
                <Save size={16} /> Salvar alterações
              </button>
            </div>
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
              agruparPorPeriodo
              indiceAlertas={indiceAlertasGrade}
              onEditar={(documento, data, dia) => setCelulaEditando({ documento, data, dia })}
              onRemover={(documento) => setRemoverMembroPendente(documento)}
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
              onClick={abrirNovoUsuario}
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
                <thead><tr><th>Colaborador</th><th>Login de importação</th><th>Turno</th><th>Perfil</th><th>Status</th><th>Aliases da planilha</th><th>Ações</th></tr></thead>
                <tbody>
                  {usuarios
                    .filter((item) => `${item.nome} ${item.login}`.toLowerCase().includes(buscaUsuario.toLowerCase()))
                    .map((item) => (
                      <tr key={item.uid}>
                        <td><strong>{item.nome}</strong><small>{item.email}</small></td>
                        <td><code className="login-code">{item.login}</code></td>
                        <td>{item.turnoPadrao}</td>
                        <td>{item.cargo}</td>
                        <td>
                          <span className={`status-badge ${item.ativo ? 'success' : 'neutral'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span>
                          {item.pendenteVinculo && (
                            <span className="status-badge warning" title="Este cadastro ainda não tem uma conta de acesso confirmada.">
                              Pendente de vínculo
                            </span>
                          )}
                          {item.substituidoPorUid && (
                            <span
                              className="status-badge neutral"
                              title="Substituído por outro cadastro ativo."
                            >
                              Substituído
                            </span>
                          )}
                        </td>
                        <td>
                          {(item.aliasesPlanilha ?? []).length === 0
                            ? <small className="empty-inline">Nenhum</small>
                            : (item.aliasesPlanilha ?? []).map((alias) => (
                              <span className="alias-chip" key={alias}>{alias}</span>
                            ))}
                        </td>
                        <td>
                          <div className="user-row-actions">
                            <button
                              className="icon-button"
                              type="button"
                              title="Editar usuário"
                              disabled={escritaBloqueada}
                              onClick={() => abrirEdicaoUsuario(item)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-button"
                              type="button"
                              title={item.ativo ? 'Desativar' : 'Ativar'}
                              disabled={escritaBloqueada}
                              onClick={() => void alternarAtivoUsuario(item)}
                            >
                              <Power size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {publicacaoPendente && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => { setPublicacaoPendente(false); setErroPublicacao(''); }}>
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
              <button
                className="icon-button"
                type="button"
                onClick={() => { setPublicacaoPendente(false); setErroPublicacao(''); }}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
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
            {erroPublicacao && (
              <div className="alert error" role="alert">{erroPublicacao}</div>
            )}
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => { setPublicacaoPendente(false); setErroPublicacao(''); }}>Cancelar</button>
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

      {descarteRascunhoPendente && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setDescarteRascunhoPendente(false)}>
          <section
            className="edit-modal rollback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Ação local, sem afetar a escala publicada</p>
                <h2 id="discard-title">Descartar este rascunho?</h2>
                <p>
                  Apenas documentos ainda não publicados são removidos. A última escala
                  publicada da equipe continua disponível para o App.
                </p>
              </div>
              <button className="icon-button" type="button" onClick={() => setDescarteRascunhoPendente(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => setDescarteRascunhoPendente(false)}>Cancelar</button>
              <button className="primary-button danger-button" type="button" disabled={processando} onClick={() => void descartarRascunho()}>
                {processando ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
                Descartar rascunho
              </button>
            </div>
          </section>
        </div>
      )}

      {membroGradeDraft && (
        <div className="modal-backdrop" role="presentation" onMouseDown={fecharAdicionarMembroGrade}>
          <section
            className="edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-membro-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Grade desta competência</p>
                <h2 id="add-membro-title">Adicionar colaborador à grade</h2>
                <p>O colaborador entra como rascunho, sem nenhum dia preenchido ainda.</p>
              </div>
              <button className="icon-button" type="button" onClick={fecharAdicionarMembroGrade} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="user-form-grid">
              <label className="user-form-full">
                Colaborador
                <select
                  value={membroGradeDraft.usuarioUid}
                  onChange={(evento) => setMembroGradeDraft({ ...membroGradeDraft, usuarioUid: evento.target.value })}
                >
                  <option value="">Selecionar usuário cadastrado…</option>
                  {usuarios
                    .filter((item) => !membroJaNaGrade(documentos, item.uid))
                    .map((item) => (
                      <option key={item.uid} value={item.uid}>
                        {item.nome}{item.ativo ? '' : ' (inativo)'}
                      </option>
                    ))}
                </select>
              </label>
              <label className="user-form-full">
                Período / turno base
                <select
                  value={membroGradeDraft.turnoPadrao}
                  onChange={(evento) => setMembroGradeDraft({ ...membroGradeDraft, turnoPadrao: evento.target.value })}
                >
                  {Object.values(catalogo).map((tipo) => (
                    <option key={tipo.codigo} value={tipo.codigo}>{tipo.descricao}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={fecharAdicionarMembroGrade}>Cancelar</button>
              <button
                className="primary-button"
                type="button"
                disabled={!membroGradeDraft.usuarioUid}
                onClick={() => void confirmarAdicionarMembroGrade()}
              >
                <UserPlus size={16} /> Adicionar à grade
              </button>
            </div>
          </section>
        </div>
      )}

      {removerMembroPendente && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setRemoverMembroPendente(null)}>
          <section
            className="edit-modal rollback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-membro-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">Ação local, o cadastro do usuário não é afetado</p>
                <h2 id="remove-membro-title">
                  Remover {usuarios.find((item) => item.uid === removerMembroPendente.usuarioUid)?.nome
                    ?? removerMembroPendente.login} da grade?
                </h2>
                <p>
                  Remove apenas o colaborador desta competência. O usuário continua
                  cadastrado e pode ser incluído de novo quando for preciso.
                </p>
              </div>
              <button className="icon-button" type="button" onClick={() => setRemoverMembroPendente(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={() => setRemoverMembroPendente(null)}>Cancelar</button>
              <button className="primary-button danger-button" type="button" onClick={() => void confirmarRemocaoMembroGrade()}>
                <UserMinus size={16} /> Remover da grade
              </button>
            </div>
          </section>
        </div>
      )}

      {formularioUsuario && (
        <div className="modal-backdrop" role="presentation" onMouseDown={fecharFormularioUsuario}>
          <section
            className="edit-modal user-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="panel-title">
              <div>
                <p className="eyebrow">{formularioUsuario.uid === null ? 'Novo colaborador' : 'Editar colaborador'}</p>
                <h2 id="user-form-title">
                  {formularioUsuario.uid === null ? 'Cadastrar usuário' : formularioUsuario.nome || 'Editar usuário'}
                </h2>
              </div>
              <button className="icon-button" type="button" onClick={fecharFormularioUsuario} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="user-form-grid">
              <label>
                Nome
                <input
                  value={formularioUsuario.nome}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, nome: evento.target.value })}
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={formularioUsuario.email}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, email: evento.target.value })}
                />
              </label>
              <label>
                Login (planilha)
                <input
                  value={formularioUsuario.login}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, login: evento.target.value })}
                />
              </label>
              <label>
                Cargo
                <input
                  value={formularioUsuario.cargo}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, cargo: evento.target.value })}
                />
              </label>
              <label>
                Equipe
                <input value={usuario?.equipeId ?? ''} disabled />
              </label>
              <label>
                Nível hierárquico
                <input
                  type="number"
                  min={1}
                  value={formularioUsuario.nivelHierarquico}
                  onChange={(evento) => setFormularioUsuario({
                    ...formularioUsuario,
                    nivelHierarquico: Number(evento.target.value),
                  })}
                />
              </label>
              <label>
                Turno padrão
                <select
                  value={formularioUsuario.turnoPadrao}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, turnoPadrao: evento.target.value })}
                >
                  {Object.values(catalogo).map((tipo) => (
                    <option key={tipo.codigo} value={tipo.codigo}>{tipo.descricao}</option>
                  ))}
                </select>
              </label>
              <label className="user-form-active">
                <input
                  type="checkbox"
                  checked={formularioUsuario.ativo}
                  onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, ativo: evento.target.checked })}
                />
                <span>Ativo</span>
              </label>
              {formularioUsuario.uid === null && (
                <label className="user-form-full">
                  UID de autenticação (opcional)
                  <input
                    value={formularioUsuario.uidAutenticacao}
                    onChange={(evento) => setFormularioUsuario({ ...formularioUsuario, uidAutenticacao: evento.target.value })}
                    placeholder="Cole aqui o UID já criado no Firebase Authentication"
                  />
                  <small>
                    Sem preencher, o cadastro fica marcado como &quot;pendente de vínculo&quot; até alguém
                    cadastrar um novo usuário com o UID real — o UID do documento não pode ser
                    trocado depois de criado.
                  </small>
                </label>
              )}
              <label className="user-form-full">
                Aliases da planilha
                <div className="alias-editor">
                  <div className="alias-editor-list">
                    {formularioUsuario.aliasesPlanilha.length === 0 && (
                      <small className="empty-inline">Nenhum alias cadastrado.</small>
                    )}
                    {formularioUsuario.aliasesPlanilha.map((alias) => (
                      <span className="alias-chip" key={alias}>
                        {alias}
                        <button type="button" onClick={() => removerAliasDraft(alias)} aria-label={`Remover alias ${alias}`}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="alias-editor-add">
                    <input
                      value={novoAliasDraft}
                      onChange={(evento) => setNovoAliasDraft(evento.target.value)}
                      onKeyDown={(evento) => {
                        if (evento.key === 'Enter') {
                          evento.preventDefault();
                          adicionarAliasDraft();
                        }
                      }}
                      placeholder="Nome como aparece na planilha"
                    />
                    <button className="secondary-button compact-button" type="button" onClick={adicionarAliasDraft}>
                      Adicionar
                    </button>
                  </div>
                </div>
              </label>
            </div>
            {errosFormularioUsuario.length > 0 && (
              <div className="alert error">
                <ul>
                  {errosFormularioUsuario.map((erro) => <li key={erro}>{erro}</li>)}
                </ul>
              </div>
            )}
            <div className="rollback-actions">
              <button className="secondary-button" type="button" onClick={fecharFormularioUsuario}>Cancelar</button>
              <button className="primary-button" type="button" onClick={() => void salvarFormularioUsuario()}>
                <Save size={16} /> {formularioUsuario.uid === null ? 'Cadastrar' : 'Salvar alterações'}
              </button>
            </div>
          </section>
        </div>
      )}

    </AppFrame>
  );
}
