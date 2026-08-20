import { describe, expect, it } from 'vitest';
import { areaNavegacaoDaTela } from './navegacaoDashboard';

describe('areaNavegacaoDaTela — Fase ESCALAS-UX-2A (navegação != tela interna)', () => {
  it('visao -> visao', () => {
    expect(areaNavegacaoDaTela('visao')).toBe('visao');
  });

  it('escalas -> escalas', () => {
    expect(areaNavegacaoDaTela('escalas')).toBe('escalas');
  });

  it('importar -> escalas', () => {
    expect(areaNavegacaoDaTela('importar')).toBe('escalas');
  });

  it('grade -> escalas', () => {
    expect(areaNavegacaoDaTela('grade')).toBe('escalas');
  });

  it('trocas -> trocas', () => {
    expect(areaNavegacaoDaTela('trocas')).toBe('trocas');
  });

  it('usuarios -> usuarios', () => {
    expect(areaNavegacaoDaTela('usuarios')).toBe('usuarios');
  });

  it('administracao -> administracao', () => {
    expect(areaNavegacaoDaTela('administracao')).toBe('administracao');
  });

  it('plantoes -> administracao', () => {
    expect(areaNavegacaoDaTela('plantoes')).toBe('administracao');
  });

  it('responsaveisEscala -> administracao', () => {
    expect(areaNavegacaoDaTela('responsaveisEscala')).toBe('administracao');
  });
});
