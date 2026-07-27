import { McpServer } from '@modelcontextprotocol/server';

import { createRequestState } from './state/requestState.js';
import { registerAddTool } from './tools/add.js';
import { registerRequestCounterTool } from './tools/requestCounter.js';

export function buildServer(): McpServer {
  const server = new McpServer({
    name: 'mcp-stateless-compat-lab',
    version: '0.1.0',
  });

  registerAddTool(server);
  registerRequestCounterTool(server, createRequestState());

  return server;
}
