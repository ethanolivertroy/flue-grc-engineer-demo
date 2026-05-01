import { readFile, writeFile } from 'node:fs/promises';

const entryPath = new URL('../dist/_entry.ts', import.meta.url);
let entry = await readFile(entryPath, 'utf8');

if (!entry.includes('function requireBearerAuth(request, env)')) {
  entry = entry.replace(
    '// ─── Worker Fetch Handler ───────────────────────────────────────────────────',
    `function requireBearerAuth(request, env) {
  const expected = env.GRC_AGENT_TOKEN;
  if (!expected) {
    return new Response(JSON.stringify({ error: 'GRC_AGENT_TOKEN is not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const actual = request.headers.get('authorization') || '';
  if (actual !== \`Bearer \${expected}\`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'content-type': 'application/json',
        'www-authenticate': 'Bearer',
      },
    });
  }

  return null;
}

// ─── Worker Fetch Handler ───────────────────────────────────────────────────`,
  );
}

const authCheck = `
    // Require a shared bearer token for all agent routes.
    if (url.pathname === '/agents' || url.pathname.startsWith('/agents/')) {
      const unauthorized = requireBearerAuth(request, env);
      if (unauthorized) return unauthorized;
    }
`;

if (!entry.includes('Require a shared bearer token for all agent routes')) {
  entry = entry.replace(
    `    // Agent manifest
    if (url.pathname === '/agents' && request.method === 'GET') {`,
    `${authCheck}
    // Agent manifest
    if (url.pathname === '/agents' && request.method === 'GET') {`,
  );
}

await writeFile(entryPath, entry);
console.log('[auth] Patched dist/_entry.ts with bearer-token auth');
