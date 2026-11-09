'use client';

/* eslint-disable @next/next/no-img-element */

import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const CHAVE_DICA_IOS = 'escala-ici-pwa-dica-ios-dispensada';
/** PWA-INSTALAR-1 — aviso de instalar aparece UMA vez por aparelho: fechou, instalou ou recusou, não volta. */
const CHAVE_INSTALACAO_ENCERRADA = 'escala-ici-pwa-instalacao-encerrada';
/** PWA-ATUALIZAR-1 — de quanto em quanto tempo o App confere se saiu versão nova. */
const INTERVALO_VERIFICAR_VERSAO_MS = 15 * 60 * 1000;

function instalacaoEncerrada(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_INSTALACAO_ENCERRADA) === 'true';
  } catch {
    return false;
  }
}

function encerrarInstalacao(): void {
  try {
    window.localStorage.setItem(CHAVE_INSTALACAO_ENCERRADA, 'true');
  } catch {
    // modo privado: só não lembra
  }
}

function estaInstalado(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator
      && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export function PwaProvider({
  children,
  verificarVersaoNova,
}: {
  children: ReactNode;
  /**
   * PWA-ATUALIZAR-1 — recebe o /versao.json publicado e diz se é outra versão
   * que a em execução. Sem ele, só o service worker em espera mostra o aviso.
   */
  verificarVersaoNova?: (publicada: unknown) => boolean;
}) {
  const [online, setOnline] = useState(true);
  const [instalacao, setInstalacao] = useState<BeforeInstallPromptEvent | null>(null);
  const [atualizacao, setAtualizacao] = useState<ServiceWorker | null>(null);
  const [versaoNovaPublicada, setVersaoNovaPublicada] = useState(false);
  const registroRef = useRef<ServiceWorkerRegistration | null>(null);
  const verificarVersaoRef = useRef(verificarVersaoNova);
  useEffect(() => {
    verificarVersaoRef.current = verificarVersaoNova;
  }, [verificarVersaoNova]);
  const [mostrarDicaIos, setMostrarDicaIos] = useState(false);
  const recarregarAoAtivar = useRef(false);

  useEffect(() => {
    const sincronizarConexao = () => setOnline(navigator.onLine);
    const prepararInstalacao = (evento: Event) => {
      evento.preventDefault();
      if (estaInstalado() || instalacaoEncerrada()) {
        return;
      }
      setInstalacao(evento as BeforeInstallPromptEvent);
    };
    const concluirInstalacao = () => {
      encerrarInstalacao();
      setInstalacao(null);
    };

    window.addEventListener('online', sincronizarConexao);
    window.addEventListener('offline', sincronizarConexao);
    window.addEventListener('beforeinstallprompt', prepararInstalacao);
    window.addEventListener('appinstalled', concluirInstalacao);

    const quadro = window.requestAnimationFrame(() => {
      setOnline(navigator.onLine);
      const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
      setMostrarDicaIos(
        ios
        && !estaInstalado()
        && window.localStorage.getItem(CHAVE_DICA_IOS) !== 'true',
      );
    });

    return () => {
      window.cancelAnimationFrame(quadro);
      window.removeEventListener('online', sincronizarConexao);
      window.removeEventListener('offline', sincronizarConexao);
      window.removeEventListener('beforeinstallprompt', prepararInstalacao);
      window.removeEventListener('appinstalled', concluirInstalacao);
    };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined;
    }

    let registro: ServiceWorkerRegistration | null = null;
    let intervalo: number | undefined;

    const observarInstalacao = (worker: ServiceWorker) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setAtualizacao(worker);
        }
      });
    };

    const registrar = async () => {
      try {
        const escopo = window.location.pathname === '/app'
          || window.location.pathname.startsWith('/app/')
          ? '/app'
          : '/';
        registro = await navigator.serviceWorker.register('/service-worker.js', {
          scope: escopo,
          updateViaCache: 'none',
        });
        registroRef.current = registro;
        if (registro.waiting) {
          setAtualizacao(registro.waiting);
        }
        registro.addEventListener('updatefound', () => {
          if (registro?.installing) {
            observarInstalacao(registro.installing);
          }
        });
        intervalo = window.setInterval(() => void registro?.update(), 60 * 60 * 1000);
      } catch {
        // O App continua funcional em navegadores sem ambiente seguro para SW.
      }
    };

    /** PWA-ATUALIZAR-1 — compara o /versao.json publicado com a versão em execução. */
    const verificarVersaoPublicada = async () => {
      const verificar = verificarVersaoRef.current;
      if (!verificar || !navigator.onLine) return;
      try {
        const resposta = await fetch(`/versao.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!resposta.ok) return;
        if (verificar(await resposta.json())) {
          setVersaoNovaPublicada(true);
          void registro?.update();
        }
      } catch {
        // sem rede ou arquivo ausente: tenta de novo mais tarde
      }
    };
    const intervaloVersao = window.setInterval(() => void verificarVersaoPublicada(), INTERVALO_VERIFICAR_VERSAO_MS);
    const primeiraVerificacao = window.setTimeout(() => void verificarVersaoPublicada(), 5000);

    const verificarAoRetornar = () => {
      if (document.visibilityState === 'visible') {
        void registro?.update();
        void verificarVersaoPublicada();
      }
    };
    const recarregar = () => {
      if (recarregarAoAtivar.current) {
        window.location.reload();
      }
    };

    if (document.readyState === 'complete') {
      void registrar();
    } else {
      window.addEventListener('load', registrar, { once: true });
    }
    document.addEventListener('visibilitychange', verificarAoRetornar);
    navigator.serviceWorker.addEventListener('controllerchange', recarregar);

    return () => {
      window.removeEventListener('load', registrar);
      document.removeEventListener('visibilitychange', verificarAoRetornar);
      navigator.serviceWorker.removeEventListener('controllerchange', recarregar);
      if (intervalo !== undefined) {
        window.clearInterval(intervalo);
      }
      window.clearInterval(intervaloVersao);
      window.clearTimeout(primeiraVerificacao);
    };
  }, []);

  async function instalar() {
    if (instalacao === null) {
      return;
    }
    await instalacao.prompt();
    await instalacao.userChoice;
    // Instalou ou recusou a janela do navegador: não pergunta de novo.
    encerrarInstalacao();
    setInstalacao(null);
  }

  /**
   * PWA-ATUALIZAR-1 — funciona nos dois casos: service worker novo em espera
   * (ativa e recarrega) ou só a versão nova publicada (busca o SW novo e
   * recarrega — a navegação é rede-primeiro, então a página vem nova).
   * Se o navegador demorar para trocar, recarrega mesmo assim em 3 s.
   */
  function atualizar() {
    recarregarAoAtivar.current = true;
    if (atualizacao !== null) {
      atualizacao.postMessage({ type: 'SKIP_WAITING' });
      window.setTimeout(() => window.location.reload(), 3000);
      return;
    }
    const registro = registroRef.current;
    void (registro ? registro.update().catch(() => undefined) : Promise.resolve())
      .then(() => {
        const emEspera = registroRef.current?.waiting;
        if (emEspera) {
          emEspera.postMessage({ type: 'SKIP_WAITING' });
          window.setTimeout(() => window.location.reload(), 3000);
        } else {
          window.location.reload();
        }
      });
  }

  function dispensarDicaIos() {
    window.localStorage.setItem(CHAVE_DICA_IOS, 'true');
    setMostrarDicaIos(false);
  }

  return (
    <>
      {children}
      <div className="pwa-messages" aria-live="polite">
        {!online && (
          <aside className="pwa-message offline" role="status">
            <WifiOff size={19} />
            <div>
              <strong>Você está offline</strong>
              <span>As telas e os dados já salvos continuam disponíveis.</span>
            </div>
          </aside>
        )}
        {(atualizacao || versaoNovaPublicada) && (
          <aside className="pwa-message update" role="status">
            <RefreshCw size={19} />
            <div>
              <strong>Nova versão disponível</strong>
              <span>Toque em Atualizar para usar a versão mais recente.</span>
            </div>
            <button type="button" onClick={atualizar}>Atualizar</button>
          </aside>
        )}
        {instalacao && (
          <aside className="pwa-message install" role="status">
            <img src="/icons/favicon-48.png" alt="" />
            <div>
              <strong>Instalar Escala ICI</strong>
              <span>Acesse sua escala como um aplicativo.</span>
            </div>
            <button type="button" onClick={() => void instalar()}>
              <Download size={16} /> Instalar
            </button>
            <button
              className="pwa-dismiss"
              type="button"
              onClick={() => {
                encerrarInstalacao();
                setInstalacao(null);
              }}
              aria-label="Dispensar instalação"
            >
              <X size={17} />
            </button>
          </aside>
        )}
        {mostrarDicaIos && (
          <aside className="pwa-message ios" role="status">
            <img src="/icons/favicon-48.png" alt="" />
            <div>
              <strong>Instale no iPhone ou iPad</strong>
              <span>No Safari, use Compartilhar → Adicionar à Tela de Início.</span>
            </div>
            <button
              className="pwa-dismiss"
              type="button"
              onClick={dispensarDicaIos}
              aria-label="Dispensar instrução de instalação"
            >
              <X size={17} />
            </button>
          </aside>
        )}
      </div>
    </>
  );
}
