export function idDocumento(
  equipeId: string,
  usuarioUid: string,
  competencia: string,
): string {
  const partes = [equipeId, usuarioUid, competencia].map((parte) => parte.trim());
  if (partes.some((parte) => parte === '' || parte.includes('/'))) {
    throw new Error('Partes do identificador não podem ser vazias nem conter "/".');
  }
  return partes.join('_');
}
