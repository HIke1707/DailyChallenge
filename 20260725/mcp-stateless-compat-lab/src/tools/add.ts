import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

export function registerAddTool(server: McpServer): void {
  server.registerTool(
    'add',
    {
      description: 'Add two numbers.',
      inputSchema: z.object({
        a: z.number(),
        b: z.number(),
      }),
      outputSchema: z.object({
        result: z.number(),
      }),
    },
    async ({ a, b }) => {
      const output = { result: a + b };

      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output,
      };
    },
  );
}
