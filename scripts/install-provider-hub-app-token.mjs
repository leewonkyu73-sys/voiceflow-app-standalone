import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HUB_VALUES = {
  INTEGRATION_HUB_RESOLVER_URL: 'https://tozzxkpvpkqanhmxetpu.supabase.co/functions/v1/star45-worker-credential-resolver',
  INTEGRATION_HUB_TENANT_ID: 'STAR45',
  INTEGRATION_HUB_SCOPE_ID: 'meeting',
  INTEGRATION_HUB_PROVIDERS: 'openai,gemini,deepl',
};

function currentValue(content, key) {
  const prefix = `${key}=`;
  const values = String(content).split(/\r?\n/).filter((line) => line.startsWith(prefix));
  return values.length ? values.at(-1).slice(prefix.length).trim() : '';
}

function replaceValues(content, values) {
  const keys = new Set(Object.keys(values));
  const retained = String(content)
    .split(/\r?\n/)
    .filter((line) => !keys.has(line.slice(0, line.indexOf('='))))
    .filter((line, index, lines) => line || index < lines.length - 1);
  while (retained.length && retained.at(-1) === '') retained.pop();
  return `${retained.join('\n')}${retained.length ? '\n' : ''}${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

export async function ensureProviderHubAppToken(envPath = '.env') {
  const absolutePath = resolve(envPath);
  let content = '';
  try {
    content = await readFile(absolutePath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  let token = currentValue(content, 'INTEGRATION_HUB_APP_TOKEN');
  const created = !token;
  if (created) token = randomBytes(32).toString('base64url');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('invalid_integration_hub_app_token');

  const next = replaceValues(content, { ...HUB_VALUES, INTEGRATION_HUB_APP_TOKEN: token });
  await mkdir(dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, next, { encoding: 'utf8', mode: 0o600 });
  await rename(temporaryPath, absolutePath);
  await chmod(absolutePath, 0o600);

  return {
    created,
    tokenSha256: createHash('sha256').update(token).digest('hex'),
  };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  const result = await ensureProviderHubAppToken(process.argv[2] || '.env');
  console.log(`PROVIDER_HUB_APP_TOKEN_READY created=${result.created ? 'yes' : 'no'} sha256=${result.tokenSha256}`);
}
