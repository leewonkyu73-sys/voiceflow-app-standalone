import assert from 'node:assert/strict';
import { hydrateSharedHubProviders, resetSharedHubBackoffForTest, sharedHubConfigured } from './lib/shared-hub-provider.mjs';

const baseEnv = () => ({
  INTEGRATION_HUB_RESOLVER_URL: 'https://hub.example.test/resolve',
  INTEGRATION_HUB_APP_TOKEN: 'app-secret-never-log',
  INTEGRATION_HUB_TENANT_ID: 'STAR45',
  INTEGRATION_HUB_SCOPE_ID: 'meeting',
  INTEGRATION_HUB_PROVIDERS: 'openai',
});

assert.equal(sharedHubConfigured(baseEnv()), true);
assert.equal(sharedHubConfigured({}), false);

{
  resetSharedHubBackoffForTest();
  const env = { ...baseEnv(), OPENAI_API_KEY: 'local-key' };
  let calls = 0;
  const result = await hydrateSharedHubProviders({ env, fetchImpl: async () => { calls += 1; throw new Error('must not call'); } });
  assert.equal(calls, 0);
  assert.equal(env.OPENAI_API_KEY, 'local-key');
  assert.deepEqual(result.providers, [{ provider: 'openai', status: 'local' }]);
}

{
  resetSharedHubBackoffForTest();
  const env = baseEnv();
  let authorization = '';
  let requestBody = null;
  const result = await hydrateSharedHubProviders({
    env,
    fetchImpl: async (_url, request) => {
      authorization = request.headers.authorization;
      requestBody = JSON.parse(request.body);
      return { ok: true, status: 200, json: async () => ({ ok: true, credential_version: 3, credentials: { api_key: 'central-key', organization_id: 'org-1' } }) };
    },
  });
  assert.equal(authorization, 'Bearer app-secret-never-log');
  assert.deepEqual(requestBody, { provider: 'openai', tenant_id: 'STAR45', scope_id: 'meeting', purpose: 'provider_execution' });
  assert.equal(env.OPENAI_API_KEY, 'central-key');
  assert.equal(env.OPENAI_ORGANIZATION_ID, 'org-1');
  assert.equal(result.providers[0].status, 'hub');
  assert.equal(JSON.stringify(result).includes('central-key'), false);
}

{
  resetSharedHubBackoffForTest();
  const env = baseEnv();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: false, status: 404, json: async () => ({ error: 'integration_not_resolved' }) }; };
  const first = await hydrateSharedHubProviders({ env, fetchImpl, now: 1000 });
  const second = await hydrateSharedHubProviders({ env, fetchImpl, now: 2000 });
  assert.equal(calls, 1);
  assert.equal(first.providers[0].reason, 'integration_not_resolved');
  assert.equal(second.providers[0].status, 'backoff');
}

console.log('SHARED_HUB_PROVIDER_PASS');
