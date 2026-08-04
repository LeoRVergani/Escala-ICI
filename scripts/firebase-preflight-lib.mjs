const VARIAVEIS_OBRIGATORIAS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

const valor = (ambiente, nome) => ambiente[nome]?.trim() ?? '';

function booleanoEstrito(ambiente, nome, padrao = false) {
  const recebido = valor(ambiente, nome);
  if (recebido === '') {
    return { valor: padrao };
  }
  if (recebido === 'true') {
    return { valor: true };
  }
  if (recebido === 'false') {
    return { valor: false };
  }
  return {
    valor: padrao,
    erro: `${nome} deve ser exatamente "true" ou "false".`,
  };
}

function hostLocal(host) {
  return host === 'localhost' || host === '127.0.0.1';
}

function hostIpv4Privado(host) {
  const partes = host.split('.').map(Number);
  if (
    partes.length !== 4
    || partes.some((parte) => !Number.isInteger(parte) || parte < 0 || parte > 255)
  ) {
    return false;
  }
  return partes[0] === 10
    || (partes[0] === 172 && partes[1] >= 16 && partes[1] <= 31)
    || (partes[0] === 192 && partes[1] === 168);
}

function hostEmuladorPermitido(ambiente, host, lanAtiva) {
  if (hostLocal(host)) return true;
  const hostLan = valor(ambiente, 'VITE_FIREBASE_LAN_HOST');
  return lanAtiva && hostIpv4Privado(hostLan) && host === hostLan;
}

function validarEmuladores(ambiente, erros, lanAtiva) {
  const authUrl = valor(ambiente, 'VITE_FIREBASE_AUTH_EMULATOR_URL')
    || 'http://127.0.0.1:9099';
  const firestoreHost = valor(ambiente, 'VITE_FIREBASE_FIRESTORE_EMULATOR_HOST')
    || '127.0.0.1';
  const firestorePorta = valor(ambiente, 'VITE_FIREBASE_FIRESTORE_EMULATOR_PORT')
    || '8080';

  try {
    const url = new URL(authUrl);
    if (
      url.protocol !== 'http:'
      || !hostEmuladorPermitido(ambiente, url.hostname, lanAtiva)
    ) {
      erros.push(
        'O emulador de Authentication deve usar HTTP em localhost ou no IPv4 privado autorizado para LAN.',
      );
    }
  } catch {
    erros.push('VITE_FIREBASE_AUTH_EMULATOR_URL não é uma URL válida.');
  }

  if (!hostEmuladorPermitido(ambiente, firestoreHost, lanAtiva)) {
    erros.push(
      'O emulador do Firestore deve usar localhost ou o IPv4 privado autorizado para LAN.',
    );
  }

  const porta = Number(firestorePorta);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    erros.push(
      'VITE_FIREBASE_FIRESTORE_EMULATOR_PORT deve ser uma porta válida.',
    );
  }
}

const CONFIRMACAO_STAGING = 'ESCALA_ICI_STAGING_ONLY';

function projetoDeStaging(projectId) {
  return /(?:^|-)(?:staging|hml|homolog)$/.test(projectId);
}

