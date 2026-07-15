import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { ResponseKind } from './response.js';
import type { ApiOperation, QueryValue, ToolArguments } from './types.js';

export interface ResolvedToolCall {
  operation: ApiOperation;
  arguments: ToolArguments;
  responseMode: 'compact' | 'full';
  responseKind: ResponseKind;
}

interface ToolEntry<Schema extends z.ZodType> {
  name: string;
  title: string;
  description: string;
  schema: Schema;
  resolve: (args: z.output<Schema>) => ResolvedToolCall;
}

type ExecuteTool = (resolved: ResolvedToolCall) => Promise<CallToolResult>;

interface MessageBlock {
  type: 'bullets' | 'code' | 'text';
  value?: string | undefined;
  language?: string | undefined;
  blocks?: MessageBlock[] | undefined;
}

const stringId = (description: string) => z.string().min(1).describe(description);
const expand = z.array(z.string()).describe('응답에 포함할 연관 리소스').optional();
const cursor = z.string().describe('이전 응답의 페이지네이션 커서').optional();
const limit = z.number().int().min(1).max(500).default(10).describe('최대 반환 항목 수');
const sortOrder = z.enum(['asc', 'desc']).default('desc').describe('정렬 순서');
const responseMode = z
  .enum(['compact', 'full'])
  .default('compact')
  .describe('compact는 핵심 필드만, full은 Channel API 원본 응답을 반환');

const messageBlockSchema: z.ZodType<MessageBlock> = z.lazy(() =>
  z.strictObject({
    type: z.enum(['bullets', 'code', 'text']),
    value: z.string().optional(),
    language: z.string().optional(),
    blocks: z.array(messageBlockSchema).optional(),
  }),
);

const messageBodySchema = z.strictObject({
  plainText: z.string().describe('일반 텍스트 메시지 내용').optional(),
  blocks: z.array(messageBlockSchema).describe('구조화된 메시지 본문 블록').optional(),
  buttons: z
    .array(
      z.strictObject({
        title: z.string().min(1).max(30),
        action: z.looseObject({}),
        colorVariant: z
          .enum(['cobalt', 'green', 'orange', 'red', 'black', 'pink', 'purple'])
          .optional(),
      }),
    )
    .max(2)
    .describe('메시지 액션 버튼')
    .optional(),
  files: z
    .array(
      z.looseObject({
        id: z.string(),
        name: z.string().min(1),
        size: z.number().int(),
        bucket: z.string().min(1),
        key: z.string().min(1),
        contentType: z.string().optional(),
        type: z.string().optional(),
        width: z.number().int().optional(),
        height: z.number().int().optional(),
        duration: z.number().optional(),
        previewKey: z.string().optional(),
        animated: z.boolean().optional(),
      }),
    )
    .max(10)
    .describe('메시지 첨부파일')
    .optional(),
  options: z
    .array(
      z.enum([
        'actAsManager',
        'displayAsChannel',
        'doNotPost',
        'doNotSearch',
        'doNotSendApp',
        'doNotUpdateDesk',
        'immutable',
        'private',
        'silent',
        'silentToManager',
        'silentToUser',
        'alertToWriter',
      ]),
    )
    .describe('메시지 전달 및 표시 옵션')
    .optional(),
});

const userLookupSchema = z
  .strictObject({
    userId: stringId('Channel.io 유저 ID').optional(),
    memberId: stringId('외부 서비스 회원 ID').optional(),
    expand,
    responseMode,
  })
  .refine((args) => Boolean(args.userId) !== Boolean(args.memberId), {
    message: 'userId 또는 memberId 중 하나만 입력해야 합니다.',
  });

const chatListSchema = z.strictObject({
  userId: stringId('특정 유저만 조회할 때 사용할 Channel.io 유저 ID').optional(),
  state: z.enum(['opened', 'closed', 'snoozed']).default('opened'),
  sortOrder,
  cursor,
  limit,
  responseMode,
});

