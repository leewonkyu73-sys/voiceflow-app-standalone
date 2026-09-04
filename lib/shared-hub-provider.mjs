const DEFAULT_PROVIDERS = ['openai', 'gemini', 'deepl'];

const PROVIDER_ENV = {
  openai: { api_key: 'OPENAI_API_KEY', base_url: 'OPENAI_BASE_URL', organization_id: 'OPENAI_ORGANIZATION_ID', project_id: 'OPENAI_PROJECT_ID' },
  gemini: { api_key: 'GEMINI_API_KEY', base_url: 'GEMINI_API_URL' },
  deepl: { api_key: 'DEEPL_API_KEY', base_url: 'DEEPL_API_URL' },
};

const retryAfter = new Map();

function setting(env, name) {
  return String(env[name] || '').trim();
}

function providerList(env) {
  return (setting(env, 'INTEGRATION_HUB_PROVIDERS') || DEFAULT_PROVIDERS.join(','))
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => PROVIDER_ENV[value]);
}

export function sharedHubConfigured(env = process.env) {
  return Boolean(
    setting(env, 'INTEGRATION_HUB_RESOLVER_URL') &&
    setting(env, 'INTEGRATION_HUB_APP_TOKEN') &&
    setting(env, 'INTEGRATION_HUB_TENANT_ID') &&
    setting(env, 'INTEGRATION_HUB_SCOPE_ID')
  );
}

export async function resolveSharedHubProvider(provider, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!sharedHubConfigured(env)) return { ok: false, provider, reason: 'hub_not_configured' };

  const response = await fetchImpl(setting(env, 'INTEGRATION_HUB_RESOLVER_URL'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${setting(env, 'INTEGRATION_HUB_APP_TOKEN')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      provider,
      tenant_id: setting(env, 'INTEGRATION_HUB_TENANT_ID'),
      scope_id: setting(env, 'INTEGRATION_HUB_SCOPE_ID'),
      purpose: 'provider_execution',
    }),
    signal: options.signal || AbortSignal.timeout(Number(env.INTEGRATION_HUB_TIMEOUT_MS || 5000)),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !data?.credentials || typeof data.credentials !== 'object') {
    return { ok: false, provider, reason: String(data?.error || `http_${response.status}`) };
  }
  return { ok: true, provider, credentials: data.credentials, credentialVersion: data.credential_version };
}

export async function hydrateSharedHubProviders(options = {}) {
  const env = options.env || process.env;
  const now = options.now || Date.now();
  if (!sharedHubConfigured(env)) return { configured: false, providers: [] };

  const providers = [];
  for (const provider of providerList(env)) {
    const mapping = PROVIDER_ENV[provider];
    if (setting(env, mapping.api_key)) {
      providers.push({ provider, status: 'local' });
      continue;
    }
    if ((retryAfter.get(provider) || 0) > now) {
      providers.push({ provider, status: 'backoff' });
      continue;
    }
    try {
      const result = await resolveSharedHubProvider(provider, options);
      if (!result.ok) {
        retryAfter.set(provider, now + Number(env.INTEGRATION_HUB_RETRY_MS || 60000));
        providers.push({ provider, status: 'unavailable', reason: result.reason });
        continue;
      }
      for (const [credentialName, envName] of Object.entries(mapping)) {
        const value = String(result.credentials[credentialName] || '').trim();
        if (value && !setting(env, envName)) env[envName] = value;
      }
      providers.push({ provider, status: setting(env, mapping.api_key) ? 'hub' : 'invalid' });
    } catch (error) {
      retryAfter.set(provider, now + Number(env.INTEGRATION_HUB_RETRY_MS || 60000));
      providers.push({ provider, status: 'unavailable', reason: error?.name === 'TimeoutError' ? 'timeout' : 'request_failed' });
    }
  }
  return { configured: true, providers };
}

export function resetSharedHubBackoffForTest() {
  retryAfter.clear();
}
