import { useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import type { Usuario, UnidadeOrganizacional } from '@/lib/modelos';
import { construirArvoreUnidades, rotuloTecnicoUnidade, type NoArvoreUnidade } from '@/lib/organizacao';
import {
  montarCamposAcessoUsuario,
  resumoAcessoUsuario,
  validarSelecaoAcessoUsuario,
} from '@/lib/perfilAcessoUsuario';

/**
 * FASE-ESCOPO-HIERARQUICO-CODB-E-ADMIN-PLANTAO-1 — objetivo de produto:
 * "Responsável [pessoa] / Responsável por [unidade] / Salvar", no máximo 2
 * escolhas antes de salvar. Deliberadamente NÃO um sistema novo de
 * autorização: só uma UI de 2 campos por cima do MESMO mecanismo que já
 * existe — `perfil: 'GESTOR_UNIDADE'` + `unidadeId`/`unidadesPermitidas`
 * (`lib/sessao.ts`, `firestore.rules` — `podeAdministrarJornada()`/
 * `podeGerenciarGrupoPlantao()` já concedem administração de TODA a árvore
 * abaixo da unidade escolhida, sem precisar listar equipe por equipe). Os
 * mesmos helpers (`montarCamposAcessoUsuario`/`resumoAcessoUsuario`) já
 * usados pelo formulário completo de cadastro (`DashboardApp.tsx`,
 * "Permissões" › "Tipo de acesso") — nunca uma segunda derivação.
 *
 * Reservado a quem já pode conceder `GESTOR_UNIDADE` (hoje só
 * `ADMIN_SISTEMA` — `firestore.rules`, `match /usuarios/{login}`): a
 * Matriz de Responsáveis por Escala (`ResponsavelEscalaModal`) continua
 * existindo à parte, para exceções específicas por escala (ex.: um
 * supervisor que administra só um Plantão isolado) — este modal nunca a
 * substitui.
 */
export interface AtribuirCoordenadorModalProps {
  usuarios: Usuario[];
  unidades: UnidadeOrganizacional[];
  onFechar: () => void;
  onSalvar: (usuario: Usuario) => void | Promise<void>;
  processando?: boolean;
  erro?: string;
}

function achatarSubarvore(nos: readonly NoArvoreUnidade[]): NoArvoreUnidade[] {
  return nos.flatMap((no) => [no, ...achatarSubarvore(no.filhos)]);
}

export function AtribuirCoordenadorModal({
  usuarios,
  unidades,
  onFechar,
  onSalvar,
  processando = false,
  erro,
}: AtribuirCoordenadorModalProps) {
  const [login, setLogin] = useState('');
  const [unidadeId, setUnidadeId] = useState('');

  const usuariosOrdenados = useMemo(
    () => usuarios.filter((usuario) => usuario.ativo).slice().sort((a, b) => a.nome.localeCompare(b.nome)),
    [usuarios],
  );
  const unidadesAtivas = useMemo(
    () => unidades.filter((unidade) => unidade.ativa).slice().sort((a, b) => a.nome.localeCompare(b.nome)),
    [unidades],
  );
  const pessoa = usuariosOrdenados.find((usuario) => usuario.login === login);
  const unidade = unidadesAtivas.find((item) => item.unidadeId === unidadeId);

  const selecao = { tipo: 'GESTOR_UNIDADE' as const, unidadeId: unidadeId || undefined };
  const errosSelecao = validarSelecaoAcessoUsuario(selecao);
  const podeSalvar = login !== '' && errosSelecao.length === 0;

  const subarvore = unidade === undefined
    ? []
    : achatarSubarvore(construirArvoreUnidades(unidades.filter((item) => item.caminho.includes(unidade.unidadeId))))
      .filter((no) => no.unidade.unidadeId !== unidade.unidadeId);

  const resumo = resumoAcessoUsuario(
    { perfil: 'GESTOR_UNIDADE', escopo: 'UNIDADE' },
    { rotuloUnidade: unidade ? rotuloTecnicoUnidade(unidade) : undefined },
  );

  function salvar() {
    if (pessoa === undefined || !podeSalvar) {
      return;
    }
    const campos = montarCamposAcessoUsuario(selecao);
    void onSalvar({
      ...pessoa,
      perfil: campos.perfil,
      escopo: campos.escopo,
      // Correção CODB/NOC: `campos.equipeId`/`campos.equipesPermitidas` são
      // sempre undefined/[] para GESTOR_UNIDADE — aplicados explicitamente
      // (nunca herdados de `...pessoa`) para não deixar sobreviver o
      // `equipeId` de uma equipe que a pessoa tinha antes de virar
      // coordenadora, que poderia coincidir com `responsaveisEquipe` da
      // Matriz de alguma Jornada e conceder administração por acidente.
      equipeId: campos.equipeId ?? '',
      equipesPermitidas: campos.equipesPermitidas,
      unidadeId: campos.unidadeId,
      unidadesPermitidas: campos.unidadesPermitidas,
      nivelHierarquico: campos.nivelHierarquico,
      atualizadoEm: new Date().toISOString(),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section
        className="edit-modal admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atribuir-coordenador-title"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="panel-title">
          <div>
            <p className="eyebrow">Administração</p>
            <h2 id="atribuir-coordenador-title">Atribuir coordenador de unidade</h2>
            <p>Escolha a pessoa e a unidade — o acesso às equipes e Plantões abaixo dela é automático.</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="admin-form-grid">
          <label className="user-form-full">
            Responsável
            <select value={login} onChange={(evento) => setLogin(evento.target.value)}>
              <option value="">Selecione a pessoa</option>
              {usuariosOrdenados.map((usuario) => (
                <option key={usuario.login} value={usuario.login}>{usuario.nome} ({usuario.login})</option>
              ))}
            </select>
          </label>
          <label className="user-form-full">
            Responsável por
            <select value={unidadeId} onChange={(evento) => setUnidadeId(evento.target.value)}>
              <option value="">Selecione a unidade</option>
              {unidadesAtivas.map((item) => (
                <option key={item.unidadeId} value={item.unidadeId}>{rotuloTecnicoUnidade(item)}</option>
              ))}
            </select>
          </label>
        </div>
        {pessoa && unidade && (
          <div className="access-summary">
            {resumo.map((linha) => <p key={linha} className="hint-text">{linha}</p>)}
            {subarvore.length > 0 && (
              <>
                <p className="hint-text">
                  <strong>{pessoa.nome}</strong> poderá administrar <strong>{unidade.nome}</strong> e as
                  estruturas subordinadas abaixo:
                </p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {subarvore.map((no) => (
                    <li key={no.unidade.unidadeId} className="hint-text" style={{ paddingLeft: (no.profundidade - 1) * 16 }}>
                      {no.unidade.nome}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {errosSelecao.length > 0 && unidadeId !== '' && (
          <div className="alert error" role="alert">
            <ul>{errosSelecao.map((mensagem) => <li key={mensagem}>{mensagem}</li>)}</ul>
          </div>
        )}
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <div className="wizard-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button className="primary-button" type="button" disabled={!podeSalvar || processando} onClick={salvar}>
            <CheckCircle2 size={16} /> Salvar
          </button>
        </div>
      </section>
    </div>
  );
}
