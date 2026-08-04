import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function createRuntimeEnv() {
  const runtimeRoot = resolve(
    process.env.SITES_RUNTIME_ROOT ?? resolve(projectRoot, '.sites-runtime'),
  );
  const paths = {
    home: resolve(runtimeRoot, 'home'),
    npmCache: resolve(runtimeRoot, 'npm-cache'),
    xdgConfig: resolve(runtimeRoot, 'xdg-config'),
    tmp: resolve(runtimeRoot, 'tmp'),
    wranglerLogs: resolve(runtimeRoot, 'wrangler', 'logs'),
    miniflareRegistry: resolve(runtimeRoot, 'wrangler', 'registry'),
  };

  for (const directory of Object.values(paths)) {
    mkdirSync(directory, { recursive: true });
  }

  const env = {
    ...process.env,
    SITES_ENV_READY: '1',
    SITES_PROJECT_ROOT: projectRoot,
    HOME: paths.home,
    XDG_CONFIG_HOME: paths.xdgConfig,
    TMPDIR: paths.tmp,
    WRANGLER_WRITE_LOGS: 'false',
    WRANGLER_LOG_PATH: paths.wranglerLogs,
    MINIFLARE_REGISTRY_PATH: paths.miniflareRegistry,
    npm_config_cache: paths.npmCache,
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
  };

  for (const key of [
    'npm_config_proxy',
    'npm_config_http_proxy',
    'npm_config_https_proxy',
    'NPM_CONFIG_PROXY',
    'NPM_CONFIG_HTTP_PROXY',
    'NPM_CONFIG_HTTPS_PROXY',
    'NPM_CONFIG_CACHE',
  ]) {
    delete env[key];
  }

  return env;
}
