export interface PoliticaFirebase {
  emuladoresLocais: boolean;
  emuladoresLan: boolean;
  emuladoresLaboratorio: boolean;
  escritaOficial: boolean;
  escritaAdministrativa: boolean;
  ambiente: 'local' | 'staging' | 'producao' | 'indefinido';
  projetoStaging: boolean;
}

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1']);

export function hostIpv4Privado(host: string | undefined): boolean {
  if (host === undefined) return false;
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

function projetoDeStaging(projectId: string | boolean | undefined): boolean {
  return typeof projectId === 'string'
    && /(?:^|-)(?:staging|hml|homolog)$/.test(projectId.trim());
}

export function resolverPoliticaFirebase(
  ambiente: Record<string, string | boolean | undefined>,
  hostname: string | undefined,
): PoliticaFirebase {
  const emuladoresSolicitados = ambiente.VITE_FIREBASE_USE_EMULATORS === 'true';
  const emuladoresLocais = emuladoresSolicitados
    && hostname !== undefined
    && HOSTS_LOCAIS.has(hostname);
  const hostLan = typeof ambiente.VITE_FIREBASE_LAN_HOST === 'string'
    ? ambiente.VITE_FIREBASE_LAN_HOST.trim()
    : '';
  const emuladoresLan = emuladoresSolicitados
    && ambiente.VITE_FIREBASE_LAN_MODE === 'true'
    && ambiente.VITE_FIREBASE_ENVIRONMENT === 'local'
    && hostIpv4Privado(hostLan)
    && hostname === hostLan;
  const emuladoresLaboratorio = emuladoresLocais || emuladoresLan;
  const ambienteDeclarado = ambiente.VITE_FIREBASE_ENVIRONMENT;
  const ambienteResolvido = ambienteDeclarado === 'local'
    || ambienteDeclarado === 'staging'
    || ambienteDeclarado === 'producao'
    ? ambienteDeclarado
    : 'indefinido';
  const projetoStaging = projetoDeStaging(ambiente.VITE_FIREBASE_PROJECT_ID);
  const escritaOficial = ambiente.VITE_ALLOW_OFFICIAL_FIRESTORE_WRITE === 'true'
    && ambienteResolvido === 'staging'
    && projetoStaging
    && !emuladoresSolicitados;

  return {
    emuladoresLocais,
    emuladoresLan,
    emuladoresLaboratorio,
    escritaOficial,
    escritaAdministrativa: emuladoresLaboratorio || escritaOficial,
    ambiente: ambienteResolvido,
    projetoStaging,
  };
}
