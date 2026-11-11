import { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, Radio } from 'lucide-react';
import type { GrupoPlantao } from '@escala-ici/contrato';

import { listarTodosGruposPlantaoAtivos } from '@/lib/firebase/plantaoReadRepository';
import { atualizarEquipeConsultaPlantao } from '@/lib/firebase/plantaoWriteRepository';

/**
 * MINHA-EQUIPE-PLANTOES-1 — o chefe da equipe escolhe, com um interruptor,
 * quais Plantões a equipe vê no App (quem está de plantão, telefones e
 * calendário). Grava só `equipesConsulta` do grupo, UMA equipe por vez — a
 * regra "autovínculo de consulta" garante que ele só mexe na própria equipe.
 */
export function PlantoesDaEquipe({ equipe }: { equipe: { id: string; nome: string } }) {
  const [grupos, setGrupos] = useState<GrupoPlantao[] | null>(null);
  const [erro, setErro] = useState('');
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState('');

  useEffect(() => {
    // A tela recria o componente por equipe (key), então não é preciso zerar o estado aqui.
    let cancelado = false;
    void listarTodosGruposPlantaoAtivos()
      .then((lista) => { if (!cancelado) setGrupos(lista); })
      .catch(() => { if (!cancelado) setErro('Não foi possível carregar os Plantões agora.'); });
    return () => { cancelado = true; };
  }, [equipe.id]);

  async function alternar(grupo: GrupoPlantao, ligar: boolean) {
    setErro('');
    setConfirmacao('');
    setSalvandoId(grupo.grupoId);
    try {
      await atualizarEquipeConsultaPlantao(grupo.grupoId, equipe.id, ligar ? 'ADICIONAR' : 'REMOVER');
      setGrupos((atuais) => (atuais ?? []).map((item) => (item.grupoId !== grupo.grupoId ? item : {
        ...item,
        equipesConsulta: ligar
          ? [...new Set([...(item.equipesConsulta ?? []), equipe.id])]
          : (item.equipesConsulta ?? []).filter((id) => id !== equipe.id),
      })));
      setConfirmacao(ligar
        ? `A equipe ${equipe.nome} agora vê o ${grupo.nome} no App.`
        : `A equipe ${equipe.nome} deixou de ver o ${grupo.nome} no App.`);
    } catch (falha) {
      const mensagem = falha instanceof Error ? falha.message : '';
      setErro(/permission|insufficient/iu.test(mensagem)
        ? 'Você não tem permissão para mudar os Plantões desta equipe.'
        : mensagem || 'Não foi possível salvar agora. Tente de novo.');
    } finally {
      setSalvandoId(null);
    }
  }

  return (
    <article className="panel plantoes-da-equipe">
      {/* PLANTAO-EDITOR-SIMPLES-1 — compacto e no topo da Minha equipe (antes ficava no fim da página). */}
      <div className="quem-ve-plantao">
        <span className="quem-ve-plantao-titulo"><Radio size={15} aria-hidden="true" /> Plantões que a equipe {equipe.nome} vê no App</span>
        {grupos === null && !erro && <span className="plantoes-da-equipe-carregando"><LoaderCircle className="spin" size={14} aria-hidden="true" /> Carregando…</span>}
        {grupos !== null && grupos.length === 0 && <span className="plantoes-da-equipe-vazio">Nenhum Plantão cadastrado ainda.</span>}
        {grupos !== null && grupos.length > 0 && (
          <div className="quem-ve-plantao-chips">
            {grupos.map((grupo) => {
              const daEquipe = grupo.equipeResponsavelId === equipe.id;
              const ligado = daEquipe || (grupo.equipesConsulta ?? []).includes(equipe.id);
              return (
                <button
                  key={grupo.grupoId}
                  type="button"
                  role="switch"
                  aria-checked={ligado}
                  aria-label={`${ligado ? 'Desligar' : 'Ligar'} ${grupo.nome} para a equipe ${equipe.nome}`}
                  className="quem-ve-plantao-chip"
                  data-ligado={ligado ? '' : undefined}
                  disabled={daEquipe || salvandoId !== null}
                  title={daEquipe ? 'Plantão desta equipe — sempre visível.' : ligado ? 'Toque para a equipe deixar de ver' : 'Toque para a equipe passar a ver'}
                  onClick={() => void alternar(grupo, !ligado)}
                >
                  {salvandoId === grupo.grupoId ? <LoaderCircle className="spin" size={13} aria-hidden="true" /> : <span className="quem-ve-plantao-ponto" aria-hidden="true" />}
                  {grupo.nome}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      {confirmacao && <p className="plantoes-da-equipe-ok" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {confirmacao}</p>}
    </article>
  );
}
