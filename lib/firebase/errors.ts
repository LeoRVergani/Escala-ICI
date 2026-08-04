export function mensagemErroFirebase(falha: unknown, fallback: string): string {
  const codigo = typeof falha === 'object' && falha !== null && 'code' in falha
    ? String(falha.code)
    : '';
  const mensagem = falha instanceof Error ? falha.message : String(falha ?? '');

  if (codigo.includes('permission-denied') || mensagem.includes('PERMISSION_DENIED')) {
    return 'A operação foi recusada pelas regras do laboratório. Atualize o pacote e reinicie o Firebase local.';
  }
  if (mensagem.includes('Partes do identificador')) {
    return 'A escala possui colaborador sem vínculo válido. Corrija ou cadastre os logins antes de publicar.';
  }
  if (mensagem.includes('Property equipeId is undefined')) {
    return 'A consulta da escala não informou a equipe do colaborador.';
  }
  return mensagem.length > 400 ? fallback : mensagem || fallback;
}
