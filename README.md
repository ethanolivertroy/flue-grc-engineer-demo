# Flue GRC Engineer

A small Flue starter agent for governance, risk, and compliance engineering tasks, deployed on Cloudflare Workers.

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
