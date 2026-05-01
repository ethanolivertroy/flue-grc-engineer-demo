import type { FlueContext } from '@flue/sdk/client';
import * as v from 'valibot';

export const triggers = { webhook: true };

export default async function ({ init, payload }: FlueContext) {
  const agent = await init({ model: 'cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6' });
  const session = await agent.session();

  const framework = payload.framework ?? 'SOC 2';
  const system = payload.system ?? 'the described system';
  const request = payload.request ?? 'identify the top GRC engineering considerations';

  return await session.prompt(
    `You are helping with a GRC engineering task.

Framework: ${framework}
System or process: ${system}
Request: ${request}

Create a practical starter response for an engineer. Include risks, control considerations, evidence to collect, and next steps.`,
    {
      role: 'grc-engineer',
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
