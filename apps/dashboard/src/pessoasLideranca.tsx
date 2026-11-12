import { useEffect, useState } from 'react';

import { listarTodosUsuarios } from '@/lib/firebase/adminRepository';
import { tornarLideranca } from '@/lib/firebase/liderancasRepository';
import type { Usuario } from '@/lib/modelos';

/** LIDERANCAS-2 — peças comuns de Lideranças e Colaboradores. */
export type Pessoa = Usuario & { promovidoPorLogin?: string; promovidoEm?: string };

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/u);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes.at(-1)?.[0] ?? '' : '')).toUpperCase();
}

export function mensagemErro(falha: unknown, padrao: string): string {
  const texto = falha instanceof Error ? falha.message : '';
  return /permission|insufficient/iu.test(texto) ? 'Você não tem permissão para esta ação.' : texto || padrao;
}

/** Todas as pessoas ativas (lista recarregável). */
export function usePessoas(pessoasDemo?: readonly Usuario[]) {
  // DASHBOARD-LOTE3 — no modo demonstração usa as pessoas de exemplo (sem banco, sem erro vermelho).
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(pessoasDemo ? [...pessoasDemo] as Pessoa[] : null);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    if (pessoasDemo) return undefined;
    let cancelado = false;
    void listarTodosUsuarios()
      .then((lista) => { if (!cancelado) setPessoas((lista as Pessoa[]).filter((pessoa) => pessoa.ativo !== false)); })
      .catch(() => { if (!cancelado) setErro('Não foi possível carregar as pessoas agora.'); });
    return () => { cancelado = true; };
  }, [versao, pessoasDemo]);
  return { pessoas, erro, recarregar: () => setVersao((valor) => valor + 1) };
}

/** Confirmação de "Tornar liderança" (o que muda fica claro antes de gravar). */
export function ConfirmarPromocao({ pessoa, autorLogin, onFechar, onPromovida }: {
  pessoa: Pessoa; autorLogin: string; onFechar: () => void; onPromovida: (pessoa: Pessoa) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  async function confirmar() {
    setSalvando(true);
    setErro('');
    try {
      await tornarLideranca(pessoa, autorLogin);
      onPromovida(pessoa);
    } catch (falha) {
      setErro(mensagemErro(falha, 'Não foi possível salvar agora.'));
      setSalvando(false);
    }
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={salvando ? undefined : onFechar}>
      <section className="edit-modal liderancas-confirmar" role="dialog" aria-modal="true" aria-labelledby="confirmar-promocao-titulo"
        onMouseDown={(evento) => evento.stopPropagation()}>
        <h2 id="confirmar-promocao-titulo">Tornar {pessoa.nome} liderança?</h2>
        <p>{pessoa.nome.split(' ')[0]} poderá <strong>criar equipes e Plantões</strong>, cuidar da escala deles e <strong>tornar outras pessoas liderança</strong>. Fica registrado que foi você quem promoveu.</p>
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <div className="liderancas-confirmar-acoes">
          <button type="button" className="secondary-button" disabled={salvando} onClick={onFechar}>Cancelar</button>
          <button type="button" className="primary-button" disabled={salvando} onClick={() => void confirmar()}>
            {salvando ? 'Salvando…' : 'Tornar liderança'}
          </button>
        </div>
      </section>
    </div>
  );
}
