'use client';

import { Check, X } from 'lucide-react';
import { useState } from 'react';

import { useTeclaEsc } from '@/lib/hooks/useTeclaEsc';
import type { NoArvoreOrganizacional } from '@/lib/organizacao';
import { OrganizationTree } from './OrganizationTree';

/**
 * Seletor reutilizável de EQUIPES (Fase UI-ORG-1) — modo `single` (equipe
 * responsável de um `GrupoPlantao`) ou `multiple` (`equipesConsulta`).
 * Reaproveita `OrganizationTree` (mesma árvore/busca/teclado da
 * Administração) com `ehNoSelecionavel` travado em `tipo === 'equipe'` —
 * Unidades aparecem só para navegação/contexto, nunca como opção marcável
 * (nunca uma ACL por Unidade). Não escreve Firestore: devolve só o(s)
 * `equipeId`(s) escolhido(s) via `onConfirmar`; quem persiste é sempre o
 * formulário chamador (`ModalGrupoPlantao`), exatamente como antes desta
 * fase — o payload de `GrupoPlantao` não muda.
 */

interface PropsBase {
  titulo: string;
  descricao?: string;
  raizes: NoArvoreOrganizacional[];
  onFechar: () => void;
}

interface PropsSingle extends PropsBase {
  modo: 'single';
  valor: string | null;
  onConfirmar: (equipeId: string) => void;
}

interface PropsMultiple extends PropsBase {
  modo: 'multiple';
  valores: readonly string[];
  /** `equipeId` que não pode ser desmarcada nesta sessão do picker (ex.: equipe responsável, sempre incluída em `equipesConsulta`). */
  equipeTravadaId?: string;
  onConfirmar: (equipeIds: string[]) => void;
}

export type OrganizationTeamPickerProps = PropsSingle | PropsMultiple;

export function OrganizationTeamPicker(props: OrganizationTeamPickerProps) {
  const { titulo, descricao, raizes, onFechar } = props;
  useTeclaEsc(onFechar);
  const [termoBusca, setTermoBusca] = useState('');
  const [rascunhoSingle, setRascunhoSingle] = useState<string | null>(
    props.modo === 'single' ? props.valor : null,
  );
  const [rascunhoMultiple, setRascunhoMultiple] = useState<Set<string>>(() => {
    const inicial = new Set(props.modo === 'multiple' ? props.valores : []);
    if (props.modo === 'multiple' && props.equipeTravadaId) {
      inicial.add(props.equipeTravadaId);
    }
    return inicial;
  });

  function alternarMultiple(equipeId: string) {
    if (props.modo !== 'multiple') {
      return;
    }
    const travada = equipeId === props.equipeTravadaId;
    setRascunhoMultiple((atuais) => {
      if (atuais.has(equipeId)) {
        if (travada) {
          return atuais;
        }
        const proximo = new Set(atuais);
        proximo.delete(equipeId);
        return proximo;
      }
      return new Set(atuais).add(equipeId);
    });
  }

  function aoSelecionarNo(no: NoArvoreOrganizacional) {
    if (no.tipo !== 'equipe') {
      return;
    }
    if (props.modo === 'single') {
      setRascunhoSingle(no.equipe.id);
      return;
    }
    alternarMultiple(no.equipe.id);
  }

  function aoConfirmar() {
    if (props.modo === 'single') {
      if (rascunhoSingle !== null) {
        props.onConfirmar(rascunhoSingle);
      }
      return;
    }
    props.onConfirmar([...rascunhoMultiple]);
  }

  const podeConfirmar = props.modo === 'single' ? rascunhoSingle !== null : rascunhoMultiple.size > 0;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal organization-team-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="organization-team-picker-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <h2 id="organization-team-picker-title">{titulo}</h2>
            {descricao && <p>{descricao}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <OrganizationTree
          raizes={raizes}
          labelAria={titulo}
          termoBusca={termoBusca}
          onMudarBusca={setTermoBusca}
          chaveSelecionada={props.modo === 'single' && rascunhoSingle !== null ? `equipe:${rascunhoSingle}` : null}
          onSelecionarNo={aoSelecionarNo}
          ehNoSelecionavel={(no) => no.tipo === 'equipe'}
          mensagemVazia="Nenhuma equipe cadastrada ainda."
          renderTrilha={(no) => {
            if (no.tipo !== 'equipe') {
              return null;
            }
            if (props.modo === 'single') {
              return rascunhoSingle === no.equipe.id
                ? <Check size={16} className="organization-team-picker-marca" aria-hidden="true" />
                : null;
            }
            const marcado = rascunhoMultiple.has(no.equipe.id);
            const travada = no.equipe.id === props.equipeTravadaId;
            return (
              <label
                className="checkbox-inline organization-team-picker-checkbox"
                onClick={(evento) => evento.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={travada}
                  onChange={() => alternarMultiple(no.equipe.id)}
                  aria-label={`Selecionar equipe ${no.equipe.nome}`}
                />
              </label>
            );
          }}
        />
        <div className="rollback-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button className="primary-button" type="button" disabled={!podeConfirmar} onClick={aoConfirmar}>
            Confirmar
          </button>
        </div>
      </section>
    </div>
  );
}
