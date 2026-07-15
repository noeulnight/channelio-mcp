import { z } from 'zod';

export type ResponseKind =
  | 'user'
  | 'userChats'
  | 'userChat'
  | 'userChatMutation'
  | 'messages'
  | 'message'
  | 'fileUrl'
  | 'managers'
  | 'manager';

const recordSchema = z.looseObject({});
const arraySchema = z.array(z.unknown());

const userFields = [
  'id',
  'memberId',
  'name',
  'email',
  'mobileNumber',
  'tags',
  'blocked',
  'language',
  'createdAt',
  'updatedAt',
];
const userChatFields = [
  'id',
  'userId',
  'state',
  'name',
  'title',
  'description',
  'assigneeId',
  'managerIds',
  'tags',
  'priority',
  'createdAt',
  'updatedAt',
  'openedAt',
  'snoozedAt',
  'closedAt',
];
const messageFields = [
  'id',
  'chatId',
  'personType',
  'personId',
  'plainText',
  'files',
  'options',
  'state',
  'createdAt',
  'updatedAt',
];
const managerFields = [
  'id',
  'name',
  'email',
  'operator',
  'operatorStatusId',
  'doNotDisturb',
  'removed',
];

function record(value: unknown): Record<string, unknown> | undefined {
  const parsed = recordSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function pick(value: unknown, fields: string[]): Record<string, unknown> | undefined {
  const source = record(value);
  if (!source) return undefined;
  return Object.fromEntries(
    fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]),
  );
}

function list(value: unknown, fields: string[]): Record<string, unknown>[] | undefined {
  const parsed = arraySchema.safeParse(value);
  if (!parsed.success) return undefined;
  return parsed.data.flatMap((item) => {
    const selected = pick(item, fields);
    return selected ? [selected] : [];
  });
}

function compactUser(value: unknown): Record<string, unknown> | undefined {
  return pick(value, userFields);
}

function compactUserChat(value: unknown): Record<string, unknown> | undefined {
  return pick(value, userChatFields);
}

function compactMessage(value: unknown): Record<string, unknown> | undefined {
  return pick(value, messageFields);
}

function compactManager(value: unknown): Record<string, unknown> | undefined {
  return pick(value, managerFields);
}

function clean(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

export function compactResponse(kind: ResponseKind, value: unknown): unknown {
  const source = record(value);
  if (!source) return value;

  switch (kind) {
    case 'user':
      return clean({ user: compactUser(source.user), online: pick(source.online, ['personId']) });
    case 'userChats':
      return clean({
        userChats: list(source.userChats, userChatFields),
        users: list(source.users, userFields),
        managers: list(source.managers, managerFields),
        messages: list(source.messages, messageFields),
        nextCursor: source.nextCursor,
        hasNext: source.hasNext,
      });
    case 'userChat':
      return clean({
        userChat: compactUserChat(source.userChat),
        user: compactUser(source.user),
        chatTags: list(source.chatTags, ['id', 'name', 'color']),
        message: compactMessage(source.message),
        userOnline: pick(source.userOnline, ['personId']),
      });
    case 'userChatMutation':
      return clean({ userChat: compactUserChat(source.userChat) });
    case 'messages':
      return clean({
        messages: list(source.messages, messageFields),
        bots: list(source.bots, ['id', 'name']),
        nextCursor: source.nextCursor,
        hasNext: source.hasNext,
      });
    case 'message':
      return clean({
        message: compactMessage(source.message),
        bot: pick(source.bot, ['id', 'name']),
      });
    case 'fileUrl':
      return clean({ result: source.result });
    case 'managers':
      return clean({
        managers: list(source.managers, managerFields),
        onlines: list(source.onlines, ['personId']),
        operatorStatuses: list(source.operatorStatuses, [
          'managerId',
          'enable',
          'operatorStatusType',
        ]),
        nextCursor: source.nextCursor,
        hasNext: source.hasNext,
      });
    case 'manager':
      return clean({
        manager: compactManager(source.manager),
        online: pick(source.online, ['personId']),
        operatorStatus: pick(source.operatorStatus, ['managerId', 'enable', 'operatorStatusType']),
      });
  }
}

export function compactError(
  status: number,
  statusText: string,
  value: unknown,
  retryAfter?: string,
): unknown {
  const source = record(value);
  const nested = record(source?.error);
  return clean({
    status,
    statusText,
    code: source?.code ?? nested?.code,
    message: source?.message ?? nested?.message,
    retryable: status === 429 ? true : undefined,
    retryAfter,
    action:
      status === 429
        ? retryAfter
          ? `Retry the same tool after ${retryAfter}.`
          : 'Retry the same tool later.'
        : undefined,
  });
}
