const host = process.argv[2]?.trim() ?? '';

function ipv4Privado(valor) {
  const partes = valor.split('.').map(Number);
  if (
    partes.length !== 4
    || partes.some((parte) => !Number.isInteger(parte) || parte < 0 || parte > 255)
  ) {
    return false;
  }
  return partes[0] === 10
    || (partes[0] === 172 && partes[1] >= 16 && partes[1] <= 31)
    || (partes[0] === 192 && partes[1] === 168);
}

if (!ipv4Privado(host)) {
  console.error(
    '[ERRO] Informe um IPv4 privado válido: 10.x.x.x, 172.16-31.x.x ou 192.168.x.x.',
  );
  process.exit(1);
}

console.log(`[OK] IPv4 privado autorizado para o laboratório LAN: ${host}`);
