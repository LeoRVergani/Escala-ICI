import { describe, expect, it } from 'vitest';

import {
  mapaLogins,
  normalizarAliasesPlanilha,
  novoUsuario,
  validarEdicaoUsuario,
} from './importUsers';
import type { Usuario } from './modelos';

const gestora: Usuario = {
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
    expect(usuario.gestorUid).toBeNull();
    expect(usuario.login).toBe('login.xls');
    expect(usuario.ativo).toBe(true);
  });

  it('resolve login principal e aliases para o mesmo login oficial', () => {
    const mapa = mapaLogins([{
      ...gestora,
      login: 'cmonteiro',
      loginAliases: ['liavilar'],
    }]);
    expect(mapa.cmonteiro).toBe('cmonteiro');
    expect(mapa.liavilar).toBe('cmonteiro');
  });

  it('não gera nenhum UID: o login é a chave e o cadastro nasce sem pendência', () => {
    const usuario = novoUsuario(1, gestora, 'login.xls', true);
    expect(usuario.uid).toBeUndefined();
  });

  it('registra criadoEm e atualizadoEm com o instante informado', () => {
    const usuario = novoUsuario(1, gestora, 'login.xls', true, '2026-08-05T00:00:00.000Z');
    expect(usuario.criadoEm).toBe('2026-08-05T00:00:00.000Z');
    expect(usuario.atualizadoEm).toBe('2026-08-05T00:00:00.000Z');
  });

  /**
   * Causa raiz da AUTH-2C: `cargo` é texto livre puramente descritivo (nunca
   * usado por `firestore.rules` nem por `perfilEfetivo()`), mas nascia com
   * `'ANALISTA_SOC'` fixo, mesmo para colaboradores de equipes diferentes
   * (NOC, Suporte, ...) cadastrados via `cadastrarFaltantes()`. `cargo` deve
   * nascer vazio para qualquer equipe — nunca herdar o texto de outra área.
   */
  it('nasce com cargo vazio para um gestor de equipe SOC — não infere cargo', () => {
    const usuario = novoUsuario(1, gestora, 'login.xls', true);
    expect(usuario.cargo).toBe('');
  });

  it('nasce com cargo vazio para um gestor de equipe NOC — nunca herda ANALISTA_SOC', () => {
    const gestorNoc: Usuario = { ...gestora, login: 'gestor.noc', equipeId: 'EQ_NOC' };
    const usuario = novoUsuario(1, gestorNoc, 'analista.noc', true);
    expect(usuario.cargo).toBe('');
    expect(usuario.cargo).not.toBe('ANALISTA_SOC');
    expect(usuario.equipeId).toBe('EQ_NOC');
  });

  it('nasce com cargo vazio para um gestor de equipe de Suporte — nunca herda ANALISTA_SOC', () => {
    const gestorSuporte: Usuario = { ...gestora, login: 'gestor.suporte', equipeId: 'EQ_SUPORTE' };
    const usuario = novoUsuario(1, gestorSuporte, 'analista.suporte', true);
    expect(usuario.cargo).toBe('');
    expect(usuario.cargo).not.toBe('ANALISTA_SOC');
    expect(usuario.equipeId).toBe('EQ_SUPORTE');
  });

  it('nunca define perfil automaticamente — autorização continua vindo do fallback por nivelHierarquico', () => {
    const gestorNoc: Usuario = { ...gestora, equipeId: 'EQ_NOC' };
    const usuario = novoUsuario(1, gestorNoc, 'analista.noc', true);
    expect(usuario.perfil).toBeUndefined();
    expect(usuario.nivelHierarquico).toBe(6);
  });
});

describe('validação de edição de usuário', () => {
  const equipe: Usuario[] = [
    { ...gestora },
    { ...gestora, login: 'colega.login', email: 'colega@teste.local' },
  ];

  it('aceita uma edição consistente', () => {
    expect(validarEdicaoUsuario(gestora, equipe, gestora.login)).toEqual([]);
  });

  it('recusa nome, e-mail, login e cargo vazios', () => {
    const erros = validarEdicaoUsuario(
      { ...gestora, nome: ' ', email: 'invalido', login: '', cargo: '  ' },
      equipe,
      gestora.login,
    );
    expect(erros).toContain('Informe o nome do colaborador.');
    expect(erros).toContain('Informe um e-mail válido.');
    expect(erros).toContain('Informe o login usado na planilha.');
    expect(erros).toContain('Informe o cargo do colaborador.');
  });

  it('recusa login já usado por outro colaborador ativo da equipe ao cadastrar', () => {
    const erros = validarEdicaoUsuario({ ...gestora, login: 'colega.login' }, equipe, null);
    expect(erros).toContain('Este login já está em uso por outro colaborador ativo da equipe.');
  });

  it('recusa nível hierárquico inválido', () => {
    const erros = validarEdicaoUsuario({ ...gestora, nivelHierarquico: 0 }, equipe, gestora.login);
    expect(erros).toContain('Informe um nível hierárquico válido.');
  });

  /**
   * Fase ESCALAS-UX-2B.2 — `equipeId` vazio nunca pode ser salvo: nem um
   * cadastro genérico, nem um cadastro iniciado a partir de um Grupo de
   * Plantão (que nunca é fonte segura de equipeId — ver `DashboardApp.tsx`).
   */
  it('recusa equipeId vazio', () => {
    const erros = validarEdicaoUsuario({ ...gestora, equipeId: '' }, equipe, gestora.login);
    expect(erros).toContain('Selecione a equipe do colaborador.');
  });

  it('recusa equipeId só com espaços', () => {
    const erros = validarEdicaoUsuario({ ...gestora, equipeId: '   ' }, equipe, gestora.login);
    expect(erros).toContain('Selecione a equipe do colaborador.');
  });

  it('ignora conflito de login com cadastro inativo', () => {
    const equipeComInativo: Usuario[] = [
      { ...gestora },
      { ...gestora, login: 'colega.login', ativo: false },
    ];
    expect(validarEdicaoUsuario({ ...gestora, login: 'colega.login' }, equipeComInativo, null)).toEqual([]);
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
