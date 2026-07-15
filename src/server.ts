import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { callChannelApi, type ChannelApiConfig } from './client.js';
import { compactError, compactResponse } from './response.js';
import { registerTools, type ResolvedToolCall } from './tools.js';

function format(value: unknown): string {
  const string = z.string().safeParse(value);
  return string.success ? string.data : (JSON.stringify(value) ?? String(value));
}

export function createServer(config: ChannelApiConfig): McpServer {
  const server = new McpServer({ name: '@noeulnight/channelio-mcp', version: '0.1.0' });
  const execute = async (resolved: ResolvedToolCall): Promise<CallToolResult> => {
    try {
      const result = await callChannelApi(config, resolved.operation, resolved.arguments);
      if (!result.ok) {
        return {
          content: [
            {
              type: 'text',
              text: format(
                compactError(result.status, result.statusText, result.body, result.retryAfter),
              ),
            },
          ],
          isError: true,
        };
      }
      const body =
        resolved.responseMode === 'full'
          ? result.body
          : compactResponse(resolved.responseKind, result.body);
      const text = format(body);
      return { content: [{ type: 'text', text }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: String(error) }],
        isError: true,
      };
    }
  };

  registerTools(server, execute, config.allowSend);
  return server;
}
