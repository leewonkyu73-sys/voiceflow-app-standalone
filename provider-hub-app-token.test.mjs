import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureProviderHubAppToken } from './scripts/install-provider-hub-app-token.mjs';

const directory = await mkdtemp(join(tmpdir(), 'voiceflow-hub-token-'));
const envPath = join(directory, '.env');

try {
  await writeFile(envPath, 'NODE_ENV=production\nINTEGRATION_HUB_TENANT_ID=star45\n', { mode: 0o644 });
  const first = await ensureProviderHubAppToken(envPath);
  const firstContent = await readFile(envPath, 'utf8');
  const token = firstContent.match(/^INTEGRATION_HUB_APP_TOKEN=(.+)$/m)?.[1] || '';

  assert.equal(first.created, true);
  assert.match(first.tokenSha256, /^[a-f0-9]{64}$/);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(JSON.stringify(first).includes(token), false);
  assert.equal((await stat(envPath)).mode & 0o777, 0o600);
  assert.equal((firstContent.match(/^INTEGRATION_HUB_APP_TOKEN=/gm) || []).length, 1);
  assert.equal((firstContent.match(/^INTEGRATION_HUB_TENANT_ID=/gm) || []).length, 1);
  assert.match(firstContent, /^INTEGRATION_HUB_TENANT_ID=STAR45$/m);
  assert.match(firstContent, /^INTEGRATION_HUB_SCOPE_ID=meeting$/m);
  assert.match(firstContent, /^INTEGRATION_HUB_PROVIDERS=openai,gemini,deepl$/m);

  const second = await ensureProviderHubAppToken(envPath);
  const secondContent = await readFile(envPath, 'utf8');
  assert.equal(second.created, false);
  assert.equal(second.tokenSha256, first.tokenSha256);
  assert.equal(secondContent.match(/^INTEGRATION_HUB_APP_TOKEN=(.+)$/m)?.[1], token);
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log('PROVIDER_HUB_APP_TOKEN_PASS');
