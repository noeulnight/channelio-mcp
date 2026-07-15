import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { callChannelApi, type ChannelApiConfig } from './client.js';
import { registerTools, type ResolvedToolCall } from './tools.js';

function format(value: unknown): string {
  const string = z.string().safeParse(value);
  return string.success ? string.data : (JSON.stringify(value, null, 2) ?? String(value));
}

export function createServer(config: ChannelApiConfig): McpServer {
  const server = new McpServer({ name: '@noeulnight/channelio-mcp', version: '0.1.0' });
  const execute = async (resolved: ResolvedToolCall): Promise<CallToolResult> => {
    try {
      const result = await callChannelApi(config, resolved.operation, resolved.arguments);
      const text = format(result.body);
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Channel API ${result.status} ${result.statusText}\n${text}`,
            },
          ],
          isError: true,
        };
      }
      return { content: [{ type: 'text', text }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: String(error) }],
        isError: true,
      };
    }
  };

  registerTools(server, execute);
  return server;
}
