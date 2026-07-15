import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildRequest, callChannelApi, configFromEnv, type ChannelApiConfig } from './client.js';
import type { ApiOperation } from './types.js';

const config: ChannelApiConfig = {
  accessKey: 'key',
  accessSecret: 'secret',
  version: '2026-06-01',
  baseUrl: 'https://api.channel.io',
  sendMode: 'disabled',
};

const operation: ApiOperation = {
  method: 'post',
  pathTemplate: '/open/user-chats/{userChatId}/messages',
};

describe('configFromEnv', () => {
  it('requires both credentials', () => {
    expect(() => configFromEnv({})).toThrow(
      'CHANNEL_ACCESS_KEY and CHANNEL_ACCESS_SECRET are required',
    );
  });

  it('applies defaults and removes a trailing slash', () => {
    expect(
      configFromEnv({
        CHANNEL_ACCESS_KEY: 'key',
        CHANNEL_ACCESS_SECRET: 'secret',
        CHANNEL_API_BASE_URL: 'http://localhost:3000/',
      }),
    ).toEqual({
      accessKey: 'key',
      accessSecret: 'secret',
      version: '2026-06-01',
      baseUrl: 'http://localhost:3000',
      sendMode: 'disabled',
    });
  });

  it.each(['disabled', 'internal', 'all'] as const)('accepts the %s send mode', (sendMode) => {
    expect(
      configFromEnv({
        CHANNEL_ACCESS_KEY: 'key',
        CHANNEL_ACCESS_SECRET: 'secret',
        CHANNEL_SEND_MODE: sendMode,
      }).sendMode,
    ).toBe(sendMode);
  });

  it('rejects an unknown send mode', () => {
    expect(() =>
      configFromEnv({
        CHANNEL_ACCESS_KEY: 'key',
        CHANNEL_ACCESS_SECRET: 'secret',
        CHANNEL_SEND_MODE: 'public',
      }),
    ).toThrow('CHANNEL_SEND_MODE must be disabled, internal, or all');
  });
});

describe('buildRequest', () => {
  it('serializes path, repeated query values, headers and JSON body', () => {
    const { url, init } = buildRequest(config, operation, {
      path: { userChatId: 'chat/1' },
      query: { tags: ['vip', 'new'], limit: 10 },
      body: { message: '안녕하세요' },
    });

    expect(url.toString()).toBe(
      'https://api.channel.io/open/user-chats/chat%2F1/messages?tags=vip&tags=new&limit=10',
    );
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'x-access-key': 'key',
        'x-access-secret': 'secret',
        'Channel-Version': '2026-06-01',
      },
      body: JSON.stringify({ message: '안녕하세요' }),
    });
  });
});

describe('callChannelApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns parsed JSON together with the HTTP status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callChannelApi(config, operation, { path: { userChatId: 'chat-1' } }),
    ).resolves.toEqual({
      ok: true,
      status: 200,
      statusText: '',
      body: { ok: true },
    });
  });

  it('passes Retry-After through for the agent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Rate limited' }), {
          status: 429,
          headers: { 'retry-after': '10' },
        }),
      ),
    );

    await expect(
      callChannelApi(config, operation, { path: { userChatId: 'chat-1' } }),
    ).resolves.toMatchObject({ status: 429, retryAfter: '10' });
  });
});
