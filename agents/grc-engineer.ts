// This file defines the actual GRC Engineer agent.
//
// Flue turns this TypeScript file into an HTTP endpoint at:
//   POST /agents/grc-engineer/:id
//
// If you are new to coding, read this file from top to bottom. The short version is:
// 1. Receive a JSON request from the user.
// 2. Start an isolated sandbox + AI model.
// 3. Ask the model to produce a structured GRC response.
// 4. Return JSON that other tools can use.

import { getSandbox } from '@cloudflare/sandbox';
import type { FlueContext } from '@flue/sdk/client';
import * as v from 'valibot';

// This tells Flue that this agent should be callable over HTTP.
// Without this, Flue would not create a public webhook-style route for it.
export const triggers = { webhook: true };

// This is the main function Flue runs whenever someone calls the agent endpoint.
//
// The values inside the braces come from Flue:
// - init: starts an agent runtime with a model and sandbox.
// - id: the session/agent instance id from the URL. Example: /agents/grc-engineer/test-1
// - payload: the JSON body sent by the caller.
// - env: Cloudflare Worker environment variables and bindings.
export default async function ({ init, id, payload, env }: FlueContext) {
  // Create or connect to a Cloudflare Container sandbox for this session id.
  //
  // Think of the sandbox as the agent's isolated workbench. It can run shell
  // commands and use files inside the container without touching your laptop.
  //
  // env.Sandbox comes from wrangler.jsonc, where we declared the Cloudflare
  // Container / Durable Object binding named "Sandbox".
  const sandbox = getSandbox(env.Sandbox, id);

  // Start the Flue agent runtime.
  //
  // sandbox: gives the agent the full Linux container workbench above.
  // model: tells Flue which LLM to use. This one runs through Cloudflare Workers AI.
  const agent = await init({
    sandbox,
    model: 'cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6',
  });

  // Open the default conversation/session for this agent id.
  // Reusing the same URL id can preserve session history/state.
  const session = await agent.session();

  // Pull values out of the incoming JSON payload.
  //
  // The "??" operator means "use the value on the left unless it is missing,
  // otherwise use the default value on the right."
  //
  // Example request body:
  // {
  //   "framework": "SOC 2",
  //   "system": "Cloudflare Workers SaaS app",
  //   "request": "Draft access review evidence"
  // }
  const framework = payload.framework ?? 'SOC 2';
  const system = payload.system ?? 'the described system';
  const request = payload.request ?? 'identify the top GRC engineering considerations';

  // Send the prompt to the model and return its answer.
  //
  // The text between backticks is a template string. The ${...} parts insert
  // the values from the request into the prompt.
  return await session.prompt(
    `You are helping with a GRC engineering task.

Framework: ${framework}
System or process: ${system}
Request: ${request}

Create a practical starter response for an engineer. Include risks, control considerations, evidence to collect, and next steps.`,
    {
      // This role points to roles/grc-engineer.md.
      // Roles are reusable instructions that shape how the agent behaves.
      role: 'grc-engineer',

      // This schema tells Flue what shape the answer should have.
      // Instead of returning a loose paragraph, the model must return structured JSON.
      // That makes it easier to plug the output into tickets, dashboards, or workflows.
      result: v.object({
        summary: v.string(),
        risks: v.array(v.string()),
        controls: v.array(v.string()),
        evidence: v.array(v.string()),
        next_steps: v.array(v.string()),
      }),
    },
  );
}
