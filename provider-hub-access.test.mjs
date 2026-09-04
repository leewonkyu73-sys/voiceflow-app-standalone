import assert from 'node:assert/strict';
import { assessProviderHubAccess, verifyProviderHubAccess } from './scripts/verify-provider-hub-access.mjs';

assert.deepEqual(
  assessProviderHubAccess({ ok: true }),
  { ok: true, providerReady: true, reason: 'credential_resolved' },
);
assert.deepEqual(
  assessProviderHubAccess({ ok: false, reason: 'integration_not_resolved' }),
  { ok: true, providerReady: false, reason: 'integration_not_resolved' },
);
assert.deepEqual(
  assessProviderHubAccess({ ok: false, reason: 'credential_not_available' }),
  { ok: true, providerReady: false, reason: 'credential_not_available' },
);
assert.deepEqual(
  assessProviderHubAccess({ ok: false, reason: 'worker_auth_required' }),
  { ok: false, providerReady: false, reason: 'worker_auth_required' },
);

const env = {
  INTEGRATION_HUB_RESOLVER_URL: 'https://hub.example.test/resolve',
  INTEGRATION_HUB_APP_TOKEN: 'server-only-token',
  INTEGRATION_HUB_TENANT_ID: 'STAR45',
  INTEGRATION_HUB_SCOPE_ID: 'meeting',
};
const assessment = await verifyProviderHubAccess('openai', {
  env,
  fetchImpl: async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: 'integration_not_resolved' }),
  }),
});
assert.equal(assessment.ok, true);
assert.equal(assessment.providerReady, false);

await assert.rejects(
  verifyProviderHubAccess('openai', {
    env,
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'worker_auth_required' }),
    }),
  }),
  /provider_hub_access_failed:worker_auth_required/,
);

console.log('PROVIDER_HUB_ACCESS_PASS');
