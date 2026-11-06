import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('SCRIPTS-VM-1 — backup/instalação: sintaxe válida e SEM nenhum segredo no Git', async () => {
  for (const script of ['scripts/vm/backup.sh', 'scripts/vm/instalar.sh']) {
    execFileSync('bash', ['-n', new URL(`../${script}`, import.meta.url).pathname]);
    const texto = await ler(script);
    assert.doesNotMatch(texto, /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, `${script}: chave privada no script`);
    assert.doesNotMatch(texto, /"private_key"\s*:/, `${script}: conta de serviço no script`);
    assert.doesNotMatch(texto, /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/, `${script}: token do GitHub no script`);
    assert.doesNotMatch(texto, /--passphrase\s+["']?[^-\s]/, `${script}: senha escrita no comando`);
    assert.match(texto, /\r?\n/);
    assert.doesNotMatch(texto, /\r\n/, `${script}: precisa ter quebras de linha LF`);
  }
});

test('SCRIPTS-VM-1 — travas de segurança do backup', async () => {
  const backup = await ler('scripts/vm/backup.sh');
  assert.match(backup, /trap 'rm -rf "\$TRABALHO"' EXIT/, 'cópias abertas apagadas até em caso de erro');
  assert.match(backup, /--symmetric --cipher-algo AES256/);
  assert.match(backup, /--pinentry-mode loopback/, 'senha pedida no terminal (sem janela que trava no SSH)');
  assert.match(backup, /umask 077/);
  assert.match(backup, /MANIFESTO\.txt/);
  assert.match(backup, /formato: \$FORMATO/);
});

test('SCRIPTS-VM-1 — travas de segurança da instalação', async () => {
  const instalar = await ler('scripts/vm/instalar.sh');
  assert.match(instalar, /sha256sum -c/, 'confere a integridade do arquivo');
  assert.match(instalar, /grep -q '\^formato: escala-ici-backup-v1'/, 'recusa formato desconhecido');
  assert.match(instalar, /trap 'rm -rf "\$TRABALHO"/, 'backup aberto apagado no fim');
  assert.match(instalar, /guardar_existente/, 'nunca sobrescreve sem guardar cópia');
  assert.match(instalar, /chmod 0440/, 'segredo do push só leitura para o grupo');
  assert.match(instalar, /groupadd -g "\$GRUPO_GID"/, 'recria o grupo com o MESMO GID');
  assert.match(instalar, /chmod 600 "\$HOME_ROOT\/\.git-credentials"/, 'token do Git protegido');
  assert.match(instalar, /umask "\$UMASK_ORIGINAL"/, 'umask restrito só enquanto o backup está aberto');
});
