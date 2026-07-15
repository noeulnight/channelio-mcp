#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { configFromEnv } from './client.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const server = createServer(configFromEnv());
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  console.error(String(error));
  process.exitCode = 1;
});