const chatStatusSchema = z
  .strictObject({
    userChatId: stringId('유저챗 ID'),
    state: z.enum(['opened', 'snoozed', 'closed']),
    botName: stringId('작업을 수행할 봇 이름'),
    duration: z.string().min(1).describe('ISO 8601 보류 기간(예: PT30M)').optional(),
    responseMode,
  })
  .refine((args) => (args.state === 'snoozed') === Boolean(args.duration), {
    path: ['duration'],
    message: 'duration은 snoozed 상태에서만 필요합니다.',
  });

const managerLookupSchema = z.strictObject({
  managerId: stringId('단건 조회할 매니저 ID').optional(),
  cursor,
  limit,
  expand,
  responseMode,
});

function query(values: Record<string, QueryValue | undefined>): Record<string, QueryValue> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Record<string, QueryValue>;
}

function route(
  method: ApiOperation['method'],
  pathTemplate: string,
  arguments_: ToolArguments,
  selectedResponseMode: 'compact' | 'full',
  responseKind: ResponseKind,
): ResolvedToolCall {
  return {
    operation: { method, pathTemplate },
    arguments: arguments_,
    responseMode: selectedResponseMode,
    responseKind,
  };
}

function defineTool<Schema extends z.ZodType>(entry: ToolEntry<Schema>): ToolEntry<Schema> {
  return entry;
}

