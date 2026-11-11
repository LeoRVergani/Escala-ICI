import { useState } from 'react';
import { LoaderCircle, Radio, X } from 'lucide-react';
import { ROTULO_FUNCAO_PLANTAO, type FuncaoPlantao, type GrupoPlantao } from '@escala-ici/contrato';

import { criarPlantaoComoLideranca } from '@/lib/firebase/criarPlantaoLideranca';
import type { Equipe, EscopoOperacional, Usuario } from '@/lib/modelos';

/**
 * CRIAR-PLANTAO-1 — Minha equipe › Criar Plantão: nome, a equipe a que ele
 * pertence e os postos (único ou vários). Quem cria vira o responsável; depois
 * é só importar a planilha e cadastrar os plantonistas.
 */
const POSTOS = Object.keys(ROTULO_FUNCAO_PLANTAO) as FuncaoPlantao[];

export function CriarPlantaoModal({
  autor,
  equipes,
  onFechar,
  onCriado,
}: {
  autor: Usuario;
  equipes: readonly Equipe[];
  onFechar: () => void;
  onCriado: (grupo: GrupoPlantao, escopo: EscopoOperacional) => void;
}) {
  const [nome, setNome] = useState('');
  const [equipeId, setEquipeId] = useState(equipes[0]?.id ?? '');
  const [varios, setVarios] = useState(false);
  const [postos, setPostos] = useState<FuncaoPlantao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function criar() {
    setErro('');
    const equipe = equipes.find((item) => item.id === equipeId);
    if (nome.trim().length < 2) { setErro('Dê um nome para o Plantão.'); return; }
    if (!equipe) { setErro('Escolha a equipe do Plantão.'); return; }
    if (varios && postos.length < 2) { setErro('Marque pelo menos dois postos — ou escolha "Posto único".'); return; }
    setSalvando(true);
    try {
      const { grupo, escopo } = await criarPlantaoComoLideranca({ nome, equipe, postos: varios ? postos : [] }, autor);
      onCriado(grupo, escopo);
    } catch (falha) {
      const texto = falha instanceof Error ? falha.message : '';
      setErro(/permission|insufficient/iu.test(texto) ? 'Você não tem permissão para criar Plantão para esta equipe.' : texto || 'Não foi possível criar agora.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={salvando ? undefined : onFechar}>
      <section className="edit-modal criar-equipe-modal" role="dialog" aria-modal="true" aria-labelledby="criar-plantao-titulo"
        onMouseDown={(evento) => evento.stopPropagation()}>
        <header className="criar-equipe-cabecalho">
          <span className="criar-equipe-icone"><Radio size={18} aria-hidden="true" /></span>
          <div>
            <h2 id="criar-plantao-titulo">Criar Plantão</h2>
            <p>Você será o responsável. Depois é só importar a planilha do mês e cadastrar os plantonistas.</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} disabled={salvando} aria-label="Fechar"><X size={18} /></button>
        </header>
        <label className="criar-equipe-campo">
          <span>Nome do Plantão</span>
          <input autoFocus value={nome} maxLength={60} placeholder="Ex.: Plantão Infra, Sobreaviso Redes" onChange={(evento) => setNome(evento.target.value)} />
        </label>
        <label className="criar-equipe-campo">
          <span>Equipe do Plantão</span>
          <select value={equipeId} onChange={(evento) => setEquipeId(evento.target.value)}>
            {equipes.map((equipe) => <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>)}
          </select>
        </label>
        <div className="criar-equipe-campo">
          <span>Postos</span>
          <div className="criar-plantao-segmento" role="radiogroup" aria-label="Postos">
            <button type="button" role="radio" aria-checked={!varios} className={!varios ? 'active' : ''} onClick={() => setVarios(false)}>Posto único</button>
            <button type="button" role="radio" aria-checked={varios} className={varios ? 'active' : ''} onClick={() => setVarios(true)}>Vários postos</button>
          </div>
          {varios && (
            <div className="criar-plantao-postos" role="group" aria-label="Quais postos">
              {POSTOS.map((posto) => (
                <button key={posto} type="button" role="checkbox" aria-checked={postos.includes(posto)} className={postos.includes(posto) ? 'active' : ''}
                  onClick={() => setPostos((atuais) => (atuais.includes(posto) ? atuais.filter((item) => item !== posto) : [...atuais, posto]))}>
                  {ROTULO_FUNCAO_PLANTAO[posto]}
                </button>
              ))}
            </div>
          )}
          <small className="criar-plantao-dica">{varios ? 'Um plantonista por posto a cada plantão (ex.: DBA, Linux, Telecom e Windows).' : 'Um plantonista por plantão.'}</small>
        </div>
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <div className="criar-equipe-acoes">
          <button type="button" className="secondary-button" disabled={salvando} onClick={onFechar}>Cancelar</button>
          <button type="button" className="primary-button" disabled={salvando} onClick={() => void criar()}>
            {salvando ? <><LoaderCircle className="spin" size={15} aria-hidden="true" /> Criando…</> : 'Criar Plantão'}
          </button>
        </div>
      </section>
    </div>
  );
}