export function avaliarConfiguracaoFirebase(ambiente, opcoes = {}) {
  const erros = [];
  const avisos = [];
  const ausentes = VARIAVEIS_OBRIGATORIAS.filter(
    (nome) => valor(ambiente, nome) === '',
  );

  if (ausentes.length > 0) {
    erros.push(`Variáveis ausentes: ${ausentes.join(', ')}.`);
  }

  const projectId = valor(ambiente, 'VITE_FIREBASE_PROJECT_ID');
  const authDomain = valor(ambiente, 'VITE_FIREBASE_AUTH_DOMAIN');
  const appId = valor(ambiente, 'VITE_FIREBASE_APP_ID');
  const apiKey = valor(ambiente, 'VITE_FIREBASE_API_KEY');
  const ambienteFirebase = valor(ambiente, 'VITE_FIREBASE_ENVIRONMENT');
  const confirmacaoStaging = valor(ambiente, 'FIREBASE_STAGING_CONFIRMATION');
  const alvo = opcoes.alvo ?? 'seguro';
  const escrita = booleanoEstrito(
    ambiente,
    'VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE',
  );
  const emuladores = booleanoEstrito(
    ambiente,
    'VITE_FIREBASE_USE_EMULATORS',
  );
  const lan = booleanoEstrito(
    ambiente,
    'VITE_FIREBASE_LAN_MODE',
  );

  if (escrita.erro) {
    erros.push(escrita.erro);
  }
  if (emuladores.erro) {
    erros.push(emuladores.erro);
  }
  if (lan.erro) {
    erros.push(lan.erro);
  }

  if (lan.valor) {
    const hostLan = valor(ambiente, 'VITE_FIREBASE_LAN_HOST');
    if (!emuladores.valor) {
      erros.push('VITE_FIREBASE_LAN_MODE exige VITE_FIREBASE_USE_EMULATORS=true.');
    }
    if (ambienteFirebase !== 'local') {
      erros.push('O laboratório LAN exige VITE_FIREBASE_ENVIRONMENT=local.');
    }
    if (!hostIpv4Privado(hostLan)) {
      erros.push('VITE_FIREBASE_LAN_HOST deve ser um IPv4 privado válido.');
    }
  }

  if (
    projectId
    && !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)
  ) {
    erros.push('VITE_FIREBASE_PROJECT_ID não possui um formato válido.');
  }

  if (apiKey && !/^AIza[0-9A-Za-z_-]{35}$/.test(apiKey)) {
    erros.push('VITE_FIREBASE_API_KEY não possui o formato esperado.');
  }

  if (appId && !/^1:\d+:web:[0-9a-fA-F]+$/.test(appId)) {
    erros.push('VITE_FIREBASE_APP_ID não possui o formato esperado para Web.');
  }

  if (authDomain) {
    if (!/^[a-z0-9.-]+$/i.test(authDomain) || authDomain.includes('..')) {
      erros.push('VITE_FIREBASE_AUTH_DOMAIN não possui um domínio válido.');
    } else if (authDomain.endsWith('.firebaseapp.com')) {
      const projetoDoDominio = authDomain.slice(0, -'.firebaseapp.com'.length);
      if (projectId && projetoDoDominio !== projectId) {
        erros.push(
          'VITE_FIREBASE_AUTH_DOMAIN e VITE_FIREBASE_PROJECT_ID apontam para projetos diferentes.',
        );
      }
    } else {
      avisos.push(
        'Domínio personalizado de Authentication detectado; confirme que ele está autorizado no Firebase.',
      );
    }
  }

  if (alvo === 'staging') {
    if (ambienteFirebase !== 'staging') {
      erros.push('VITE_FIREBASE_ENVIRONMENT deve ser exatamente "staging".');
    }
    if (projectId && !projetoDeStaging(projectId)) {
      erros.push(
        'O ID do projeto de homologação deve terminar em -staging, -hml ou -homolog.',
      );
    }
    if (confirmacaoStaging !== CONFIRMACAO_STAGING) {
      erros.push('FIREBASE_STAGING_CONFIRMATION não confirmou o destino de homologação.');
    }
    if (emuladores.valor) {
      erros.push('O preflight de staging não aceita emuladores locais.');
    }
    if (opcoes.exigirEscrita === true && !escrita.valor) {
      erros.push('O Dashboard staging exige VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=true.');
    }
  } else if (escrita.valor) {
    erros.push(
      'A escrita oficial está habilitada. Para este checkpoint, mantenha VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE=false.',
    );
  }

  if (emuladores.valor) {
    validarEmuladores(ambiente, erros, lan.valor);
  }

  const modo = ausentes.length > 0
    ? 'nao-configurado'
    : emuladores.valor
      ? lan.valor ? 'emulador-lan' : 'emulador-local'
      : alvo === 'staging' && escrita.valor
        ? 'firebase-staging-com-escrita'
        : alvo === 'staging'
          ? 'firebase-staging-somente-leitura'
          : escrita.valor
            ? 'firebase-com-escrita'
        : 'firebase-somente-leitura';

  return {
    valido: erros.length === 0,
    modo,
    projeto: projectId || null,
    dominioAutenticacao: authDomain || null,
    escritaOficial: escrita.valor,
    emuladores: emuladores.valor,
    emuladoresLan: lan.valor,
    ambiente: ambienteFirebase || null,
    alvo,
    projetoStaging: projetoDeStaging(projectId),
    erros,
    avisos,
  };
}

export function resumoSeguroFirebase(resultado) {
  return {
    valido: resultado.valido,
    modo: resultado.modo,
    projeto: resultado.projeto,
    dominioAutenticacao: resultado.dominioAutenticacao,
    escritaOficial: resultado.escritaOficial,
    emuladores: resultado.emuladores,
    emuladoresLan: resultado.emuladoresLan,
    ambiente: resultado.ambiente,
    alvo: resultado.alvo,
    projetoStaging: resultado.projetoStaging,
    erros: resultado.erros,
    avisos: resultado.avisos,
  };
}
