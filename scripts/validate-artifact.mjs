import { access, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { projectRoot } from './runtime-env.mjs';

export async function validateArtifact() {
  const workerPath = resolve(projectRoot, 'dist', 'server', 'index.js');
  const hostingPath = resolve(projectRoot, 'dist', '.openai', 'hosting.json');

  await access(workerPath).catch(() => {
    throw new Error('Missing Sites Worker entry: dist/server/index.js');
  });
  await access(hostingPath).catch(() => {
    throw new Error('Missing packaged Sites manifest: dist/.openai/hosting.json');
  });

  JSON.parse(await readFile(hostingPath, 'utf8'));
  const workerUrl = pathToFileURL(workerPath);
  workerUrl.searchParams.set('sites-validation', `${process.pid}-${Date.now()}`);
  const worker = await import(workerUrl.href);
  if (!worker.default || typeof worker.default.fetch !== 'function') {
    throw new Error(
      'dist/server/index.js must have an ESM default export with fetch(request, env, ctx)',
    );
  }

  console.log(
    'Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await validateArtifact().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
