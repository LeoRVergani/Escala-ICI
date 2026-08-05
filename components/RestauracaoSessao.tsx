'use client';

import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  mensagemErroAutenticacao,
  observarSessao,
  sair,
} from '@/lib/firebase/authRepository';
import { firebaseConfigurado } from '@/lib/firebase/client';
import type { Usuario } from '@/lib/modelos';
import {
  MENSAGEM_SEM_PERMISSAO_DASHBOARD,
  chavePreferenciaSessao,
  estadoInicialSessao,
  nivelPermiteDashboard,
  resolverManterConectado,
  type EstadoSessao,
  type TipoProduto,
} from '@/lib/sessao';
import { BrandMark } from './BrandMark';

export interface RestauracaoSessao {
  estado: EstadoSessao;
  erro: string;
  manterConectado: boolean;
  definirManterConectado: (valor: boolean) => void;
  definirErro: (mensagem: string) => void;
  gravarPreferencia: (valor: boolean) => void;
}

/**
 * Se o Auth ou a leitura do usuário travarem, o produto libera o login em vez
 * de ficar preso na tela de restauração. O observador continua ativo: se a
 * sessão for resolvida depois, o produto abre sozinho.
 */
const TEMPO_LIMITE_RESTAURACAO_MS = 8_000;

interface OpcoesRestauracaoSessao {
  tipo: TipoProduto;
  /**
   * Quando `true`, outro componente já observa a sessão e este apenas lê a
   * preferência do dispositivo. Evita dois observadores concorrentes.
   */
  delegada?: boolean;
  aoRestaurar: (usuario: Usuario) => Promise<void> | void;
}

/**
 * Observa o Firebase Auth uma única vez e mantém a interface fora do login
 * enquanto a sessão local ainda está sendo restaurada.
 *
 * O estado só sai de `restaurando` depois que `aoRestaurar` termina, de modo que
 * o produto nunca aparece com dados vazios enquanto o usuário do Firestore e a
 * escala estão sendo carregados.
 */
export function useRestauracaoSessao({
  tipo,
  delegada = false,
  aoRestaurar,
}: OpcoesRestauracaoSessao): RestauracaoSessao {
  const chavePreferencia = chavePreferenciaSessao(tipo);
  const [estado, setEstado] = useState<EstadoSessao>(() => estadoInicialSessao({
    firebaseConfigurado,
    restauracaoDelegada: delegada,
  }));
  const [erro, setErro] = useState('');
  const [manterConectado, setManterConectado] = useState(
    () => resolverManterConectado(tipo, null),
  );
  const restaurar = useRef(aoRestaurar);

  useEffect(() => {
    restaurar.current = aoRestaurar;
  }, [aoRestaurar]);

  useEffect(() => {
    let encerrado = false;
    let cancelar = () => {};
    let temporizador: number | undefined;
    const quadro = window.requestAnimationFrame(() => {
      const persistir = resolverManterConectado(
        tipo,
        window.localStorage.getItem(chavePreferencia),
      );
      setManterConectado(persistir);

      if (delegada || !firebaseConfigurado) {
        setEstado('ausente');
        return;
      }

      const finalizar = (proximo: EstadoSessao) => {
        if (encerrado) {
          return;
        }
        window.clearTimeout(temporizador);
        cancelar();
        setEstado(proximo);
      };

      temporizador = window.setTimeout(() => {
        if (!encerrado) {
          setEstado((atual) => (atual === 'restaurando' ? 'ausente' : atual));
        }
      }, TEMPO_LIMITE_RESTAURACAO_MS);

      cancelar = observarSessao(
        persistir,
        (restaurado) => {
          if (restaurado === null) {
            finalizar('ausente');
            return;
          }
          if (tipo === 'dashboard' && !nivelPermiteDashboard(restaurado.nivelHierarquico)) {
            void sair()
              .then(() => setErro(MENSAGEM_SEM_PERMISSAO_DASHBOARD))
              .finally(() => finalizar('ausente'));
            return;
          }
          void Promise.resolve(restaurar.current(restaurado))
            .then(() => finalizar('ativa'))
            .catch((falha: unknown) => {
              setErro(mensagemErroAutenticacao(falha));
              finalizar('ausente');
            });
        },
        (falha) => {
          setErro(mensagemErroAutenticacao(falha));
          finalizar('ausente');
        },
      );
    });

    return () => {
      encerrado = true;
      window.cancelAnimationFrame(quadro);
      window.clearTimeout(temporizador);
      cancelar();
    };
  }, [chavePreferencia, delegada, tipo]);

  return {
    estado,
    erro,
    manterConectado,
    definirManterConectado: setManterConectado,
    definirErro: setErro,
    gravarPreferencia: (valor: boolean) => {
      window.localStorage.setItem(chavePreferencia, String(valor));
    },
  };
}

/**
 * Tela exibida enquanto a sessão é restaurada. Substitui o login para não
 * piscar a tela inicial no PWA instalado.
 */
export function TelaRestaurandoSessao() {
  return (
    <main className="session-restore" aria-busy="true">
      <div className="session-restore-card" role="status" aria-live="polite">
        <BrandMark className="brand-mark" />
        <strong>Escala ICI</strong>
        <span className="session-restore-status">
          <LoaderCircle className="spin" size={18} />
          Restaurando sessão…
        </span>
        <small>Verificando seu acesso neste dispositivo.</small>
      </div>
    </main>
  );
}
