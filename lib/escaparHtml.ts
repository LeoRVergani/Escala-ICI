/**
 * SEGURANCA-1 — HTML montado à mão a partir de dados (login, equipe, competência) NUNCA entra sem escapar:
 * quem controla um login controlaria a página. Usado na janela de impressão da escala.
 */
const SUBSTITUTOS: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function escaparHtml(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"'`]/gu, (caractere) => SUBSTITUTOS[caractere] ?? caractere);
}

export interface DadosImpressaoEscala {
  equipe: string;
  competencia: string;
  linhas: ReadonlyArray<{ login: string; total: string }>;
}

/**
 * O documento da janela de impressão. A janela é do MESMO domínio (herda a sessão do Firebase), então
 * além de escapar cada valor o documento traz uma Content-Security-Policy que proíbe qualquer script.
 */
export function montarHtmlImpressaoEscala(dados: DadosImpressaoEscala): string {
  const linhas = dados.linhas.map((linha) => `<tr><td>${escaparHtml(linha.login)}</td><td>${escaparHtml(linha.total)}</td></tr>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">`
    + `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`
    + `<title>Escala ${escaparHtml(dados.equipe)} — ${escaparHtml(dados.competencia)}</title></head><body>`
    + `<table border="1" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;">`
    + `<thead><tr><th>Login</th><th>Total</th></tr></thead><tbody>${linhas}</tbody></table></body></html>`;
}
