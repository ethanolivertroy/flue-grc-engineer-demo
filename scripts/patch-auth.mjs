import { readFile, writeFile } from 'node:fs/promises';

const entryPath = new URL('../dist/_entry.ts', import.meta.url);
let entry = await readFile(entryPath, 'utf8');

if (!entry.includes('function requireAgentAuth(request, env)')) {
  entry = entry.replace(
    '// ─── Worker Fetch Handler ───────────────────────────────────────────────────',
    `function jsonError(message, status, extraHeaders = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}

function requireAgentAuth(request, env) {
  const mode = env.GRC_AUTH_MODE || 'token';

  if (mode === 'none') {
    return null;
  }

  if (mode === 'cloudflare-access') {
    // Cloudflare Access should enforce identity before the request reaches this Worker.
    // This guard fails closed if the expected Access identity header is absent.
    const email = request.headers.get('cf-access-authenticated-user-email');
    if (!email) {
      return jsonError('Unauthorized: Cloudflare Access identity is missing', 401);
    }

    // Optional comma-separated allowlist, for example:
    // GRC_ACCESS_ALLOWED_EMAILS="alice@example.com,bob@example.com"
    const allowed = (env.GRC_ACCESS_ALLOWED_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (allowed.length > 0 && !allowed.includes(email.toLowerCase())) {
      return jsonError('Forbidden: Cloudflare Access user is not allowed', 403);
    }

    return null;
  }

  if (mode !== 'token') {
    return jsonError('GRC_AUTH_MODE must be one of: token, cloudflare-access, none', 500);
  }

  const expected = env.GRC_AGENT_TOKEN;
  if (!expected) {
    return jsonError('GRC_AGENT_TOKEN is not configured', 500);
  }

  const actual = request.headers.get('authorization') || '';
  if (actual !== \`Bearer \${expected}\`) {
    return jsonError('Unauthorized', 401, { 'www-authenticate': 'Bearer' });
  }

  return null;
}

// ─── Worker Fetch Handler ───────────────────────────────────────────────────`,
  );
}

const authCheck = `
    // Require configured auth for all agent routes.
    if (url.pathname === '/agents' || url.pathname.startsWith('/agents/')) {
      const unauthorized = requireAgentAuth(request, env);
      if (unauthorized) return unauthorized;
    }
`;

if (!entry.includes('Require configured auth for all agent routes')) {
  entry = entry.replace(
    `    // Agent manifest
    if (url.pathname === '/agents' && request.method === 'GET') {`,
    `${authCheck}
    // Agent manifest
    if (url.pathname === '/agents' && request.method === 'GET') {`,
  );
}

await writeFile(entryPath, entry);
console.log('[auth] Patched dist/_entry.ts with configurable auth');
