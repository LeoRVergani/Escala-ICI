import { useMemo, useState } from 'react';
import { CheckCircle2, Plus, X } from 'lucide-react';
import type { GrupoPlantao } from '@escala-ici/contrato';
import type { Equipe, EscopoOperacional, UnidadeOrganizacional, Usuario } from '@/lib/modelos';
import { codigoOrganizacionalEquipe } from '@/lib/organizacao';
import {
  particionarResponsaveisLoginPorElegibilidade,
  usuariosResponsaveisOperacionaisElegiveis,
} from '@/lib/escoposOperacionaisMatriz';

function adicionarUnico(lista: readonly string[], valor: string): string[] {
  return valor === '' || lista.includes(valor) ? [...lista] : [...lista, valor];
}

function removerValor(lista: readonly string[], valor: string): string[] {
  return lista.filter((item) => item !== valor);
}

function rotuloUsuario(login: string, usuarios: readonly Usuario[]): string {
  const usuario = usuarios.find((item) => item.login === login);
  return usuario === undefined ? login : `${usuario.nome} (${usuario.login})`;
}

function rotuloEquipe(
  id: string,
  equipes: readonly Equipe[],
  unidades: readonly UnidadeOrganizacional[],
): string {
  const equipe = equipes.find((item) => item.id === id);
  return equipe === undefined ? id : `${equipe.nome} · ${codigoOrganizacionalEquipe(equipe, unidades)}`;
}

interface ListaSelecionavelProps {
  titulo: string;
  vazio: string;
  ajuda?: string;
  mensagemSemOpcoes?: string;
  opcoes: { id: string; nome: string }[];
  selecionados: string[];
  rotulo: (id: string) => string;
  avisosSelecionados?: Map<string, string>;
  onAdicionar: (id: string) => void;
  onRemover: (id: string) => void;
}

