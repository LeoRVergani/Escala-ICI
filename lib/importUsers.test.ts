import { describe, expect, it } from 'vitest';

import { mapaLogins, novoUsuario } from './importUsers';
import type { Usuario } from './modelos';

const gestora: Usuario = {
  uid: 'gestora-cosi-soc',
  login: 'mazevedo',
  nome: 'Marina Azevedo',
  email: 'marina.azevedo@teste.local',
  cargo: 'COORDENADORA_SOC',
  equipeId: 'EQ_COSI_SOC',
  gestorUid: null,
  nivelHierarquico: 4,
  turnoPadrao: 'ADM',
  ativo: true,
};

describe('usuários da importação', () => {
  it('mantém novos logins na equipe e sob a gestão da pessoa autenticada', () => {
    const usuario = novoUsuario(1, gestora, 'login.xls', true);
    expect(usuario.equipeId).toBe('EQ_COSI_SOC');
    expect(usuario.gestorUid).toBe(gestora.uid);
    expect(usuario.login).toBe('login.xls');
    expect(usuario.ativo).toBe(true);
  });

  it('resolve login principal e aliases para o mesmo UID', () => {
    const mapa = mapaLogins([{
      ...gestora,
      login: 'cmonteiro',
      loginAliases: ['liavilar'],
    }]);
    expect(mapa.cmonteiro).toBe(gestora.uid);
    expect(mapa.liavilar).toBe(gestora.uid);
  });
});
