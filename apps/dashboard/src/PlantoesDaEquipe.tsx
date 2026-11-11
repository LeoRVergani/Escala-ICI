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
      <header className="plantoes-da-equipe-cabecalho">
        <span className="plantoes-da-equipe-icone"><Radio size={18} aria-hidden="true" /></span>
        <div>
          <h2>Plantões que a equipe {equipe.nome} vê no App</h2>
          <p>Ligue os Plantões que a equipe deve acompanhar: quem está de plantão agora, os telefones e o calendário.</p>
        </div>
      </header>

      {grupos === null && !erro && (
        <p className="plantoes-da-equipe-carregando"><LoaderCircle className="spin" size={16} aria-hidden="true" /> Carregando Plantões…</p>
      )}
      {erro && <div className="alert error" role="alert">{erro}</div>}
      {confirmacao && <p className="plantoes-da-equipe-ok" role="status"><CheckCircle2 size={15} aria-hidden="true" /> {confirmacao}</p>}

      {grupos !== null && grupos.length === 0 && (
        <p className="plantoes-da-equipe-vazio">Nenhum Plantão cadastrado ainda.</p>
      )}
      {grupos !== null && grupos.length > 0 && (
        <ul className="plantoes-da-equipe-lista">
          {grupos.map((grupo) => {
            const daEquipe = grupo.equipeResponsavelId === equipe.id;
            const ligado = daEquipe || (grupo.equipesConsulta ?? []).includes(equipe.id);
            const quantas = (grupo.equipesConsulta ?? []).length;
            return (
              <li key={grupo.grupoId} data-ligado={ligado ? '' : undefined}>
                <span className="plantoes-da-equipe-nome">
                  <strong>{grupo.nome}</strong>
                  <small>{daEquipe ? 'Plantão desta equipe' : `${quantas} ${quantas === 1 ? 'equipe vê' : 'equipes veem'} no App`}</small>
                </span>
                {salvandoId === grupo.grupoId && <LoaderCircle className="spin" size={16} aria-hidden="true" />}
                <button
                  type="button"
                  role="switch"
                  aria-checked={ligado}
                  aria-label={`${ligado ? 'Desligar' : 'Ligar'} ${grupo.nome} para a equipe ${equipe.nome}`}
                  className="plantoes-da-equipe-interruptor"
                  disabled={daEquipe || salvandoId !== null}
                  title={daEquipe ? 'A equipe responsável sempre vê o próprio Plantão.' : undefined}
                  onClick={() => void alternar(grupo, !ligado)}
                >
                  <span />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
