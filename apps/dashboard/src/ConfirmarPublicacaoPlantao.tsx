import { useEffect, useState } from 'react';
import { ArrowRight, Bell, LoaderCircle, Minus, Plus, Send, X } from 'lucide-react';
import { ROTULO_FUNCAO_PLANTAO, type GrupoPlantao } from '@escala-ici/contrato';

import {
  listarAtribuicoesPlantaoPublicada,
  listarParticipantesPlantao,
  obterCompetenciaPlantaoPublicada,
} from '@/lib/firebase/plantaoReadRepository';
import type { AtribuicaoPlantaoEditavel } from '@/lib/editorPlantao';
import type { Equipe, Usuario } from '@/lib/modelos';
import { reidratarRascunhoPlantao } from '@/lib/montagemRascunhoPlantao';
import { mudancasEntreEscalas, type MudancaPlantao } from '@/lib/mudancasPlantao';
import { nomeDoMes } from './EscalaPlantaoPage';
import { QuemVePlantaoPainel } from './QuemVePlantaoPainel';

/**
 * ESCALA-PLANTAO-3 — o passo Publicar: o que muda em relação à escala no ar,
 * quem vê no App e o aviso de que os plantonistas são notificados — tudo na
 * hora de decidir, com um botão Publicar.
 */
const LIMITE = 12;

function primeiroNome(nome: string | null): string {
  return (nome ?? '').trim().split(/\s+/u)[0] ?? '';
}

function dia(data: string): string {
  const [, mes, d] = data.split('-');
  return `${d}/${mes}`;
}

export function ConfirmarPublicacaoPlantao({
  grupo, competencia, atribuicoes, usuarios, equipes, publicando, erro, onFechar, onPublicar, onAlternarQuemVe,
}: {
  grupo: GrupoPlantao;
  competencia: string;
  atribuicoes: readonly AtribuicaoPlantaoEditavel[];
  usuarios: readonly Usuario[];
  equipes: readonly Equipe[];
  publicando: boolean;
  erro: string;
  onFechar: () => void;
  onPublicar: () => void;
  onAlternarQuemVe: (grupo: GrupoPlantao, equipeId: string, ligar: boolean) => Promise<void>;
}) {
  const [mudancas, setMudancas] = useState<MudancaPlantao[] | null>(null);
  const [primeira, setPrimeira] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const publicada = await obterCompetenciaPlantaoPublicada(grupo.grupoId, competencia);
        if (publicada === null) {
          if (!cancelado) { setPrimeira(true); setMudancas([]); }
          return;
        }
        const [persistidas, participantes] = await Promise.all([
          listarAtribuicoesPlantaoPublicada(grupo.grupoId, competencia),
          listarParticipantesPlantao(grupo.grupoId),
        ]);
        const noAr = reidratarRascunhoPlantao({ grupo, competencia: publicada, atribuicoesPersistidas: persistidas, participantes, usuarios }).atribuicoesEditaveis;
        if (!cancelado) setMudancas(mudancasEntreEscalas(noAr, atribuicoes));
      } catch {
        if (!cancelado) setMudancas([]);
      }
    })();
    return () => { cancelado = true; };
  }, [atribuicoes, competencia, grupo, usuarios]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={publicando ? undefined : onFechar}>
      <section className="edit-modal criar-equipe-modal publicar-plantao-modal" role="dialog" aria-modal="true" aria-labelledby="publicar-plantao-titulo"
        onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="criar-equipe-cabecalho">
          <span className="criar-equipe-icone"><Send size={18} aria-hidden="true" /></span>
          <div>
            <h2 id="publicar-plantao-titulo">Publicar a escala de {grupo.nome}</h2>
            <p>{nomeDoMes(competencia)} · {atribuicoes.length} plantões</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} disabled={publicando} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="publicar-plantao-secao">
          <h3>O que muda</h3>
          {mudancas === null ? (
            <p className="liderancas-carregando"><LoaderCircle className="spin" size={15} aria-hidden="true" /> Comparando com a escala no ar…</p>
          ) : primeira ? (
            <p className="publicar-plantao-nota">É a primeira publicação deste mês: a equipe passa a ver os {atribuicoes.length} plantões.</p>
          ) : mudancas.length === 0 ? (
            <p className="publicar-plantao-nota">Nenhum plantão mudou em relação à escala no ar.</p>
          ) : (
            <ul className="publicar-plantao-mudancas">
              {mudancas.slice(0, LIMITE).map((mudanca) => (
                <li key={`${mudanca.tipo}-${mudanca.data}-${mudanca.horario}-${mudanca.funcao ?? ''}`} data-tipo={mudanca.tipo}>
                  <span className="publicar-plantao-icone" aria-hidden="true">
                    {mudanca.tipo === 'NOVO' ? <Plus size={13} /> : mudanca.tipo === 'RETIRADO' ? <Minus size={13} /> : <ArrowRight size={13} />}
                  </span>
                  <strong>Dia {dia(mudanca.data)}</strong>
                  <small>{mudanca.horario}{mudanca.funcao ? ` · ${ROTULO_FUNCAO_PLANTAO[mudanca.funcao]}` : ''}</small>
                  <span>
                    {mudanca.tipo === 'TROCA' && <>{primeiroNome(mudanca.antes)} → <b>{primeiroNome(mudanca.depois)}</b></>}
                    {mudanca.tipo === 'NOVO' && <>novo: <b>{primeiroNome(mudanca.depois)}</b></>}
                    {mudanca.tipo === 'RETIRADO' && <>retirado: {primeiroNome(mudanca.antes)}</>}
                  </span>
                </li>
              ))}
              {mudancas.length > LIMITE && <li className="publicar-plantao-mais">… e mais {mudancas.length - LIMITE} mudança(s)</li>}
            </ul>
          )}
        </div>

        <div className="publicar-plantao-secao">
          <QuemVePlantaoPainel grupo={grupo} equipes={equipes} onAlternar={onAlternarQuemVe} />
        </div>

        <p className="publicar-plantao-aviso"><Bell size={14} aria-hidden="true" /> Os plantonistas com mudança recebem um aviso no celular.</p>
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <div className="criar-equipe-acoes">
          <button type="button" className="secondary-button" disabled={publicando} onClick={onFechar}>Voltar</button>
          <button type="button" className="primary-button" disabled={publicando || mudancas === null} onClick={onPublicar}>
            {publicando ? <><LoaderCircle className="spin" size={15} aria-hidden="true" /> Publicando…</> : <><Send size={15} aria-hidden="true" /> Publicar</>}
          </button>
        </div>
      </section>
    </div>
  );
}