export const toolEntries = {
  get_user: defineTool({
    name: 'get_user',
    title: '유저 조회',
    description: 'Channel.io userId 또는 서비스 memberId 중 하나로 유저를 조회합니다.',
    schema: userLookupSchema,
    resolve: (args) => {
      const requestQuery = query({ expand: args.expand });
      return args.userId
        ? route(
            'get',
            '/open/users/{userId}',
            {
              path: { userId: args.userId },
              query: requestQuery,
            },
            args.responseMode,
            'user',
          )
        : route(
            'get',
            '/open/users/@{memberId}',
            {
              path: { memberId: args.memberId! },
              query: requestQuery,
            },
            args.responseMode,
            'user',
          );
    },
  }),
  list_user_chats: defineTool({
    name: 'list_user_chats',
    title: '상담 목록 조회',
    description: '전체 상담 또는 userId를 지정한 특정 유저의 상담 목록을 조회합니다.',
    schema: chatListSchema,
    resolve: (args) =>
      args.userId
        ? route(
            'get',
            '/open/users/{userId}/user-chats',
            {
              path: { userId: args.userId },
              query: query({ cursor: args.cursor, limit: args.limit }),
            },
            args.responseMode,
            'userChats',
          )
        : route(
            'get',
            '/open/user-chats',
            {
              query: query({
                state: args.state,
                sortOrder: args.sortOrder,
                cursor: args.cursor,
                limit: args.limit,
              }),
            },
            args.responseMode,
            'userChats',
          ),
  }),
  get_user_chat: defineTool({
    name: 'get_user_chat',
    title: '상담 상세 조회',
    description: 'userChatId로 상담 상세를 조회합니다.',
    schema: z.strictObject({ userChatId: stringId('유저챗 ID'), expand, responseMode }),
    resolve: (args) =>
      route(
        'get',
        '/open/user-chats/{userChatId}',
        {
          path: { userChatId: args.userChatId },
          query: query({ expand: args.expand }),
        },
        args.responseMode,
        'userChat',
      ),
  }),
  create_user_chat: defineTool({
    name: 'create_user_chat',
    title: '신규 상담 생성',
    description: '특정 유저에게 아웃바운드 상담을 생성합니다.',
    schema: z.strictObject({ userId: stringId('Channel.io 유저 ID'), responseMode }),
    resolve: (args) =>
      route(
        'post',
        '/open/users/{userId}/user-chats',
        {
          path: { userId: args.userId },
        },
        args.responseMode,
        'userChatMutation',
      ),
  }),
  list_user_chat_messages: defineTool({
    name: 'list_user_chat_messages',
    title: '상담 메시지 조회',
    description: '상담의 메시지 목록을 생성 시각 순으로 조회합니다.',
    schema: z.strictObject({
      userChatId: stringId('유저챗 ID'),
      sortOrder,
      cursor,
      limit,
      responseMode,
    }),
    resolve: (args) =>
      route(
        'get',
        '/open/user-chats/{userChatId}/messages',
        {
          path: { userChatId: args.userChatId },
          query: query({ sortOrder: args.sortOrder, cursor: args.cursor, limit: args.limit }),
        },
        args.responseMode,
        'messages',
      ),
  }),
  send_user_chat_message: defineTool({
    name: 'send_user_chat_message',
    title: '상담 메시지 전송',
    description: '봇 이름으로 상담에 텍스트, 블록, 버튼 또는 파일 메시지를 전송합니다.',
    schema: z.strictObject({
      userChatId: stringId('유저챗 ID'),
      botName: stringId('메시지를 전송할 봇 이름'),
      body: messageBodySchema,
      responseMode,
    }),
    resolve: (args) =>
      route(
        'post',
        '/open/user-chats/{userChatId}/messages',
        {
          path: { userChatId: args.userChatId },
          query: { botName: args.botName },
          body: args.body,
        },
        args.responseMode,
        'message',
      ),
  }),
  get_user_chat_message_file_url: defineTool({
    name: 'get_user_chat_message_file_url',
    title: '메시지 첨부파일 URL 조회',
    description: '메시지 첨부파일의 pre-signed 다운로드 URL을 조회합니다.',
    schema: z.strictObject({
      userChatId: stringId('유저챗 ID'),
      key: stringId('첨부파일 키'),
      responseMode,
    }),
    resolve: (args) =>
      route(
        'get',
        '/open/user-chats/{userChatId}/messages/file',
        {
          path: { userChatId: args.userChatId },
          query: { key: args.key },
        },
        args.responseMode,
        'fileUrl',
      ),
  }),
  change_user_chat_status: defineTool({
    name: 'change_user_chat_status',
    title: '상담 상태 변경',
    description:
      '상담을 열기, 보류 또는 닫기 상태로 변경합니다. snoozed에는 duration이 필요합니다.',
    schema: chatStatusSchema,
    resolve: (args) => {
      const statusRoute = {
        opened: { method: 'put', suffix: 'open' },
        snoozed: { method: 'put', suffix: 'snooze' },
        closed: { method: 'patch', suffix: 'close' },
      } as const;
      const selected = statusRoute[args.state];
      return route(
        selected.method,
        `/open/user-chats/{userChatId}/${selected.suffix}`,
        {
          path: { userChatId: args.userChatId },
          query: query({
            botName: args.botName,
            duration: args.duration,
          }),
        },
        args.responseMode,
        'userChatMutation',
      );
    },
  }),
  get_managers: defineTool({
    name: 'get_managers',
    title: '매니저 조회',
    description: '매니저 목록을 조회하거나 managerId를 지정해 단건을 조회합니다.',
    schema: managerLookupSchema,
    resolve: (args) =>
      args.managerId
        ? route(
            'get',
            '/open/managers/{managerId}',
            {
              path: { managerId: args.managerId },
              query: query({ expand: args.expand }),
            },
            args.responseMode,
            'manager',
          )
        : route(
            'get',
            '/open/managers',
            {
              query: query({ cursor: args.cursor, limit: args.limit, expand: args.expand }),
            },
            args.responseMode,
            'managers',
          ),
  }),
  assign_user_chat: defineTool({
    name: 'assign_user_chat',
    title: '상담 담당자 배정',
    description: '상담에 담당 매니저 한 명을 배정합니다.',
    schema: z.strictObject({
      userChatId: stringId('유저챗 ID'),
      managerId: stringId('배정할 매니저 ID'),
      botName: stringId('작업을 수행할 봇 이름'),
      responseMode,
    }),
    resolve: (args) =>
      route(
        'patch',
        '/open/user-chats/{userChatId}/assign-to/managers/{managerId}',
        {
          path: { userChatId: args.userChatId, managerId: args.managerId },
          query: { botName: args.botName },
        },
        args.responseMode,
        'userChatMutation',
      ),
  }),
  invite_managers_to_user_chat: defineTool({
    name: 'invite_managers_to_user_chat',
    title: '상담에 매니저 초대',
    description: '상담에 한 명 이상의 매니저를 초대합니다.',
    schema: z.strictObject({
      userChatId: stringId('유저챗 ID'),
      managerIds: z.array(stringId('매니저 ID')).min(1),
      botName: stringId('작업을 수행할 봇 이름'),
      responseMode,
    }),
    resolve: (args) =>
      route(
        'patch',
        '/open/user-chats/{userChatId}/invite',
        {
          path: { userChatId: args.userChatId },
          query: { managerIds: args.managerIds, botName: args.botName },
        },
        args.responseMode,
        'userChatMutation',
      ),
  }),
};

