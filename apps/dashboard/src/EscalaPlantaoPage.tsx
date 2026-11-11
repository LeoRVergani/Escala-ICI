import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3, History, LoaderCircle, MoreHorizontal, Pencil, Upload, Users } from 'lucide-react';
import type { CompetenciaPlantao, GrupoPlantao } from '@escala-ici/contrato';

import { PlantaoCalendario } from '@/components/plantao/PlantaoCalendario';
import { listarAtribuicoesPlantaoPublicada, listarParticipantesPlantao } from '@/lib/firebase/plantaoReadRepository';
import { reidratarRascunhoPlantao } from '@/lib/montagemRascunhoPlantao';
import type { Equipe, Usuario } from '@/lib/modelos';
import type { AtribuicaoPlantaoEditavel } from '@/lib/editorPlantao';
import { QuemVePlantaoPainel } from './QuemVePlantaoPainel';

/**
 * ESCALA-PLANTAO-1 (parte 1 da reformulação) — a escala do Plantão no ar, só
 * para conferir: status, três números, quem vê no App e o calendário do mês.
 * "Ajustar" e "Importar nova planilha" levam ao editor (o mesmo motor de
 * sempre); nada de abas, campos ou passos à vista enquanto só se confere.
 */
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function nomeDoMes(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const nome = MESES[(mes ?? 1) - 1] ?? competencia;
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

function dataCurta(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}`;
}

const NADA = () => {};

/** ESCALA-PLANTAO-4 — de onde veio a escala, em linguagem de gente. */
const ORIGEM: Record<string, string> = {
  IMPORTADO: 'planilha importada',
  MANUAL: 'montada à mão',
  GERADO: 'gerada pelo padrão de horários',
  COPIADO: 'copiada de outro mês',
};

function dataHora(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? iso : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function EscalaPlantaoPage({
  grupo, competencia, equipes, usuarios, dataHoje, somenteConsulta, onVoltar, onAjustar, onArquivo, onAlternarQuemVe,
}: {
  grupo: GrupoPlantao;
  competencia: CompetenciaPlantao;
  equipes: readonly Equipe[];
  usuarios: readonly Usuario[];
  dataHoje: string;
  somenteConsulta: boolean;
  onVoltar: () => void;
  onAjustar: () => void;
  onArquivo: (arquivo: File) => void;
  onAlternarQuemVe: (grupo: GrupoPlantao, equipeId: string, ligar: boolean) => Promise<void>;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoPlantaoEditavel[] | null>(null);
  const [erro, setErro] = useState('');
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void Promise.all([
      listarAtribuicoesPlantaoPublicada(grupo.grupoId, competencia.competencia),
      listarParticipantesPlantao(grupo.grupoId),
    ]).then(([persistidas, participantes]) => {
      if (cancelado) return;
      const reidratado = reidratarRascunhoPlantao({ grupo, competencia, atribuicoesPersistidas: persistidas, participantes, usuarios });
      setAtribuicoes(reidratado.atribuicoesEditaveis);
    }).catch(() => { if (!cancelado) setErro('Não foi possível carregar a escala agora.'); });
    return () => { cancelado = true; };
  }, [competencia, grupo, usuarios]);

  const plantonistas = new Set((atribuicoes ?? []).map((item) => item.plantonistaNomeOriginal)).size;
  const horas = Math.round((atribuicoes ?? []).reduce((total, item) => total + item.duracaoMinutos, 0) / 60);

  return (
    <section className="escala-plantao">
      <button type="button" className="text-button admin-voltar" onClick={onVoltar}><ArrowLeft size={16} aria-hidden="true" /> Escalas</button>

      <header className="escala-plantao-cabecalho">
        <div>
          <p className="eyebrow">Escala do Plantão</p>
          <h1>{grupo.nome}</h1>
          <p className="escala-plantao-mes">
            {nomeDoMes(competencia.competencia)} · {dataCurta(competencia.periodoInicio)} → {dataCurta(competencia.periodoFim)}
            <span className="escala-plantao-status" data-status="no-ar"><span aria-hidden="true" /> No ar{competencia.revisao > 1 ? ` · versão ${competencia.revisao}` : ''}</span>
          </p>
        </div>
        <div className="escala-plantao-acoes">
          <button type="button" className="icon-button" aria-expanded={detalhesAbertos} aria-label="Detalhes da versão"
            title="Detalhes da versão" onClick={() => setDetalhesAbertos((aberto) => !aberto)}>
            <MoreHorizontal size={18} />
          </button>
        {!somenteConsulta && (
          <>
            <button type="button" className="secondary-button" onClick={() => entrada.current?.click()}>
              <Upload size={16} aria-hidden="true" /> Importar nova planilha
            </button>
            <button type="button" className="primary-button" onClick={onAjustar}>
              <Pencil size={16} aria-hidden="true" /> Ajustar
            </button>
            <input ref={entrada} type="file" hidden accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(evento) => {
                const arquivo = evento.target.files?.[0];
                evento.target.value = '';
                if (arquivo) onArquivo(arquivo);
              }} />
          </>
        )}
        </div>
      </header>

      {/* ESCALA-PLANTAO-4 — "⋯": a versão no ar (o Plantão guarda só a atual; o histórico completo é uma entrega própria). */}
      {detalhesAbertos && (
        <div className="escala-plantao-detalhes" role="region" aria-label="Detalhes da versão">
          <History size={16} aria-hidden="true" />
          <span>
            <strong>Versão {competencia.revisao}</strong> · no ar desde {dataHora(competencia.atualizadoEm)}
            {' '}· {ORIGEM[competencia.origem] ?? competencia.origem}
            {' '}· criada por {usuarios.find((usuario) => usuario.login === competencia.criadoPorLogin)?.nome ?? competencia.criadoPorLogin}
          </span>
        </div>
      )}

      <div className="escala-plantao-resumo">
        <span><Users size={16} aria-hidden="true" /><strong>{atribuicoes === null ? '–' : plantonistas}</strong> plantonistas</span>
        <span><CalendarDays size={16} aria-hidden="true" /><strong>{atribuicoes === null ? '–' : atribuicoes.length}</strong> plantões</span>
        <span><Clock3 size={16} aria-hidden="true" /><strong>{atribuicoes === null ? '–' : horas}</strong> horas</span>
        {!somenteConsulta && (
          <span className="escala-plantao-quem-ve">
            <QuemVePlantaoPainel grupo={grupo} equipes={equipes} onAlternar={onAlternarQuemVe} />
          </span>
        )}
      </div>

      {erro && <div className="alert error" role="alert">{erro}</div>}
      {atribuicoes === null && !erro ? (
        <p className="liderancas-carregando"><LoaderCircle className="spin" size={16} aria-hidden="true" /> Carregando a escala…</p>
      ) : atribuicoes !== null && (
        <article className="panel escala-plantao-calendario">
          <PlantaoCalendario
            competencia={competencia.competencia}
            periodoInicio={competencia.periodoInicio}
            periodoFim={competencia.periodoFim}
            dataHoje={dataHoje}
            atribuicoes={atribuicoes}
            onEditarAtribuicao={NADA}
            plantonistaSelecionado={null}
            onSolicitarNovaAtribuicao={NADA}
            modo="consulta"
          />
        </article>
      )}
    </section>
  );
}
