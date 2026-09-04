import { resolveSharedHubProvider } from '../lib/shared-hub-provider.mjs';

const AUTHORIZED_PROVIDER_GAPS = new Set(['integration_not_resolved', 'credential_not_available']);

export function assessProviderHubAccess(result) {
  if (result?.ok) return { ok: true, providerReady: true, reason: 'credential_resolved' };
  const reason = String(result?.reason || 'unknown_error');
  if (AUTHORIZED_PROVIDER_GAPS.has(reason)) return { ok: true, providerReady: false, reason };
  return { ok: false, providerReady: false, reason };
}

export async function verifyProviderHubAccess(provider = 'openai', options = {}) {
  const result = await resolveSharedHubProvider(provider, options);
  const assessment = assessProviderHubAccess(result);
  if (!assessment.ok) throw new Error(`provider_hub_access_failed:${assessment.reason}`);
  console.log(`PROVIDER_HUB_AUTH_PASS provider=${provider} credential=${assessment.providerReady ? 'ready' : 'blocked'} reason=${assessment.reason}`);
  return assessment;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await verifyProviderHubAccess(String(process.argv[2] || 'openai').toLowerCase());
}
