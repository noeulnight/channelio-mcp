import type { ApiOperation, QueryValue, ToolArguments } from './types.js';

export interface ChannelApiConfig {
  accessKey: string;
  accessSecret: string;
  version: string;
  baseUrl: string;
  allowSend: boolean;
}

export interface ChannelApiResponse {
  ok: boolean;
  status: number;
  statusText: string;
  body: unknown;
  retryAfter?: string;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ChannelApiConfig {
  const accessKey = env.CHANNEL_ACCESS_KEY;
  const accessSecret = env.CHANNEL_ACCESS_SECRET;
  if (!accessKey || !accessSecret) {
    throw new Error('CHANNEL_ACCESS_KEY and CHANNEL_ACCESS_SECRET are required');
  }

  return {
    accessKey,
    accessSecret,
    version: env.CHANNEL_VERSION ?? '2026-06-01',
    baseUrl: (env.CHANNEL_API_BASE_URL ?? 'https://api.channel.io').replace(/\/$/, ''),
    allowSend: env.CHANNEL_ALLOW_SEND === 'true',
  };
}

function appendQueryValue(searchParams: URLSearchParams, name: string, value: QueryValue): void {
  if (Array.isArray(value)) {
    for (const item of value) searchParams.append(name, String(item));
    return;
  }
  searchParams.append(name, String(value));
}

export function buildRequest(
  config: ChannelApiConfig,
  operation: ApiOperation,
  args: ToolArguments,
): { url: URL; init: RequestInit } {
  const path = operation.pathTemplate.replace(/{([^}]+)}/g, (_match, name: string) => {
    const value = args.path?.[name];
    if (value === undefined) throw new Error(`Missing path parameter: ${name}`);
    return encodeURIComponent(value);
  });
  const url = new URL(path, `${config.baseUrl}/`);
  for (const [name, value] of Object.entries(args.query ?? {})) {
    appendQueryValue(url.searchParams, name, value);
  }

  return {
    url,
    init: {
      method: operation.method.toUpperCase(),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-access-key': config.accessKey,
        'x-access-secret': config.accessSecret,
        'Channel-Version': config.version,
      },
      ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
    },
  };
}

export async function callChannelApi(
  config: ChannelApiConfig,
  operation: ApiOperation,
  args: ToolArguments,
): Promise<ChannelApiResponse> {
  const { url, init } = buildRequest(config, operation, args);
  const response = await fetch(url, init);
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body,
    ...(response.headers.get('retry-after')
      ? { retryAfter: response.headers.get('retry-after')! }
      : {}),
  };
}
