/**
 * Fase ESCALAS-UX-2A — a sidebar principal do Dashboard passou a refletir
 * ÁREAS reais do produto (`AreaNavegacaoDashboard`), não mais uma lista 1:1
 * das telas internas (`TelaDashboard`). "Importar"/"Grade" são formas de
 * trabalhar dentro da área "Escalas"; "Plantões" (administração de Grupo)
 * é uma sub-tela da área "Administração" — nenhuma das três é mais um
 * destino de sidebar próprio, mas todas continuam existindo como `Tela`
 * (ver `docs/spec/REDESIGN_WORKSPACE_ESCALAS.md` § 5).
 *
 * `areaNavegacaoDaTela()` é o ÚNICO lugar que sabe esse mapeamento — nunca
 * espalhar esse ternário pelo JSX do Dashboard (item de item ativo da
 * sidebar, breadcrumbs, etc. todos derivam daqui).
 */
export type TelaDashboard =
  | 'visao'
  | 'importar'
  | 'escalas'
  | 'grade'
  | 'usuarios'
  | 'trocas'
  | 'plantoes'
  | 'responsaveisEscala'
  | 'administracao';

export type AreaNavegacaoDashboard = 'visao' | 'escalas' | 'trocas' | 'usuarios' | 'administracao';

export function areaNavegacaoDaTela(tela: TelaDashboard): AreaNavegacaoDashboard {
  switch (tela) {
    case 'importar':
    case 'grade':
      return 'escalas';
    case 'plantoes':
    case 'responsaveisEscala':
      return 'administracao';
    default:
      return tela;
  }
}
