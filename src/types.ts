export type JsonSchema = Record<string, unknown>;

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface ApiOperation {
  method: HttpMethod;
  pathTemplate: string;
}

export type QueryPrimitive = string | number | boolean;
export type QueryValue = QueryPrimitive | QueryPrimitive[];

export interface ToolArguments {
  path?: Record<string, string>;
  query?: Record<string, QueryValue>;
  body?: unknown;
}
