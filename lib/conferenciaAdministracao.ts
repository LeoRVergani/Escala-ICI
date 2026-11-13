import type { GrupoPlantao } from '@escala-ici/contrato';

import { ehLideranca } from './liderancas';
import type { Equipe, EscopoOperacional, Usuario } from './modelos';

/**
 * ADMIN-CONFERENCIA-1 — o que está inconsistente na administração, cada item
 * com a sua correção (levar à tela certa ou corrigir num clique). Função pura.
 */
export type AcaoConferencia =
  | { tipo: 'IR'; destino: 'equipes' | 'plantoes' | 'colaboradores' }
  | { tipo: 'DESATIVAR_VINCULO'; escopo: EscopoOperacional }
  | { tipo: 'REMOVER_RESPONSAVEL'; escopo: EscopoOperacional; login: string };

export interface ProblemaConferencia {
  chave: string;
  gravidade: 'alta' | 'media';
  titulo: string;
  detalhe: string;
  rotuloAcao: string;
  acao: AcaoConferencia;
}

function escopoAtivo(escopos: readonly EscopoOperacional[], tipo: 'JORNADA' | 'PLANTAO', alvoId: string) {
  return escopos.find((escopo) => escopo.tipo === tipo && escopo.alvoId === alvoId && escopo.ativo !== false) ?? null;
}

export function conferirAdministracao(dados: {
  equipes: readonly Equipe[];
  grupos: readonly GrupoPlantao[];
  escopos: readonly EscopoOperacional[];
  usuarios: readonly Usuario[];
}): ProblemaConferencia[] {
  const problemas: ProblemaConferencia[] = [];
  const equipePorId = new Map(dados.equipes.map((equipe) => [equipe.id, equipe]));
  const grupoPorId = new Map(dados.grupos.map((grupo) => [grupo.grupoId, grupo]));
  const usuarioPorLogin = new Map(dados.usuarios.map((usuario) => [usuario.login, usuario]));
  // Sem a lista de pessoas carregada (vazia), NÃO julga responsáveis nem pessoas: enquanto ela
  // carrega, todo responsável pareceria "sem cadastro" — com um botão de um clique para removê-lo.
  const pessoasCarregadas = dados.usuarios.length > 0;

  for (const equipe of dados.equipes.filter((item) => item.ativa !== false)) {
    const escopo = escopoAtivo(dados.escopos, 'JORNADA', equipe.id);
    if (!escopo || escopo.responsaveisLogin.length === 0) {
      problemas.push({ chave: `sem-lideranca-${equipe.id}`, gravidade: 'alta', titulo: `${equipe.nome} está sem liderança`,
        detalhe: 'Ninguém cuida da escala desta equipe: não dá para publicar nem aprovar trocas.',
        rotuloAcao: 'Definir liderança', acao: { tipo: 'IR', destino: 'equipes' } });
    }
  }
  for (const grupo of dados.grupos.filter((item) => item.ativo)) {
    const escopo = escopoAtivo(dados.escopos, 'PLANTAO', grupo.grupoId);
    if (!escopo || escopo.responsaveisLogin.length === 0) {
      problemas.push({ chave: `sem-responsavel-${grupo.grupoId}`, gravidade: 'alta', titulo: `${grupo.nome} está sem responsável`,
        detalhe: 'Ninguém cuida da escala deste Plantão.',
        rotuloAcao: 'Definir responsável', acao: { tipo: 'IR', destino: 'plantoes' } });
    }
    const equipe = equipePorId.get(grupo.equipeResponsavelId);
    if (!equipe || equipe.ativa === false) {
      problemas.push({ chave: `plantao-sem-equipe-${grupo.grupoId}`, gravidade: 'media', titulo: `${grupo.nome} está ligado a uma equipe ${equipe ? 'inativa' : 'que não existe'}`,
        detalhe: 'Escolha a equipe certa do Plantão.', rotuloAcao: 'Ver Plantões', acao: { tipo: 'IR', destino: 'plantoes' } });
    }
  }
  for (const escopo of dados.escopos.filter((item) => item.ativo !== false)) {
    const alvoExiste = escopo.tipo === 'JORNADA' ? equipePorId.has(escopo.alvoId) : grupoPorId.has(escopo.alvoId);
    if (!alvoExiste) {
      problemas.push({ chave: `vinculo-sem-alvo-${escopo.tipo}-${escopo.alvoId}`, gravidade: 'media',
        titulo: `Responsáveis de "${escopo.alvoNome || escopo.alvoId}", que não existe mais`,
        detalhe: `Um vínculo de responsável aponta para ${escopo.tipo === 'JORNADA' ? 'uma equipe' : 'um Plantão'} que foi removido.`,
        rotuloAcao: 'Desativar vínculo', acao: { tipo: 'DESATIVAR_VINCULO', escopo } });
      continue;
    }
    for (const login of pessoasCarregadas ? escopo.responsaveisLogin : []) {
      const pessoa = usuarioPorLogin.get(login);
      const motivo = !pessoa ? 'não tem mais cadastro' : pessoa.ativo === false ? 'está inativa' : !ehLideranca(pessoa) ? 'não é liderança' : null;
      if (motivo) {
        problemas.push({ chave: `responsavel-invalido-${escopo.tipo}-${escopo.alvoId}-${login}`, gravidade: 'media',
          titulo: `${pessoa?.nome ?? login} cuida de ${escopo.alvoNome || escopo.alvoId}, mas ${motivo}`,
          detalhe: 'Tire a pessoa da responsabilidade (e, se preciso, defina outra liderança).',
          rotuloAcao: 'Tirar da responsabilidade', acao: { tipo: 'REMOVER_RESPONSAVEL', escopo, login } });
      }
    }
  }
  const semEquipe = dados.usuarios.filter((usuario) => usuario.ativo !== false && !ehLideranca(usuario)
    && (usuario.equipeId === '' || !equipePorId.has(usuario.equipeId)));
  if (pessoasCarregadas && semEquipe.length > 0) {
    problemas.push({ chave: 'pessoas-sem-equipe', gravidade: 'media',
      titulo: semEquipe.length === 1 ? `${semEquipe[0]?.nome} está sem equipe` : `${semEquipe.length} pessoas estão sem equipe`,
      detalhe: 'Sem equipe, a pessoa não vê escala no App.', rotuloAcao: 'Ver colaboradores', acao: { tipo: 'IR', destino: 'colaboradores' } });
  }
  return problemas.sort((a, b) => (a.gravidade === b.gravidade ? a.titulo.localeCompare(b.titulo, 'pt-BR') : a.gravidade === 'alta' ? -1 : 1));
}
