import {
  CATALOGO_SOC,
  parsePlanilhaEscala,
  type ResultadoParse,
} from '@escala-ici/contrato';

import {
  EQUIPE_DEMO,
  GESTOR_DEMO,
  LOGIN_PARA_LOGIN,
} from './demoIdentidades';

export {
  EQUIPE_DEMO,
  GESTOR_DEMO,
  LOGIN_PARA_LOGIN,
  USUARIOS_DEMO,
} from './demoIdentidades';

export async function carregarEscalaDemonstracao(): Promise<ResultadoParse> {
  const resposta = await fetch('/demo/Escala-SOC-Controle-Agosto.xls');
  if (!resposta.ok) {
    throw new Error('Não foi possível carregar a planilha de demonstração.');
  }

  const resultado = parsePlanilhaEscala(await resposta.arrayBuffer(), {
    equipeId: EQUIPE_DEMO.id,
    competencia: '2026-08',
    catalogo: CATALOGO_SOC,
    loginParaUid: LOGIN_PARA_LOGIN,
  });

  return {
    ...resultado,
    documentos: resultado.documentos.map((documento) => ({
      ...documento,
      status: 'PUBLICADA',
      importacaoId: 'demo-agosto-2026',
      publicadoPor: GESTOR_DEMO.login,
      publicadoEm: '2026-07-29T12:00:00.000Z',
    })),
  };
}
