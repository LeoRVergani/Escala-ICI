import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createRuntimeEnv, projectRoot } from './runtime-env.mjs';
import { validateArtifact } from './validate-artifact.mjs';

const vinext = resolve(projectRoot, 'node_modules', 'vinext', 'dist', 'cli.js');
if (!existsSync(vinext)) {
  console.error('vinext is unavailable. Run npm ci and try again.');
  process.exit(69);
}

const timeout = Number(process.env.SITES_BUILD_TIMEOUT_MS ?? 180_000);
console.log('Running bounded vinext build...');
const result = spawnSync(process.execPath, [vinext, 'build'], {
  cwd: projectRoot,
  env: createRuntimeEnv(),
  stdio: 'inherit',
  shell: false,
  timeout,
  killSignal: 'SIGTERM',
});

if (result.error) {
  const message = result.error.code === 'ETIMEDOUT'
    ? `Vinext build exceeded ${timeout} ms.`
    : `Vinext build failed to start: ${result.error.message}`;
  console.error(message);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`Vinext build exited with code ${result.status ?? 'unknown'}.`);
  process.exit(result.status ?? 1);
}

await validateArtifact().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