export function registerTools(server: McpServer, execute: ExecuteTool): void {
  const getUser = toolEntries.get_user;
  server.registerTool(
    getUser.name,
    {
      title: getUser.title,
      description: getUser.description,
      inputSchema: getUser.schema,
    },
    (args) => execute(getUser.resolve(args)),
  );

  const listUserChats = toolEntries.list_user_chats;
  server.registerTool(
    listUserChats.name,
    {
      title: listUserChats.title,
      description: listUserChats.description,
      inputSchema: listUserChats.schema,
    },
    (args) => execute(listUserChats.resolve(args)),
  );

  const getUserChat = toolEntries.get_user_chat;
  server.registerTool(
    getUserChat.name,
    {
      title: getUserChat.title,
      description: getUserChat.description,
      inputSchema: getUserChat.schema,
    },
    (args) => execute(getUserChat.resolve(args)),
  );

  const createUserChat = toolEntries.create_user_chat;
  server.registerTool(
    createUserChat.name,
    {
      title: createUserChat.title,
      description: createUserChat.description,
      inputSchema: createUserChat.schema,
    },
    (args) => execute(createUserChat.resolve(args)),
  );

  const listMessages = toolEntries.list_user_chat_messages;
  server.registerTool(
    listMessages.name,
    {
      title: listMessages.title,
      description: listMessages.description,
      inputSchema: listMessages.schema,
    },
    (args) => execute(listMessages.resolve(args)),
  );

  const sendMessage = toolEntries.send_user_chat_message;
  server.registerTool(
    sendMessage.name,
    {
      title: sendMessage.title,
      description: sendMessage.description,
      inputSchema: sendMessage.schema,
    },
    (args) => execute(sendMessage.resolve(args)),
  );

  const getFileUrl = toolEntries.get_user_chat_message_file_url;
  server.registerTool(
    getFileUrl.name,
    {
      title: getFileUrl.title,
      description: getFileUrl.description,
      inputSchema: getFileUrl.schema,
    },
    (args) => execute(getFileUrl.resolve(args)),
  );

  const changeStatus = toolEntries.change_user_chat_status;
  server.registerTool(
    changeStatus.name,
    {
      title: changeStatus.title,
      description: changeStatus.description,
      inputSchema: changeStatus.schema,
    },
    (args) => execute(changeStatus.resolve(args)),
  );

  const getManagers = toolEntries.get_managers;
  server.registerTool(
    getManagers.name,
    {
      title: getManagers.title,
      description: getManagers.description,
      inputSchema: getManagers.schema,
    },
    (args) => execute(getManagers.resolve(args)),
  );

  const assignUserChat = toolEntries.assign_user_chat;
  server.registerTool(
    assignUserChat.name,
    {
      title: assignUserChat.title,
      description: assignUserChat.description,
      inputSchema: assignUserChat.schema,
    },
    (args) => execute(assignUserChat.resolve(args)),
  );

  const inviteManagers = toolEntries.invite_managers_to_user_chat;
  server.registerTool(
    inviteManagers.name,
    {
      title: inviteManagers.title,
      description: inviteManagers.description,
      inputSchema: inviteManagers.schema,
    },
    (args) => execute(inviteManagers.resolve(args)),
  );
}
