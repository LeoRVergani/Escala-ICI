import { describe, expect, it } from 'vitest';

import { escaparHtml, montarHtmlImpressaoEscala } from './escaparHtml';

describe('SEGURANCA-1 — HTML da impressão da escala', () => {
  it('escapa os cinco caracteres que abrem tag ou atributo', () => {
    expect(escaparHtml(`<img src=x onerror="alert(1)">'&\``)).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;&#96;');
    expect(escaparHtml(null)).toBe('');
    expect(escaparHtml(42)).toBe('42');
  });

  it('um login malicioso, uma equipe ou uma competência com markup NUNCA viram tag no documento', () => {
    const html = montarHtmlImpressaoEscala({
      equipe: '</title><script>roubar()</script>',
      competencia: '"><img src=x onerror=roubar()>',
      linhas: [{ login: '<img src=x onerror=roubar()>@x', total: '<script>1</script>' }],
    });
    expect(html).not.toMatch(/<script>|<img |<\/title><script/u);
    expect(html).toContain('&lt;img src=x onerror=roubar()&gt;@x');
    expect(html).toContain('&lt;/title&gt;&lt;script&gt;roubar()&lt;/script&gt;');
  });

  it('o documento proíbe qualquer script mesmo que algo escapasse (defesa em profundidade)', () => {
    const html = montarHtmlImpressaoEscala({ equipe: 'SOC', competencia: '2026-11', linhas: [] });
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`);
  });

  it('com dados normais o resultado continua sendo a tabela esperada', () => {
    const html = montarHtmlImpressaoEscala({ equipe: 'SOC', competencia: '2026-11', linhas: [{ login: 'ana', total: '150h' }, { login: 'bia', total: '144h' }] });
    expect(html).toContain('<title>Escala SOC — 2026-11</title>');
    expect((html.match(/<tr><td>/gu) ?? [])).toHaveLength(2);
    expect(html).toContain('<tr><td>ana</td><td>150h</td></tr>');
  });
});
