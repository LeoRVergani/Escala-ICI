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

function estaInstalado(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator
      && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [instalacao, setInstalacao] = useState<BeforeInstallPromptEvent | null>(null);
  const [atualizacao, setAtualizacao] = useState<ServiceWorker | null>(null);
  const [mostrarDicaIos, setMostrarDicaIos] = useState(false);
  const recarregarAoAtivar = useRef(false);

  useEffect(() => {
    const sincronizarConexao = () => setOnline(navigator.onLine);
    const prepararInstalacao = (evento: Event) => {
      evento.preventDefault();
      setInstalacao(evento as BeforeInstallPromptEvent);
    };
    const concluirInstalacao = () => setInstalacao(null);

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

    const verificarAoRetornar = () => {
      if (document.visibilityState === 'visible') {
        void registro?.update();
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
    };
  }, []);

  async function instalar() {
    if (instalacao === null) {
      return;
    }
    await instalacao.prompt();
    await instalacao.userChoice;
    setInstalacao(null);
  }

  function atualizar() {
    if (atualizacao === null) {
      return;
    }
    recarregarAoAtivar.current = true;
    atualizacao.postMessage({ type: 'SKIP_WAITING' });
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
        {atualizacao && (
          <aside className="pwa-message update" role="status">
            <RefreshCw size={19} />
            <div>
              <strong>Nova versão pronta</strong>
              <span>Atualize quando for conveniente.</span>
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
              onClick={() => setInstalacao(null)}
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
