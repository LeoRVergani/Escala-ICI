import { useState } from 'react';
import { LoaderCircle, Users, X } from 'lucide-react';

import { criarEquipeComoLideranca } from '@/lib/firebase/criarEquipeLideranca';
import type { Equipe, EscopoOperacional, UnidadeOrganizacional, Usuario } from '@/lib/modelos';

/**
 * CRIAR-EQUIPE-1 — Minha equipe › Criar equipe: só o nome e, se quiser, a
 * coordenação. Quem cria vira o chefe (responsável pela escala) na hora.
 */
export function CriarEquipeModal({
  autor,
  unidades,
  onFechar,
  onCriada,
}: {
  autor: Usuario;
  unidades: readonly UnidadeOrganizacional[];
  onFechar: () => void;
  onCriada: (equipe: Equipe, escopo: EscopoOperacional) => void;
}) {
  const [nome, setNome] = useState('');
  const [unidadeId, setUnidadeId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const opcoes = [...unidades].filter((unidade) => unidade.ativa !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  async function criar() {
    setErro('');
    if (nome.trim().length < 2) {
      setErro('Dê um nome para a equipe.');
      return;
    }
    setSalvando(true);
    try {
      const unidade = opcoes.find((item) => item.unidadeId === unidadeId) ?? null;
      const { equipe, escopo } = await criarEquipeComoLideranca({ nome, unidade }, autor);
      onCriada(equipe, escopo);
    } catch (falha) {
      const texto = falha instanceof Error ? falha.message : '';
      setErro(/permission|insufficient/iu.test(texto) ? 'Só lideranças podem criar equipe. Peça a uma liderança para tornar você liderança.' : texto || 'Não foi possível criar agora.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={salvando ? undefined : onFechar}>
      <section className="edit-modal criar-equipe-modal" role="dialog" aria-modal="true" aria-labelledby="criar-equipe-titulo"
        onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="criar-equipe-cabecalho">
          <span className="criar-equipe-icone"><Users size={18} aria-hidden="true" /></span>
          <div>
            <h2 id="criar-equipe-titulo">Criar equipe</h2>
            <p>Você será o responsável pela escala. Depois é só cadastrar as pessoas, importar a escala e escolher os Plantões.</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} disabled={salvando} aria-label="Fechar"><X size={18} /></button>
        </header>
        <label className="criar-equipe-campo">
          <span>Nome da equipe</span>
          <input autoFocus value={nome} maxLength={60} placeholder="Ex.: Suporte N1, NOC, Service Desk" onChange={(evento) => setNome(evento.target.value)}
            onKeyDown={(evento) => { if (evento.key === 'Enter') void criar(); }} />
        </label>
        <label className="criar-equipe-campo">
          <span>Coordenação <small>(opcional)</small></span>
          <select value={unidadeId} onChange={(evento) => setUnidadeId(evento.target.value)}>
            <option value="">Sem coordenação</option>
            {opcoes.map((unidade) => <option key={unidade.unidadeId} value={unidade.unidadeId}>{unidade.nome}{unidade.sigla ? ` (${unidade.sigla})` : ''}</option>)}
          </select>
        </label>
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <div className="criar-equipe-acoes">
          <button type="button" className="secondary-button" disabled={salvando} onClick={onFechar}>Cancelar</button>
          <button type="button" className="primary-button" disabled={salvando} onClick={() => void criar()}>
            {salvando ? <><LoaderCircle className="spin" size={15} aria-hidden="true" /> Criando…</> : 'Criar equipe'}
          </button>
        </div>
      </section>
    </div>
  );
}