function ListaSelecionavel({
  titulo,
  vazio,
  ajuda,
  mensagemSemOpcoes,
  opcoes,
  selecionados,
  rotulo,
  avisosSelecionados,
  onAdicionar,
  onRemover,
}: ListaSelecionavelProps) {
  const [valor, setValor] = useState('');
  const disponiveis = opcoes.filter((opcao) => !selecionados.includes(opcao.id));

  return (
    <div className="user-form-full">
      <label>
        {titulo}
        {ajuda && <small className="empty-inline">{ajuda}</small>}
        <div className="wizard-inline-fields">
          <select value={valor} disabled={opcoes.length === 0} onChange={(evento) => setValor(evento.target.value)}>
            <option value="">{opcoes.length === 0 && mensagemSemOpcoes ? mensagemSemOpcoes : vazio}</option>
            {disponiveis.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.nome}</option>)}
          </select>
          <button
            className="secondary-button"
            type="button"
            disabled={valor === ''}
            onClick={() => {
              onAdicionar(valor);
              setValor('');
            }}
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </label>
      {selecionados.length > 0 ? (
        <div className="conciliation-actions">
          {selecionados.map((id) => {
            const aviso = avisosSelecionados?.get(id);
            return (
              <span className={`status-badge ${aviso ? 'warning' : 'neutral'}`} key={id} title={aviso}>
                {rotulo(id)}{aviso ? ` - ${aviso}` : ''}
                <button className="icon-button" type="button" aria-label={`Remover ${rotulo(id)}`} onClick={() => onRemover(id)}>
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="empty-inline">Nenhum item selecionado.</p>
      )}
    </div>
  );
}

export interface ResponsavelEscalaModalProps {
  escopo: EscopoOperacional | null;
  equipes: Equipe[];
  unidades: UnidadeOrganizacional[];
  grupos: GrupoPlantao[];
  usuarios: Usuario[];
  loginAtual: string;
  onFechar: () => void;
  onSalvar: (escopo: EscopoOperacional) => void | Promise<void>;
  processando?: boolean;
}

export function ResponsavelEscalaModal({
  escopo,
  equipes,
  unidades,
  grupos,
  usuarios,
  loginAtual,
  onFechar,
  onSalvar,
  processando = false,
}: ResponsavelEscalaModalProps) {
  const [tipo, setTipo] = useState<EscopoOperacional['tipo']>(escopo?.tipo ?? 'JORNADA');
  const [alvoId, setAlvoId] = useState(escopo?.alvoId ?? '');
  const [responsaveisLogin, setResponsaveisLogin] = useState<string[]>(escopo?.responsaveisLogin ?? []);
  const [responsaveisEquipe, setResponsaveisEquipe] = useState<string[]>(escopo?.responsaveisEquipe ?? []);
  const [equipesConsulta, setEquipesConsulta] = useState<string[]>(escopo?.equipesConsulta ?? []);
  const [ativo, setAtivo] = useState(escopo?.ativo ?? true);

  const equipesAtivas = useMemo(
    () => equipes.filter((equipe) => equipe.ativa).sort((a, b) => a.nome.localeCompare(b.nome)),
    [equipes],
  );
  const usuariosElegiveis = useMemo(
    () => usuariosResponsaveisOperacionaisElegiveis(usuarios),
    [usuarios],
  );
  const responsaveisParticionados = useMemo(
    () => particionarResponsaveisLoginPorElegibilidade(responsaveisLogin, usuarios),
    [responsaveisLogin, usuarios],
  );
  const avisosResponsaveis = useMemo(
    () => new Map(responsaveisParticionados.naoElegiveis.map((login) => [login, 'Responsável não elegível'])),
    [responsaveisParticionados.naoElegiveis],
  );
  const alvos = tipo === 'JORNADA'
    ? equipesAtivas.map((equipe) => ({
      id: equipe.id,
      nome: equipe.nome,
      rotulo: `${equipe.nome} — ${codigoOrganizacionalEquipe(equipe, unidades)}`,
      unidadeId: equipe.unidadeId,
      caminho: equipe.caminhoUnidade,
    }))
    : grupos.filter((grupo) => grupo.ativo).map((grupo) => ({
      id: grupo.grupoId,
      nome: grupo.nome,
      rotulo: grupo.nome,
      unidadeId: grupo.unidadeResponsavelId,
      caminho: grupo.caminhoUnidadeResponsavel,
    })).sort((a, b) => a.nome.localeCompare(b.nome));
  const alvo = alvos.find((item) => item.id === alvoId);
  const podeSalvar = alvo !== undefined
    && responsaveisParticionados.naoElegiveis.length === 0
    && (responsaveisParticionados.elegiveis.length > 0 || responsaveisEquipe.length > 0);

  async function salvar() {
    if (alvo === undefined || !podeSalvar) {
      return;
    }
    const agora = new Date().toISOString();
    await onSalvar({
      tipo,
      alvoId: alvo.id,
      alvoNome: alvo.nome,
      unidadeId: alvo.unidadeId,
      caminhoUnidade: alvo.caminho,
      responsaveisLogin,
      responsaveisEquipe,
      equipesConsulta: tipo === 'PLANTAO' ? equipesConsulta : [],
      ativo,
      criadoEm: escopo?.criadoEm ?? agora,
      atualizadoEm: agora,
      criadoPorLogin: escopo?.criadoPorLogin ?? loginAtual,
      atualizadoPorLogin: loginAtual,
      schemaVersion: 1,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onFechar}>
      <section className="edit-modal admin-modal" role="dialog" aria-modal="true" aria-labelledby="responsavel-escala-title" onMouseDown={(evento) => evento.stopPropagation()}>
        <div className="panel-title">
          <div>
            <p className="eyebrow">Administração</p>
            <h2 id="responsavel-escala-title">{escopo ? 'Editar vínculo operacional' : 'Novo vínculo operacional'}</h2>
            <p>Esta configuração define quem administra a escala. Consulta não concede edição.</p>
          </div>
          <button className="icon-button" type="button" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="admin-form-grid">
          <label>
            Tipo
            <select value={tipo} disabled={escopo !== null} onChange={(evento) => { setTipo(evento.target.value as EscopoOperacional['tipo']); setAlvoId(''); setEquipesConsulta([]); }}>
              <option value="JORNADA">Jornada</option>
              <option value="PLANTAO">Plantão</option>
            </select>
          </label>
          <label>
            Alvo
            <select value={alvoId} disabled={escopo !== null} onChange={(evento) => setAlvoId(evento.target.value)}>
              <option value="">Selecione uma escala</option>
              {alvos.map((item) => <option key={item.id} value={item.id}>{item.rotulo}</option>)}
            </select>
          </label>
          <ListaSelecionavel
            titulo="Responsáveis"
            vazio="Selecionar gestor ou supervisor ativo"
            mensagemSemOpcoes="Nenhum gestor ou supervisor ativo encontrado. Cadastre ou promova um usuário antes de criar o vínculo."
            ajuda="Usuários gestores/supervisores que podem criar, importar, editar, salvar rascunho, publicar e gerenciar esta escala."
            opcoes={usuariosElegiveis.map((usuario) => ({ id: usuario.login, nome: `${usuario.nome} (${usuario.login})` }))}
            selecionados={responsaveisLogin}
            rotulo={(login) => rotuloUsuario(login, usuarios)}
            avisosSelecionados={avisosResponsaveis}
            onAdicionar={(login) => setResponsaveisLogin((atuais) => adicionarUnico(atuais, login))}
            onRemover={(login) => setResponsaveisLogin((atuais) => removerValor(atuais, login))}
          />
          <ListaSelecionavel
            titulo="Equipes administradoras"
            vazio="Selecionar equipe ativa"
            ajuda="Use apenas quando a equipe inteira representa um grupo de gestão. Consulta deve ser configurada em Equipes que consultam."
            opcoes={equipesAtivas.map((equipe) => ({ id: equipe.id, nome: rotuloEquipe(equipe.id, equipes, unidades) }))}
            selecionados={responsaveisEquipe}
            rotulo={(id) => rotuloEquipe(id, equipes, unidades)}
            onAdicionar={(id) => setResponsaveisEquipe((atuais) => adicionarUnico(atuais, id))}
            onRemover={(id) => setResponsaveisEquipe((atuais) => removerValor(atuais, id))}
          />
          {tipo === 'PLANTAO' && (
            <ListaSelecionavel
              titulo="Equipes que consultam"
              vazio="Selecionar equipe ativa"
              ajuda="Equipes que visualizam ou monitoram este Plantão, sem permissão de salvar, importar ou publicar."
              opcoes={equipesAtivas.map((equipe) => ({ id: equipe.id, nome: rotuloEquipe(equipe.id, equipes, unidades) }))}
              selecionados={equipesConsulta}
              rotulo={(id) => rotuloEquipe(id, equipes, unidades)}
              onAdicionar={(id) => setEquipesConsulta((atuais) => adicionarUnico(atuais, id))}
              onRemover={(id) => setEquipesConsulta((atuais) => removerValor(atuais, id))}
            />
          )}
          <label className="checkbox-row">
            <input type="checkbox" checked={ativo} onChange={(evento) => setAtivo(evento.target.checked)} />
            Vínculo ativo
          </label>
        </div>
        {responsaveisParticionados.naoElegiveis.length > 0 && (
          <p className="admin-form-erro" role="alert">
            Remova ou promova o responsável não elegível antes de salvar este vínculo.
          </p>
        )}
        <div className="wizard-actions">
          <button className="secondary-button" type="button" onClick={onFechar}>Cancelar</button>
          <button className="primary-button" type="button" disabled={!podeSalvar || processando} onClick={() => void salvar()}>
            <CheckCircle2 size={16} /> Salvar
          </button>
        </div>
      </section>
    </div>
  );
}
