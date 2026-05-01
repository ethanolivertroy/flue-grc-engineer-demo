# Flue GRC Engineer Demo

A small Flue demo agent for governance, risk, and compliance engineering tasks, deployed on Cloudflare Workers.

## What is Flue?

[Flue](https://github.com/withastro/flue) is an experimental sandbox agent framework from the Astro team. It lets you build AI agents as small TypeScript handlers that can be invoked over HTTP or from automation.

A Flue agent usually has three parts:

- **Agent handler**: TypeScript code in `agents/` that receives a payload, initializes a model/sandbox, and runs prompts or skills.
- **Model**: The LLM used by the agent. This project uses Cloudflare Workers AI with Kimi K2.6: `cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6`.
- **Sandbox**: An isolated environment where the agent can read/write files and run shell commands. This project uses Cloudflare's full container sandbox.

In this repo, Flue builds the `agents/grc-engineer.ts` handler into a Cloudflare Worker endpoint:

```txt
POST /agents/grc-engineer/:id
```

The `:id` acts like a session/agent instance id. Reusing the same id can preserve agent/session state; using a new id starts a separate session.

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

Docs:

- Flue Cloudflare container agents: https://github.com/withastro/flue/blob/main/docs/deploy-cloudflare.md#container-agents
- Cloudflare Containers: https://developers.cloudflare.com/containers/

## Auth model

The generated Worker supports configurable auth for `/agents` routes via `GRC_AUTH_MODE`.

### Option 1: Bearer token auth

Use this for local testing or simple private API access:

```env
GRC_AUTH_MODE="token"
GRC_AGENT_TOKEN="some-long-random-token"
```

Requests must include:

```bash
-H "Authorization: Bearer $GRC_AGENT_TOKEN"
```

### Option 2: Cloudflare Access

Use this when the Worker is deployed publicly but should only be reachable by approved Cloudflare Access users.

```env
GRC_AUTH_MODE="cloudflare-access"
GRC_ACCESS_ALLOWED_EMAILS="alice@example.com,bob@example.com"
```

How it works:

- Cloudflare Access sits in front of the Worker and handles login/identity.
- The Worker requires the `Cf-Access-Authenticated-User-Email` header.
- If `GRC_ACCESS_ALLOWED_EMAILS` is set, the Worker also checks that the Access-authenticated email is on that allowlist.
- If the allowlist is blank, any user who passes your Cloudflare Access policy is allowed.

You still need to configure a Cloudflare Access application/policy in the Cloudflare dashboard for the deployed Worker hostname. The app-level check here is a fail-closed guard, not a replacement for configuring Access.

### Option 3: No app-level auth

Only use this for local/private experiments:

```env
GRC_AUTH_MODE="none"
```

Security notes:

- Do not commit `.env`.
- Treat `GRC_AGENT_TOKEN` like a password. Rotate it if it leaks.
- Prefer Cloudflare Access for shared/team usage.

## Setup

```bash
npm install
cp .env.example .env
# edit .env and set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_KEY, and auth settings
```

Generate a token if you use token auth:

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

Note: `npm run build` patches the generated Cloudflare Worker with auth for `/agents` routes. Use `npm run dev` or `npm run deploy` so the auth patch is applied.

## Build and deploy

```bash
npm run build
npm run deploy
```

Wrangler reads `.env` during deploy via `--secrets-file .env`.
