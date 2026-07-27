import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { RequestState } from '../state/requestState.js';

export function registerRequestCounterTool(server: McpServer, state: RequestState): void {
  server.registerTool(
    'request_counter',
    {
      description: 'Return state associated with the current request.',
      inputSchema: z.object({
        label: z.string(),
      }),
      outputSchema: z.object({
        requestId: z.string(),
        invocationCount: z.number(),
        label: z.string(),
        serverInstanceId: z.string(),
      }),
    },
    async ({ label }) => {
      state.invocationCount += 1;

      const output = {
        requestId: state.requestId,
        invocationCount: state.invocationCount,
        label,
        serverInstanceId: state.serverInstanceId,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output,
      };
    },
  );
}
