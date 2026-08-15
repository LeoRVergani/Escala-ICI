/**
 * Hook de Lembretes do App (Fase 4) — encapsula a diferença entre Demo
 * (tudo em memória, nunca toca Firebase) e sessão real (repository +
 * realtime), para `EmployeeApp.tsx` só precisar de uma chamada em vez de
 * seis `useState`/`useEffect` espalhados.
 *
 * Segue o mesmo ciclo de listeners já usado no resto do App
 * (`podeIniciarListeners()`, `lib/sessao.ts`): só assina depois de sessão +
 * usuário + carga inicial resolvidos, nunca antes — e nunca em Demo.
 */
import { useEffect, useState } from 'react';

import { mensagemErroFirebase } from '@/lib/firebase/errors';
import {
  atualizarLembretePessoal as atualizarLembretePessoalFirebase,
  criarLembretePessoal as criarLembretePessoalFirebase,
  criarSerieLembretesPessoais as criarSerieLembretesPessoaisFirebase,
  excluirLembretePessoal as excluirLembretePessoalFirebase,
  observarLembretesAtribuidosDoUsuario,
  observarLembretesPessoais,
  type LembreteAtribuidoPersistido,
  type LembretePessoalPersistido,
} from '@/lib/firebase/lembretesRepository';
import { ambienteFirebaseAtual } from '@/lib/firebase/shared';
import {
  criarOcorrenciasSerie,
  normalizarHorarioLembrete,
  validarEntradaLembrete,
  validarEntradaSerieLembrete,
  type EntradaLembrete,
  type EntradaSerieLembrete,
} from '@/lib/lembretes';
import { primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/lembretesUi';
import { gerarUuid } from '@/lib/uuid';

export interface ParametrosUseLembretes {
  login: string | null;
  nomeGestorDemo: string;
  modoDemonstracao: boolean;
  listenersLiberados: boolean;
  mesVisivel: string;
  dataHoje: string;
}

export interface ResultadoUseLembretes {
  pessoais: LembretePessoalPersistido[];
  atribuidos: LembreteAtribuidoPersistido[];
  erro: string;
  criarPessoal: (entrada: EntradaLembrete) => Promise<void>;
  criarSeriePessoal: (entrada: EntradaSerieLembrete) => Promise<void>;
  editarPessoal: (lembreteId: string, entrada: EntradaLembrete) => Promise<void>;
  excluirPessoal: (lembreteId: string) => Promise<void>;
}

function validarOuLancar(entrada: EntradaLembrete): void {
  const erros = validarEntradaLembrete(entrada);
  if (erros.length > 0) {
    throw new Error(erros.join(' '));
  }
}

function validarSerieOuLancar(entrada: EntradaSerieLembrete): void {
  const erros = validarEntradaSerieLembrete(entrada);
  if (erros.length > 0) {
    throw new Error(erros.join(' '));
  }
}

function lembretesPessoaisDemo(dataHoje: string): LembretePessoalPersistido[] {
  const agora = '2026-08-01T09:00:00.000Z';
  return [{
    lembreteId: 'demo-lembrete-pessoal-1',
    tipo: 'PESSOAL',
    schemaVersion: 1,
    titulo: 'Revisar módulo de redes',
    descricao: 'Retomar o capítulo de segmentação antes do próximo plantão.',
    data: dataHoje,
    horario: { diaInteiro: false, horaInicio: '21:00', horaFim: null, viraDia: false },
    serieId: null,
    alertasAntecedenciaMin: [],
    criadoEm: agora,
    atualizadoEm: agora,
  }];
}

function lembretesAtribuidosDemo(dataHoje: string, nomeGestorDemo: string): LembreteAtribuidoPersistido[] {
  const agora = '2026-08-01T09:00:00.000Z';
  return [{
    lembreteId: 'demo-lembrete-atribuido-1',
    tipo: 'ATRIBUIDO',
    schemaVersion: 1,
    destinatarioLogin: 'demo',
    destinatarioEquipeId: 'EQ_SOC',
    titulo: 'Curso de segurança',
    descricao: 'Treinamento obrigatório de conscientização em segurança da informação.',
    data: dataHoje,
    horario: { diaInteiro: false, horaInicio: '09:00', horaFim: '12:00', viraDia: false },
    serieId: null,
    alertasAntecedenciaMin: [],
    criadoPorLogin: 'demo.gestor',
    criadoPorNome: nomeGestorDemo,
    status: 'ATIVO',
    criadoEm: agora,
    atualizadoEm: agora,
    canceladoEm: null,
    canceladoPorLogin: null,
  }];
}

export function useLembretes(parametros: ParametrosUseLembretes): ResultadoUseLembretes {
  const { login, nomeGestorDemo, modoDemonstracao, listenersLiberados, mesVisivel, dataHoje } = parametros;

  const [pessoaisDemo, setPessoaisDemo] = useState<LembretePessoalPersistido[]>(
    () => lembretesPessoaisDemo(dataHoje),
  );
  const [atribuidosDemo] = useState<LembreteAtribuidoPersistido[]>(
    () => lembretesAtribuidosDemo(dataHoje, nomeGestorDemo),
  );
  const [pessoaisReais, setPessoaisReais] = useState<LembretePessoalPersistido[]>([]);
  const [atribuidosReais, setAtribuidosReais] = useState<LembreteAtribuidoPersistido[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (modoDemonstracao || !listenersLiberados || login === null) {
      return undefined;
    }
    const dataInicio = primeiroDiaDoMes(mesVisivel);
    const dataFim = ultimoDiaDoMes(mesVisivel);
    const cancelarPessoais = observarLembretesPessoais(
      login,
      dataInicio,
      dataFim,
      setPessoaisReais,
      (falha) => setErro(mensagemErroFirebase(falha, 'Não foi possível acompanhar seus lembretes.', ambienteFirebaseAtual)),
    );
    const cancelarAtribuidos = observarLembretesAtribuidosDoUsuario(
      login,
      dataInicio,
      dataFim,
      setAtribuidosReais,
      (falha) => setErro(mensagemErroFirebase(falha, 'Não foi possível acompanhar lembretes atribuídos.', ambienteFirebaseAtual)),
    );
    return () => {
      cancelarPessoais();
      cancelarAtribuidos();
    };
  }, [modoDemonstracao, listenersLiberados, login, mesVisivel]);

  async function criarPessoal(entrada: EntradaLembrete): Promise<void> {
    validarOuLancar(entrada);
    if (modoDemonstracao) {
      const agora = new Date().toISOString();
      setPessoaisDemo((atual) => [...atual, {
        lembreteId: gerarUuid(),
        tipo: 'PESSOAL',
        schemaVersion: 1,
        titulo: entrada.titulo.trim(),
        descricao: entrada.descricao?.trim() || null,
        data: entrada.data,
        horario: normalizarHorarioLembrete(entrada),
        serieId: null,
        alertasAntecedenciaMin: [],
        criadoEm: agora,
        atualizadoEm: agora,
      }]);
      return;
    }
    if (login === null) {
      throw new Error('Sessão não carregada.');
    }
    await criarLembretePessoalFirebase(login, entrada);
  }

  async function criarSeriePessoal(entrada: EntradaSerieLembrete): Promise<void> {
    validarSerieOuLancar(entrada);
    if (modoDemonstracao) {
      const serieId = gerarUuid();
      const agora = new Date().toISOString();
      const ocorrencias = criarOcorrenciasSerie(entrada, serieId);
      setPessoaisDemo((atual) => [
        ...atual,
        ...ocorrencias.map((ocorrencia) => ({
          lembreteId: gerarUuid(),
          tipo: 'PESSOAL' as const,
          schemaVersion: 1 as const,
          titulo: ocorrencia.titulo,
          descricao: ocorrencia.descricao,
          data: ocorrencia.data,
          horario: ocorrencia.horario,
          serieId: ocorrencia.serieId,
          alertasAntecedenciaMin: ocorrencia.alertasAntecedenciaMin,
          criadoEm: agora,
          atualizadoEm: agora,
        })),
      ]);
      return;
    }
    if (login === null) {
      throw new Error('Sessão não carregada.');
    }
    await criarSerieLembretesPessoaisFirebase(login, entrada);
  }

  async function editarPessoal(lembreteId: string, entrada: EntradaLembrete): Promise<void> {
    validarOuLancar(entrada);
    if (modoDemonstracao) {
      setPessoaisDemo((atual) => atual.map((item) => item.lembreteId === lembreteId ? {
        ...item,
        titulo: entrada.titulo.trim(),
        descricao: entrada.descricao?.trim() || null,
        data: entrada.data,
        horario: normalizarHorarioLembrete(entrada),
        atualizadoEm: new Date().toISOString(),
      } : item));
      return;
    }
    if (login === null) {
      throw new Error('Sessão não carregada.');
    }
    await atualizarLembretePessoalFirebase(login, lembreteId, entrada);
  }

  async function excluirPessoal(lembreteId: string): Promise<void> {
    if (modoDemonstracao) {
      setPessoaisDemo((atual) => atual.filter((item) => item.lembreteId !== lembreteId));
      return;
    }
    if (login === null) {
      throw new Error('Sessão não carregada.');
    }
    await excluirLembretePessoalFirebase(login, lembreteId);
  }

  return {
    pessoais: modoDemonstracao ? pessoaisDemo : pessoaisReais,
    atribuidos: modoDemonstracao ? atribuidosDemo : atribuidosReais,
    erro,
    criarPessoal,
    criarSeriePessoal,
    editarPessoal,
    excluirPessoal,
  };
}
