import { createServer } from 'node:http';

import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';

import { buildServer } from './server.js';

const port = Number(process.env.PORT ?? 3000);
const mcpHandler = toNodeHandler(
  createMcpHandler(buildServer, {
    legacy: 'stateless',
    responseMode: 'json',
    onerror: error => {
      console.error('[mcp] request error:', error);
    },
  }),
);

const httpServer = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname;

  if (request.method === 'GET' && pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (pathname === '/mcp') {
    void mcpHandler(request, response);
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not Found' }));
});

httpServer.listen(port, '127.0.0.1', () => {
  console.error(`MCP compatibility lab listening on http://127.0.0.1:${port}`);
});
