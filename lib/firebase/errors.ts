/**
 * Ambiente resolvido pela política Firebase (ver `./environment`). Tipo
 * próprio em vez de importar `PoliticaFirebase` para este arquivo continuar
 * sem nenhuma dependência de runtime — é só um rótulo de string.
 */
export type AmbienteErroFirebase = 'local' | 'staging' | 'producao' | 'indefinido';

/**
 * Antes, todo `permission-denied` dizia "regras do laboratório... reinicie o
 * Firebase local" — errado e confuso quando o erro acontece em staging (ou
 * produção), onde não existe emulador nenhum para reiniciar. `ambiente`
 * (terceiro parâmetro, opcional) deixa a mensagem certa para onde o erro de
 * fato ocorreu. Sem informar, cai no texto genérico — nunca assume
 * "laboratório" por padrão.
 */
export function mensagemErroFirebase(
  falha: unknown,
  fallback: string,
  ambiente: AmbienteErroFirebase = 'indefinido',
): string {
  const codigo = typeof falha === 'object' && falha !== null && 'code' in falha
    ? String(falha.code)
    : '';
  const mensagem = falha instanceof Error ? falha.message : String(falha ?? '');

  if (codigo.includes('permission-denied') || mensagem.includes('PERMISSION_DENIED')) {
    if (ambiente === 'local') {
      return 'A operação foi recusada pelas regras do laboratório. Atualize o pacote e reinicie o Firebase local.';
    }
    if (ambiente === 'staging') {
      return 'A operação foi recusada pelas regras do Firestore em staging. Verifique se sua conta tem permissão de gestor para esta ação e se a escrita administrativa está habilitada neste ambiente.';
    }
    return 'A operação foi recusada pelas regras do Firestore. Verifique se sua conta tem permissão de gestor para esta ação.';
  }
  if (mensagem.includes('Partes do identificador')) {
    return 'A escala possui colaborador sem vínculo válido. Corrija ou cadastre os logins antes de publicar.';
  }
  if (mensagem.includes('Property equipeId is undefined')) {
    return 'A consulta da escala não informou a equipe do colaborador.';
  }
  if (mensagem.includes('Unsupported field value: undefined')) {
    return 'Não foi possível salvar porque um cadastro tem um campo incompleto (dado ausente). Tente novamente; se persistir, corrija o cadastro do usuário envolvido.';
  }
  return mensagem.length > 400 ? fallback : mensagem || fallback;
}
