'use client';

import { Building2, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { FormEvent, useState } from 'react';

import { GESTOR_DEMO, USUARIOS_DEMO } from '@/lib/demoIdentidades';
import { firebaseConfigurado, microsoftProviderConfigurado } from '@/lib/firebase/client';
import {
  entrarComEmail,
  entrarComMicrosoft,
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
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [metodoCarregando, setMetodoCarregando] = useState<'MICROSOFT' | 'EMAIL' | null>(null);
  const sessao = useRestauracaoSessao({
    tipo,
    delegada: sessaoDelegada,
    aoRestaurar: (restaurado) => onEntrar(restaurado, false),
  });
  const verificandoSessao = deveExibirRestauracao(sessao.estado);
  const manterConectado = sessao.manterConectado;
  const erro = erroEnvio || sessao.erro;
  const microsoftDisponivel = firebaseConfigurado && microsoftProviderConfigurado();
  const acaoEmAndamento = metodoCarregando !== null || verificandoSessao;

  async function autenticarComProvedor(
    metodo: 'MICROSOFT' | 'EMAIL',
    executar: () => Promise<Usuario>,
  ) {
    setErroEnvio('');
    sessao.definirErro('');
    setMetodoCarregando(metodo);
    try {
      sessao.gravarPreferencia(manterConectado);
      const usuario = await executar();
      if (tipo === 'dashboard' && !nivelPermiteDashboard(usuario.nivelHierarquico)) {
        await sair();
        throw new Error(MENSAGEM_SEM_PERMISSAO_DASHBOARD);
      }
      await onEntrar(usuario, false);
    } catch (falha) {
      setErroEnvio(mensagemErroAutenticacao(falha));
    } finally {
      setMetodoCarregando(null);
    }
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    await autenticarComProvedor('EMAIL', () => entrarComEmail(email, senha, manterConectado));
  }

  async function entrarComProvedorMicrosoft() {
    await autenticarComProvedor('MICROSOFT', () => entrarComMicrosoft(manterConectado));
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
        <div className="login-hero-copy login-hero-copy-full">
          <p className="eyebrow">Gestão segura e integrada</p>
          <h1>Escalas claras para equipes que não podem parar.</h1>
          <p>
            Importe, valide, publique e consulte jornadas em um fluxo único,
            preparado para Firebase Spark.
          </p>
        </div>
        <div className="login-feature">
          <LockKeyhole size={20} />
          <span>Autenticação corporativa protegida pelo Firebase</span>
        </div>
      </section>

      <section className="login-card-wrap">
        <form className="login-card" onSubmit={enviar}>
          <div>
            <p className="eyebrow">{tipo === 'dashboard' ? 'Área de gestão' : 'Área do colaborador'}</p>
            <h2>{titulo}</h2>
            <p>Entre com sua conta corporativa para continuar.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={entrarComProvedorMicrosoft}
            disabled={!microsoftDisponivel || acaoEmAndamento}
          >
            {metodoCarregando === 'MICROSOFT'
              ? <LoaderCircle className="spin" size={17} aria-hidden="true" />
              : <Building2 size={17} aria-hidden="true" />}
            Entrar com Microsoft
          </button>
          {firebaseConfigurado && !microsoftProviderConfigurado() && (
            <p className="configuration-note">
              Login Microsoft ainda não configurado neste ambiente.
            </p>
          )}
          <div className="login-auth-divider" role="separator" aria-hidden="true">
            <span />
            <small>ou</small>
            <span />
          </div>
          <label>
            E-mail
            <span className="login-field-input">
              <Mail size={17} aria-hidden="true" />
              <input
                type="email"
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
                placeholder="seu@email.com"
                required
                disabled={!firebaseConfigurado || acaoEmAndamento}
              />
            </span>
          </label>
          <label>
            Senha
            <span className="login-field-input">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(evento) => setSenha(evento.target.value)}
                placeholder="Digite sua senha"
                required
                disabled={!firebaseConfigurado || acaoEmAndamento}
              />
              <button
                className="login-toggle-senha"
                type="button"
                onClick={() => setMostrarSenha((atual) => !atual)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                disabled={!firebaseConfigurado || acaoEmAndamento}
              >
                {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          <label className="login-trusted-device">
            <input
              type="checkbox"
              checked={manterConectado}
              onChange={(evento) => sessao.definirManterConectado(evento.target.checked)}
              disabled={!firebaseConfigurado || acaoEmAndamento}
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
            disabled={!firebaseConfigurado || acaoEmAndamento}
          >
            {(metodoCarregando === 'EMAIL' || verificandoSessao)
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
            disabled={acaoEmAndamento}
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
