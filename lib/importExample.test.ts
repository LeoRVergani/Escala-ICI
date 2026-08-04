import { CATALOGO_SOC, parsePlanilhaEscala } from '@escala-ici/contrato';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { mapaLogins } from './importUsers';
import type { Usuario } from './modelos';

const identidades = [
  ['cmonteiro', 'liavilar'],
  ['bsalles', 'noahcampos'],
  ['etavares', 'mayanunes'],
  ['gaelfreire'],
  ['irisporto'],
  ['teosalles'],
  ['auramatos'],
  ['nilovalente'],
  ['evaprado'],
] as const;

describe('planilha incluída no laboratório', () => {
  it('é importada sem inconsistências com os usuários do seed local', async () => {
    const usuarios: Usuario[] = identidades.map(([login, alias], indice) => ({
      uid: `usuario-${indice}`,
      login,
      loginAliases: alias ? [alias] : [],
      nome: login,
      email: `${login}@teste.local`,
      cargo: 'ANALISTA_SOC',
      equipeId: 'EQ_COSI_SOC',
      gestorUid: 'gestora',
      nivelHierarquico: 6,
      turnoPadrao: 'M',
      ativo: true,
    }));
    const arquivo = await readFile(
      new URL('../public/demo/Escala-SOC-Controle-Agosto.xls', import.meta.url),
    );
    const buffer = arquivo.buffer.slice(
      arquivo.byteOffset,
      arquivo.byteOffset + arquivo.byteLength,
    ) as ArrayBuffer;
    const resultado = parsePlanilhaEscala(buffer, {
      equipeId: 'EQ_COSI_SOC',
      competencia: '2026-08',
      catalogo: CATALOGO_SOC,
      loginParaUid: mapaLogins(usuarios),
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.erros).toEqual([]);
    expect(resultado.documentos).toHaveLength(9);
    expect(resultado.documentos[0]?.usuarioUid).toBe('usuario-0');
  });
});
