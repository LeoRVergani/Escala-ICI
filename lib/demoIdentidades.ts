import type { Equipe, Usuario } from './modelos';

export const EQUIPE_DEMO: Equipe = {
  id: 'EQ_SOC',
  nome: 'COSI > SOC',
  sigla: 'SOC',
  ativa: true,
};

const IDENTIDADES = [
  ['liavilar', 'Lia Vilar', 'MD'],
  ['noahcampos', 'Noah Campos', 'MD'],
  ['mayanunes', 'Maya Nunes', 'M'],
  ['gaelfreire', 'Gael Freire', 'M'],
  ['irisporto', 'Íris Porto', 'M'],
  ['teosalles', 'Téo Salles', 'T'],
  ['auramatos', 'Aura Matos', 'T'],
  ['nilovalente', 'Nilo Valente', 'N'],
  ['evaprado', 'Eva Prado', 'N'],
] as const;

export const USUARIOS_DEMO: Usuario[] = IDENTIDADES.map(
  ([login, nome, turno], indice) => ({
    uid: `u${indice + 1}`,
    login,
    nome,
    email: `${login}@empresa.com`,
    cargo: 'ANALISTA_SOC',
    equipeId: EQUIPE_DEMO.id,
    gestorUid: 'uid_coord',
    nivelHierarquico: 6,
    turnoPadrao: turno,
    ativo: true,
  }),
);

export const GESTOR_DEMO: Usuario = {
  uid: 'uid_coord',
  login: 'sofiavalente',
  nome: 'Sofia Valente',
  email: 'sofia.valente@teste.local',
  cargo: 'COORDENADOR_SOC',
  equipeId: EQUIPE_DEMO.id,
  gestorUid: null,
  nivelHierarquico: 4,
  turnoPadrao: 'ADM',
  ativo: true,
};

export const LOGIN_PARA_UID = Object.fromEntries(
  USUARIOS_DEMO.map(({ login, uid }) => [login, uid]),
);
