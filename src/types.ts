export type AuthMode = "none" | "bearer" | "basic" | "header";

export interface A2APluginConfig {
  baseUrl?: string;
  cardUrl?: string;
  endpointUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  authMode?: AuthMode;
  authToken?: string;
  authUser?: string;
  authPass?: string;
  authHeaderName?: string;
  authHeaderValue?: string;
  defaultHeaders?: Record<string, string>;
}

export interface ResolvedA2AConfig {
  baseUrl: string;
  cardUrl: string;
  endpointUrl: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  authMode: AuthMode;
  authToken?: string;
  authUser?: string;
  authPass?: string;
  authHeaderName?: string;
  authHeaderValue?: string;
  defaultHeaders: Record<string, string>;
}

export interface ErrorEnvelope {
  ok: false;
  operation: string;
  attempts: number;
  status: number | null;
  url: string;
  error: {
    code: string;
    message: string;
  };
  body: unknown;
}

export interface SuccessEnvelope {
  ok: true;
  operation: string;
  attempts: number;
  status: number;
  url: string;
  data: unknown;
}

export type A2AEnvelope = ErrorEnvelope | SuccessEnvelope;

export interface GatewayContext {
  params?: unknown;
  respond?: (ok: boolean, payload: unknown) => unknown;
}

export interface PluginApi {
  pluginConfig?: unknown;
  registerGatewayMethod?: (
    name: string,
    handler: (ctx: GatewayContext) => Promise<unknown> | unknown
  ) => void;
  logger?: {
    info?: (msg: string, meta?: unknown) => void;
    warn?: (msg: string, meta?: unknown) => void;
    error?: (msg: string, meta?: unknown) => void;
  };
}
