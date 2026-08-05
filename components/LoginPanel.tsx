'use client';

import { LoaderCircle, LockKeyhole } from 'lucide-react';
import { FormEvent, useState } from 'react';

import { GESTOR_DEMO, USUARIOS_DEMO } from '@/lib/demoIdentidades';
import { firebaseConfigurado } from '@/lib/firebase/client';
import {
  entrarComEmail,
  mensagemErroAutenticacao,
  sair,
} from '@/lib/firebase/authRepository';
import type { Usuario } from '@/lib/modelos';
import {
  MENSAGEM_SEM_PERMISSAO_DASHBOARD,
  deveExibirRestauracao,
  nivelPermiteDashboard,
} from '@/lib/sessao';
import { BrandMark } from './BrandMark';
import { useRestauracaoSessao } from './RestauracaoSessao';
import { ThemeToggle } from './ThemeProvider';

interface LoginPanelProps {
  tipo: 'dashboard' | 'app';
  /**
   * Quando `true`, o produto já restaurou a sessão antes de montar o login
   * (é o caso do App, que exibe a tela "Restaurando sessão…").
   */
  sessaoDelegada?: boolean;
  onEntrar: (
    usuario: Usuario,
    demonstracao: boolean,
  ) => Promise<void> | void;
}

export function LoginPanel({
  tipo,
  sessaoDelegada = false,
  onEntrar,
}: LoginPanelProps) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroEnvio, setErroEnvio] = useState('');
  const [carregando, setCarregando] = useState(false);
  const sessao = useRestauracaoSessao({
    tipo,
    delegada: sessaoDelegada,
    aoRestaurar: (restaurado) => onEntrar(restaurado, false),
  });
  const verificandoSessao = deveExibirRestauracao(sessao.estado);
  const manterConectado = sessao.manterConectado;
  const erro = erroEnvio || sessao.erro;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroEnvio('');
    sessao.definirErro('');
    setCarregando(true);
    try {
      sessao.gravarPreferencia(manterConectado);
      const usuario = await entrarComEmail(email, senha, manterConectado);
      if (tipo === 'dashboard' && !nivelPermiteDashboard(usuario.nivelHierarquico)) {
        await sair();
        throw new Error(MENSAGEM_SEM_PERMISSAO_DASHBOARD);
      }
      await onEntrar(usuario, false);
    } catch (falha) {
      setErroEnvio(mensagemErroAutenticacao(falha));
    } finally {
      setCarregando(false);
    }
  }

  const titulo = tipo === 'dashboard' ? 'Dashboard de escalas' : 'Minha escala';

  return (
    <main className="login-page">
      <div className="login-theme"><ThemeToggle /></div>
      <section className="login-showcase">
        <div className="login-brand">
          <BrandMark />
          <strong>Escala ICI</strong>
        </div>
        <div>
          <p className="eyebrow">Gestão segura e integrada</p>
          <h1>Escalas claras para equipes que não podem parar.</h1>
          <p>
            Importe, valide, publique e consulte jornadas em um fluxo único,
            preparado para Firebase Spark.
          </p>
        </div>
        <div className="login-feature">
          <LockKeyhole size={20} />
          <span>Autenticação por e-mail e permissões protegidas no Firestore</span>
        </div>
      </section>

      <section className="login-card-wrap">
        <form className="login-card" onSubmit={enviar}>
          <div>
            <p className="eyebrow">{tipo === 'dashboard' ? 'Área de gestão' : 'Área do colaborador'}</p>
            <h2>{titulo}</h2>
            <p>Entre com sua conta corporativa para continuar.</p>
          </div>
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              placeholder="nome@empresa.com"
              required
              disabled={!firebaseConfigurado || verificandoSessao}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              placeholder="••••••••"
              required
              disabled={!firebaseConfigurado || verificandoSessao}
            />
          </label>
          <label className="login-trusted-device">
            <input
              type="checkbox"
              checked={manterConectado}
              onChange={(evento) => sessao.definirManterConectado(evento.target.checked)}
              disabled={!firebaseConfigurado || verificandoSessao}
            />
            <span>
              Manter conectado e permitir consulta offline neste dispositivo
              <small>Desmarque em computadores compartilhados.</small>
            </span>
          </label>
          {erro && <div className="alert error" role="alert">{erro}</div>}
          <button
            className="primary-button"
            type="submit"
            disabled={!firebaseConfigurado || carregando || verificandoSessao}
          >
            {(carregando || verificandoSessao)
              && <LoaderCircle className="spin" size={17} />}
            {verificandoSessao ? 'Verificando sessão…' : 'Entrar'}
          </button>
          {!firebaseConfigurado && (
            <p className="configuration-note">
              Firebase ainda não configurado neste ambiente. Use a demonstração
              para conhecer todas as telas.
            </p>
          )}
          <button
            className="secondary-button"
            type="button"
            onClick={() => onEntrar(
              tipo === 'dashboard' ? GESTOR_DEMO : USUARIOS_DEMO[1]!,
              true,
            )}
          >
            Entrar na demonstração
          </button>
        </form>
      </section>
    </main>
  );
}
