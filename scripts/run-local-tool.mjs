import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createRuntimeEnv, projectRoot } from './runtime-env.mjs';

const tools = {
  lint: {
    entry: resolve(projectRoot, 'node_modules', 'eslint', 'bin', 'eslint.js'),
    args: [
      '.',
      '--ignore-pattern', 'dist',
      '--ignore-pattern', '.next',
      '--ignore-pattern', '.firebase-runtime',
      '--ignore-pattern', '.sites-runtime',
    ],
  },
  'db-generate': {
    entry: resolve(projectRoot, 'node_modules', 'drizzle-kit', 'bin.cjs'),
    args: ['generate'],
  },
};

const selected = tools[process.argv[2]];
if (selected === undefined) {
  console.error('Uso: node scripts/run-local-tool.mjs lint|db-generate');
  process.exit(64);
}

if (!existsSync(selected.entry)) {
  console.error('Ferramenta local não encontrada. Execute npm ci e tente novamente.');
  process.exit(69);
}

const result = spawnSync(process.execPath, [selected.entry, ...selected.args], {
  cwd: projectRoot,
  env: createRuntimeEnv(),
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(`Não foi possível executar a ferramenta: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
