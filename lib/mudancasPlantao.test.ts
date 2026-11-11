import { describe, expect, it } from 'vitest';

import { mudancasEntreEscalas, type PlantaoComparavel } from './mudancasPlantao';

const p = (nome: string, data: string, funcao: PlantaoComparavel['funcao'] = null): PlantaoComparavel => ({
  plantonistaNomeOriginal: nome, inicio: { data, hora: '19:00' }, fim: { data: data.replace(/\d+$/u, (d) => String(Number(d) + 1).padStart(2, '0')), hora: '07:00' }, funcao,
});

describe('ESCALA-PLANTAO-3 — o que muda na publicação', () => {
  it('sem diferença: nada', () => {
    expect(mudancasEntreEscalas([p('Bruno', '2026-11-12')], [p('Bruno', '2026-11-12')])).toEqual([]);
  });

  it('mesmo plantão com outra pessoa é TROCA (antes → depois), com horário legível', () => {
    expect(mudancasEntreEscalas([p('Bruno', '2026-11-12')], [p('Jean', '2026-11-12')])).toEqual([
      { tipo: 'TROCA', data: '2026-11-12', horario: '19h–7h', funcao: null, antes: 'Bruno', depois: 'Jean' },
    ]);
  });

  it('plantão novo e plantão retirado, em ordem de data', () => {
    const mudancas = mudancasEntreEscalas([p('Bruno', '2026-11-14')], [p('Caroline', '2026-11-10')]);
    expect(mudancas.map((item) => `${item.tipo}:${item.data}`)).toEqual(['NOVO:2026-11-10', 'RETIRADO:2026-11-14']);
  });

  it('postos diferentes no mesmo horário são plantões diferentes', () => {
    const noAr = [p('Ana', '2026-11-12', 'DBA'), p('Luiz', '2026-11-12', 'LINUX')];
    const nova = [p('Ana', '2026-11-12', 'DBA'), p('Alex', '2026-11-12', 'LINUX')];
    expect(mudancasEntreEscalas(noAr, nova)).toEqual([
      { tipo: 'TROCA', data: '2026-11-12', horario: '19h–7h', funcao: 'LINUX', antes: 'Luiz', depois: 'Alex' },
    ]);
  });
});
