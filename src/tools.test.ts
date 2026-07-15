import { describe, expect, it } from 'vitest';

import { toolEntries } from './tools.js';

describe('toolEntries', () => {
  it('exposes only the 11 curated tools', () => {
    expect(Object.values(toolEntries).map(({ name }) => name)).toEqual([
      'get_user',
      'list_user_chats',
      'get_user_chat',
      'create_user_chat',
      'list_user_chat_messages',
      'send_user_chat_message',
      'get_user_chat_message_file_url',
      'change_user_chat_status',
      'get_managers',
      'assign_user_chat',
      'invite_managers_to_user_chat',
    ]);
  });
});

describe('tool routing', () => {
  it('selects the user lookup route from the supplied identifier', () => {
    expect(
      toolEntries.get_user.resolve(toolEntries.get_user.schema.parse({ memberId: 'member-1' })),
    ).toMatchObject({
      operation: { method: 'get', pathTemplate: '/open/users/@{memberId}' },
      arguments: { path: { memberId: 'member-1' } },
    });
    expect(
      toolEntries.get_user.resolve(toolEntries.get_user.schema.parse({ userId: 'user-1' })),
    ).toMatchObject({
      operation: { method: 'get', pathTemplate: '/open/users/{userId}' },
      arguments: { path: { userId: 'user-1' } },
    });
  });

  it('routes global and user-scoped chat lists separately', () => {
    expect(
      toolEntries.list_user_chats.resolve(
        toolEntries.list_user_chats.schema.parse({ state: 'closed', limit: 10 }),
      ),
    ).toMatchObject({
      operation: { pathTemplate: '/open/user-chats' },
      arguments: { query: { state: 'closed', limit: 10 } },
    });
    expect(
      toolEntries.list_user_chats.resolve(
        toolEntries.list_user_chats.schema.parse({ userId: 'user-1', limit: 10 }),
      ),
    ).toMatchObject({
      operation: { pathTemplate: '/open/users/{userId}/user-chats' },
      arguments: { path: { userId: 'user-1' }, query: { limit: 10 } },
    });
  });

  it.each([
    ['opened', 'put', '/open/user-chats/{userChatId}/open'],
    ['snoozed', 'put', '/open/user-chats/{userChatId}/snooze'],
    ['closed', 'patch', '/open/user-chats/{userChatId}/close'],
  ])('routes the %s state', (state, method, pathTemplate) => {
    const args = toolEntries.change_user_chat_status.schema.parse({
      userChatId: 'chat-1',
      botName: 'Support Bot',
      state,
      ...(state === 'snoozed' ? { duration: 'PT30M' } : {}),
    });
    expect(toolEntries.change_user_chat_status.resolve(args)).toMatchObject({
      operation: { method, pathTemplate },
    });
  });

  it('keeps assignment and invitation as separate routes', () => {
    const assignment = toolEntries.assign_user_chat.schema.parse({
      userChatId: 'chat-1',
      managerId: 'manager-1',
      botName: 'Support Bot',
    });
    expect(toolEntries.assign_user_chat.resolve(assignment)).toMatchObject({
      operation: {
        pathTemplate: '/open/user-chats/{userChatId}/assign-to/managers/{managerId}',
      },
    });

    const invitation = toolEntries.invite_managers_to_user_chat.schema.parse({
      userChatId: 'chat-1',
      managerIds: ['manager-1'],
      botName: 'Support Bot',
    });
    expect(toolEntries.invite_managers_to_user_chat.resolve(invitation)).toMatchObject({
      operation: { pathTemplate: '/open/user-chats/{userChatId}/invite' },
    });
  });

  it('rejects ambiguous or incomplete merged inputs', () => {
    expect(() =>
      toolEntries.get_user.schema.parse({ userId: 'user-1', memberId: 'member-1' }),
    ).toThrow();
    expect(() =>
      toolEntries.change_user_chat_status.schema.parse({
        userChatId: 'chat-1',
        botName: 'Support Bot',
        state: 'snoozed',
      }),
    ).toThrow();
  });
});
