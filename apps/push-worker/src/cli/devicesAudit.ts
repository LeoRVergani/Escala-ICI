import { ConfigError, loadConfig } from '../config.js';
import { lerLoginAuditoriaDoArgv } from '../deviceAuditCli.js';
import { auditDevicesByLogin } from '../deviceRepository.js';
import { initAdmin } from '../firebaseAdmin.js';

async function main(): Promise<void> {
  const login = lerLoginAuditoriaDoArgv(process.argv.slice(2));
  const config = loadConfig();
  const { db } = initAdmin(config);
  const resultado = await auditDevicesByLogin(db, login);

  console.info(JSON.stringify(resultado, null, 2));
}

main().catch((erro: unknown) => {
  if (erro instanceof ConfigError) {
    console.error(`${erro.code}: ${erro.message}`);
  } else {
    console.error('devices:audit falhou:', erro instanceof Error ? erro.message : String(erro));
  }
  process.exit(1);
});
