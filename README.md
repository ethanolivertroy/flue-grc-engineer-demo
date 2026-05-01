# Flue GRC Engineer

A small Flue starter agent for governance, risk, and compliance engineering tasks, deployed on Cloudflare Workers.

## Sandbox model

This project uses a **full Cloudflare Container sandbox** via `@cloudflare/sandbox`:

```ts
const sandbox = getSandbox(env.Sandbox, id);

const agent = await init({
  sandbox,
  model: 'cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6',
});
```

What that means:

- Each agent id/session gets a real isolated Linux container sandbox.
- The container image is defined in `Dockerfile`.
- The starter image includes Node.js, git, curl, CA certificates, and Python 3.
- The agent can use a real Linux filesystem and shell inside the sandbox.
- Cloudflare Durable Objects coordinate sandbox/session persistence.
- Your `.env` secrets are Worker environment values; they are not automatically written into the agent prompt.

Why this is different from Flue's default virtual sandbox:

- The default virtual sandbox is lighter, cheaper, and faster for simple prompt-and-response agents.
- This container sandbox is heavier, but useful when the agent needs real system tools, package installs, git operations, Python scripts, or a more realistic coding/data environment.

Security note:

- The public HTTP route is protected by a shared bearer token: `GRC_AGENT_TOKEN`.
- Do not commit `.env` or paste the token publicly.
- Treat the token like a password. Rotate it if it leaks.
- This is a starter auth pattern, not a full identity system.

Docs:

- Flue Cloudflare container agents: https://github.com/withastro/flue/blob/main/docs/deploy-cloudflare.md#container-agents
- Cloudflare Containers: https://developers.cloudflare.com/containers/

## Setup

```bash
npm install
cp .env.example .env
# edit .env and set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_KEY, and GRC_AGENT_TOKEN
```

Generate a token if you need one:

```bash
openssl rand -hex 32
```

## Develop locally

```bash
npm run dev
```

Then call the agent:

```bash
source .env

curl http://localhost:3583/agents/grc-engineer/test-1 \
  -H "Authorization: Bearer $GRC_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "framework": "SOC 2",
    "system": "a SaaS application running on Cloudflare Workers",
    "request": "draft control considerations for access reviews and audit evidence"
  }'
```

Note: `npm run build` patches the generated Cloudflare Worker with bearer-token auth for `/agents` routes. Use `npm run dev` or `npm run deploy` so the auth patch is applied.

## Build and deploy

```bash
npm run build
npm run deploy
```

Wrangler reads `.env` during deploy via `--secrets-file .env`.
