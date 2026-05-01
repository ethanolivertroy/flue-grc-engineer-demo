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

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

async function verifyCloudflareAccessJwt(request, env) {
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return { ok: false, response: jsonError('Unauthorized: Cloudflare Access JWT is missing', 401) };

  const teamName = env.GRC_ACCESS_TEAM_NAME;
  const expectedAud = env.GRC_ACCESS_AUD;
  if (!teamName || !expectedAud) {
    return { ok: false, response: jsonError('GRC_ACCESS_TEAM_NAME and GRC_ACCESS_AUD are required for Cloudflare Access auth', 500) };
  }

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, response: jsonError('Unauthorized: malformed Access JWT', 401) };

  let header;
  let payload;
  try {
    header = decodeJwtPart(parts[0]);
    payload = decodeJwtPart(parts[1]);
  } catch {
    return { ok: false, response: jsonError('Unauthorized: invalid Access JWT encoding', 401) };
  }

  if (header.alg !== 'RS256' || !header.kid) {
    return { ok: false, response: jsonError('Unauthorized: unsupported Access JWT header', 401) };
  }

  const certsResponse = await fetch(\`https://\${teamName}.cloudflareaccess.com/cdn-cgi/access/certs\`);
  if (!certsResponse.ok) {
    return { ok: false, response: jsonError('Could not fetch Cloudflare Access signing keys', 500) };
  }

  const certs = await certsResponse.json();
  const jwk = certs.keys?.find((key) => key.kid === header.kid);
  if (!jwk) return { ok: false, response: jsonError('Unauthorized: unknown Access JWT key id', 401) };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signedData = new TextEncoder().encode(\`\${parts[0]}.\${parts[1]}\`);
  const signature = base64UrlToBytes(parts[2]);
  const validSignature = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData);
  if (!validSignature) return { ok: false, response: jsonError('Unauthorized: invalid Access JWT signature', 401) };

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return { ok: false, response: jsonError('Unauthorized: Access JWT expired', 401) };
  if (payload.nbf && payload.nbf > now) return { ok: false, response: jsonError('Unauthorized: Access JWT not active yet', 401) };

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(expectedAud)) {
    return { ok: false, response: jsonError('Unauthorized: Access JWT audience mismatch', 401) };
  }

  return { ok: true, email: payload.email || null };
}

async function requireAgentAuth(request, env) {
  const mode = env.GRC_AUTH_MODE || 'token';

  if (mode === 'none') {
    return null;
  }

  if (mode === 'cloudflare-access') {
    // Cloudflare's docs recommend validating the Cf-Access-Jwt-Assertion JWT.
    // Do not trust the email header by itself; a raw header can be spoofed if
    // the route is not actually protected by Access.
    const verified = await verifyCloudflareAccessJwt(request, env);
    if (!verified.ok) return verified.response;

    // Optional comma-separated allowlist, for example:
    // GRC_ACCESS_ALLOWED_EMAILS="alice@example.com,bob@example.com"
    const allowed = (env.GRC_ACCESS_ALLOWED_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const email = verified.email;
    if (allowed.length > 0 && (!email || !allowed.includes(email.toLowerCase()))) {
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
      const unauthorized = await requireAgentAuth(request, env);
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
