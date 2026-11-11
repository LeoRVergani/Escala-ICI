import { useState } from 'react';
import { Eye, LoaderCircle } from 'lucide-react';
import type { GrupoPlantao } from '@escala-ici/contrato';

import type { Equipe } from '@/lib/modelos';

/**
 * PLANTAO-EDITOR-SIMPLES-1 — no editor de escala de Plantão: quais equipes
 * veem este Plantão no App (quem está de plantão, telefones, calendário).
 * A equipe do Plantão sempre vê. Grava só `equipesConsulta`, uma por vez.
 */
export function QuemVePlantaoPainel({ grupo, equipes, onAlternar }: {
  grupo: GrupoPlantao;
  equipes: readonly Equipe[];
  onAlternar: (grupo: GrupoPlantao, equipeId: string, ligar: boolean) => Promise<void>;
}) {
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const opcoes = equipes.filter((equipe) => equipe.ativa !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  async function alternar(equipeId: string, ligar: boolean) {
    setSalvandoId(equipeId);
    setErro('');
    try {
      await onAlternar(grupo, equipeId, ligar);
    } catch (falha) {
      const texto = falha instanceof Error ? falha.message : '';
      setErro(/permission|insufficient/iu.test(texto) ? 'Você não tem permissão para mudar quem vê este Plantão.' : texto || 'Não foi possível salvar agora.');
    } finally {
      setSalvandoId(null);
    }
  }
  return (
    <div className="quem-ve-plantao">
      <span className="quem-ve-plantao-titulo"><Eye size={15} aria-hidden="true" /> Quem vê no App</span>
      <div className="quem-ve-plantao-chips">
        {opcoes.map((equipe) => {
          const daEquipe = equipe.id === grupo.equipeResponsavelId;
          const ligado = daEquipe || (grupo.equipesConsulta ?? []).includes(equipe.id);
          return (
            <button key={equipe.id} type="button" role="switch" aria-checked={ligado} className="quem-ve-plantao-chip" data-ligado={ligado ? '' : undefined}
              disabled={daEquipe || salvandoId !== null} title={daEquipe ? 'A equipe do Plantão sempre vê.' : ligado ? 'Toque para deixar de ver' : 'Toque para passar a ver'}
              onClick={() => void alternar(equipe.id, !ligado)}>
              {salvandoId === equipe.id ? <LoaderCircle className="spin" size={13} aria-hidden="true" /> : <span className="quem-ve-plantao-ponto" aria-hidden="true" />}
              {equipe.nome}
            </button>
          );
        })}
      </div>
      {erro && <span className="plantao-command-error">{erro}</span>}
    </div>
  );
}
