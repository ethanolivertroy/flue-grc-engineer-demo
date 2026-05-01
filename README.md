# Flue GRC Engineer

A small Flue starter agent for governance, risk, and compliance engineering tasks, deployed on Cloudflare Workers.

## Sandbox model

This starter uses Flue's default **virtual sandbox**:

```ts
const agent = await init({ model: 'cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6' });
```

What that means:

- The agent does **not** get direct access to your laptop filesystem.
- The agent does **not** receive your `.env` secrets in its prompt.
- The agent gets an isolated virtual filesystem and basic shell environment powered by Flue/`just-bash`.
- This is fast and cheap, and works well for prompt-and-response GRC work.
- On Cloudflare, Flue also uses Durable Objects for persisted agent/session state.

What it is **not**:

- It is not a full Linux virtual machine.
- It is not a full container with system packages, browsers, `apt`, etc.
- It should not be treated as a production security boundary for arbitrary untrusted code without additional review.

Flue's Cloudflare deploy docs also describe a **full Linux container sandbox** option using Cloudflare Containers and `@cloudflare/sandbox`. That mode requires adding `@cloudflare/sandbox`, declaring Durable Object/container bindings in `wrangler.jsonc`, and adding a `Dockerfile`. Use that path when the agent needs a real Linux environment with tools like git, Node.js, Python, browsers, or system packages.

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
