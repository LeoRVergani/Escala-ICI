import { describe, expect, it } from 'vitest';

import {
  mapaLogins,
  normalizarAliasesPlanilha,
  novoUsuario,
  validarEdicaoUsuario,
} from './importUsers';
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

  it('marca como pendente de vínculo quando nenhum UID de autenticação é informado', () => {
    const usuario = novoUsuario(1, gestora, 'login.xls', true);
    expect(usuario.pendenteVinculo).toBe(true);
    expect(usuario.uid.startsWith('pendente-')).toBe(true);
  });

  it('usa o UID de autenticação informado e não marca como pendente', () => {
    const usuario = novoUsuario(1, gestora, 'cmonteiro', true, 'uid-real-do-auth');
    expect(usuario.uid).toBe('uid-real-do-auth');
    expect(usuario.pendenteVinculo).toBe(false);
  });

  it('registra criadoEm e atualizadoEm com o instante informado', () => {
    const usuario = novoUsuario(1, gestora, 'login.xls', true, undefined, '2026-08-05T00:00:00.000Z');
    expect(usuario.criadoEm).toBe('2026-08-05T00:00:00.000Z');
    expect(usuario.atualizadoEm).toBe('2026-08-05T00:00:00.000Z');
  });
});

describe('validação de edição de usuário', () => {
  const equipe: Usuario[] = [
    { ...gestora },
    { ...gestora, uid: 'colega', login: 'colega.login', email: 'colega@teste.local' },
  ];

  it('aceita uma edição consistente', () => {
    expect(validarEdicaoUsuario(gestora, equipe)).toEqual([]);
  });

  it('recusa nome, e-mail e login vazios', () => {
    const erros = validarEdicaoUsuario({ ...gestora, nome: ' ', email: 'invalido', login: '' }, equipe);
    expect(erros).toContain('Informe o nome do colaborador.');
    expect(erros).toContain('Informe um e-mail válido.');
    expect(erros).toContain('Informe o login usado na planilha.');
  });

  it('recusa login já usado por outro colaborador ativo da equipe', () => {
    const erros = validarEdicaoUsuario({ ...gestora, login: 'colega.login' }, equipe);
    expect(erros).toContain('Este login já está em uso por outro colaborador ativo da equipe.');
  });

  it('recusa nível hierárquico inválido', () => {
    const erros = validarEdicaoUsuario({ ...gestora, nivelHierarquico: 0 }, equipe);
    expect(erros).toContain('Informe um nível hierárquico válido.');
  });

  it('ignora conflito de login com cadastro inativo', () => {
    const equipeComInativo: Usuario[] = [
      { ...gestora },
      { ...gestora, uid: 'uid-inativo', login: 'colega.login', ativo: false },
    ];
    expect(validarEdicaoUsuario({ ...gestora, login: 'colega.login' }, equipeComInativo)).toEqual([]);
  });

  it('ignora conflito de login com cadastro já substituído', () => {
    const equipeComSubstituido: Usuario[] = [
      { ...gestora },
      {
        ...gestora,
        uid: 'uid-antigo',
        login: 'colega.login',
        ativo: true,
        substituidoPorUid: 'algum-uid',
      },
    ];
    expect(validarEdicaoUsuario({ ...gestora, login: 'colega.login' }, equipeComSubstituido)).toEqual([]);
  });
});

describe('normalização de aliases da planilha', () => {
  it('remove vazios e duplicidades normalizadas, mantendo a primeira grafia', () => {
    expect(normalizarAliasesPlanilha([
      'Caio M.',
      '  ',
      'caio m.',
      'CAIO M.',
      'Outro Alias',
    ])).toEqual(['Caio M.', 'Outro Alias']);
  });
});
