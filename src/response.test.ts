import { describe, expect, it } from 'vitest';

import { compactError, compactResponse } from './response.js';

describe('compactResponse', () => {
  it('keeps only useful chat list fields and pagination', () => {
    expect(
      compactResponse('userChats', {
        userChats: [
          {
            id: 'chat-1',
            userId: 'user-1',
            state: 'opened',
            title: 'Help',
            createdAt: 1,
            sessions: [{ id: 'verbose' }],
          },
        ],
        users: [{ id: 'user-1', name: 'Noeul', profile: { extra: true } }],
        nextCursor: 'next',
        hasNext: true,
        channel: { verbose: true },
      }),
    ).toEqual({
      userChats: [
        {
          id: 'chat-1',
          userId: 'user-1',
          state: 'opened',
          title: 'Help',
          createdAt: 1,
        },
      ],
      users: [{ id: 'user-1', name: 'Noeul' }],
      nextCursor: 'next',
      hasNext: true,
    });
  });

  it('keeps the message and bot identity', () => {
    expect(
      compactResponse('message', {
        message: { id: 'message-1', plainText: 'hello', blocks: [{ type: 'text' }] },
        bot: { id: 'bot-1', name: 'Support', avatarUrl: 'verbose' },
      }),
    ).toEqual({
      message: { id: 'message-1', plainText: 'hello' },
      bot: { id: 'bot-1', name: 'Support' },
    });
  });
});

describe('compactError', () => {
  it('drops verbose error details', () => {
    expect(
      compactError(400, 'Bad Request', {
        error: { code: 'invalid_input', message: 'Invalid input', details: { verbose: true } },
      }),
    ).toEqual({
      status: 400,
      statusText: 'Bad Request',
      code: 'invalid_input',
      message: 'Invalid input',
    });
  });

  it('tells the agent when to retry a rate-limited call', () => {
    expect(compactError(429, 'Too Many Requests', { message: 'Rate limited' }, '10')).toEqual({
      status: 429,
      statusText: 'Too Many Requests',
      message: 'Rate limited',
      retryable: true,
      retryAfter: '10',
      action: 'Retry the same tool after 10.',
    });
  });
});
