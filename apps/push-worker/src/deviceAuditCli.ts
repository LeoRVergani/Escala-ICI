export function lerLoginAuditoriaDoArgv(argv: string[]): string {
  const arg = argv.find((valor) => valor.startsWith('--login='));
  if (!arg) {
    throw new Error('Uso: npm run devices:audit -- --login=<login>');
  }
  const login = arg.slice('--login='.length).trim();
  if (login === '') {
    throw new Error('Uso: npm run devices:audit -- --login=<login>');
  }
  return login;
}
