import type {
  A2AEnvelope,
  A2APluginConfig,
  AuthMode,
  ErrorEnvelope,
  ResolvedA2AConfig,
  SuccessEnvelope,
} from "./types.js";

const DEFAULT_BASE_URL = "https://hello.a2aregistry.org";
const DEFAULT_TIMEOUT_MS = 20_000;

export class ConfigError extends Error {
  readonly code = "config_error";

  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function parseTimeoutMs(config: A2APluginConfig, env: NodeJS.ProcessEnv): number {
  if (typeof config.timeoutMs === "number" && Number.isFinite(config.timeoutMs)) {
    return Math.max(1_000, Math.min(60_000, Math.floor(config.timeoutMs)));
  }

  if (env.A2A_TIMEOUT_SEC && /^\d+$/.test(env.A2A_TIMEOUT_SEC)) {
    const ms = Number(env.A2A_TIMEOUT_SEC) * 1000;
    return Math.max(1_000, Math.min(60_000, ms));
  }

  return DEFAULT_TIMEOUT_MS;
}

function parseAuthMode(raw: unknown): AuthMode {
  if (raw === "bearer" || raw === "basic" || raw === "header") {
    return raw;
  }
  return "none";
}

function parseJsonOrText(bodyText: string): unknown {
  if (bodyText.length === 0) {
    return null;
  }
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveConfig(
  inputConfig: unknown,
  env: NodeJS.ProcessEnv = process.env
): ResolvedA2AConfig {
  const config = (inputConfig ?? {}) as A2APluginConfig;
  const baseUrl = normalizeUrl(config.baseUrl ?? env.A2A_BASE_URL ?? DEFAULT_BASE_URL);
  const cardUrl = config.cardUrl ?? env.A2A_CARD_URL ?? `${baseUrl}/.well-known/agent-card.json`;
  const endpointUrl = config.endpointUrl ?? env.A2A_ENDPOINT_URL ?? `${baseUrl}/a2a`;
  const authMode = parseAuthMode(config.authMode ?? env.A2A_AUTH_MODE);

  const resolved: ResolvedA2AConfig = {
    baseUrl,
    cardUrl,
    endpointUrl,
    timeoutMs: parseTimeoutMs(config, env),
    authMode,
    authToken: config.authToken ?? env.A2A_AUTH_TOKEN,
    authUser: config.authUser ?? env.A2A_AUTH_USER,
    authPass: config.authPass ?? env.A2A_AUTH_PASS,
    authHeaderName: config.authHeaderName ?? env.A2A_AUTH_HEADER_NAME,
    authHeaderValue: config.authHeaderValue ?? env.A2A_AUTH_HEADER_VALUE,
    defaultHeaders: config.defaultHeaders ?? {},
  };

  validateAuthConfig(resolved);
  return resolved;
}

export function validateAuthConfig(config: ResolvedA2AConfig): void {
  switch (config.authMode) {
    case "none":
      return;
    case "bearer":
      if (!config.authToken) {
        throw new ConfigError("authToken (or A2A_AUTH_TOKEN) required for authMode=bearer");
      }
      return;
    case "basic":
      if (!config.authUser) {
        throw new ConfigError("authUser (or A2A_AUTH_USER) required for authMode=basic");
      }
      if (!config.authPass) {
        throw new ConfigError("authPass (or A2A_AUTH_PASS) required for authMode=basic");
      }
      return;
    case "header":
      if (!config.authHeaderName) {
        throw new ConfigError("authHeaderName (or A2A_AUTH_HEADER_NAME) required for authMode=header");
      }
      if (!config.authHeaderValue) {
        throw new ConfigError("authHeaderValue (or A2A_AUTH_HEADER_VALUE) required for authMode=header");
      }
      return;
  }
}

export function buildHeaders(
  config: ResolvedA2AConfig,
  includeContentType = false
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...config.defaultHeaders,
  };

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  switch (config.authMode) {
    case "none":
      break;
    case "bearer":
      headers.Authorization = `Bearer ${config.authToken ?? ""}`;
      break;
    case "basic": {
      const raw = `${config.authUser ?? ""}:${config.authPass ?? ""}`;
      const encoded = Buffer.from(raw).toString("base64");
      headers.Authorization = `Basic ${encoded}`;
      break;
    }
    case "header":
      headers[config.authHeaderName ?? "X-A2A-Token"] = config.authHeaderValue ?? "";
      break;
  }

  return headers;
}

function successEnvelope(
  operation: string,
  status: number,
  url: string,
  bodyText: string
): SuccessEnvelope {
  return {
    ok: true,
    operation,
    status,
    url,
    data: parseJsonOrText(bodyText),
  };
}

function errorEnvelope(
  operation: string,
  status: number | null,
  url: string,
  code: string,
  message: string,
  bodyText: string
): ErrorEnvelope {
  return {
    ok: false,
    operation,
    status,
    url,
    error: {
      code,
      message,
    },
    body: parseJsonOrText(bodyText),
  };
}

export async function httpRequest(
  operation: string,
  method: "GET" | "POST",
  url: string,
  config: ResolvedA2AConfig,
  payload?: unknown
): Promise<A2AEnvelope> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const includeContentType = method === "POST";
    const headers = buildHeaders(config, includeContentType);
    const body = payload === undefined ? undefined : JSON.stringify(payload);

    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const bodyText = await response.text();

    if (response.ok) {
      return successEnvelope(operation, response.status, url, bodyText);
    }

    return errorEnvelope(
      operation,
      response.status,
      url,
      "http_error",
      `Request failed with HTTP ${response.status}`,
      bodyText
    );
  } catch (error) {
    return errorEnvelope(
      operation,
      null,
      url,
      "network_error",
      error instanceof Error ? error.message : "Unknown network error",
      ""
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function card(config: ResolvedA2AConfig): Promise<A2AEnvelope> {
  return httpRequest("card", "GET", config.cardUrl, config);
}

export async function probe(config: ResolvedA2AConfig): Promise<A2AEnvelope> {
  return httpRequest("probe", "GET", config.baseUrl, config);
}

export async function send(config: ResolvedA2AConfig, payload: unknown): Promise<A2AEnvelope> {
  if (payload === undefined || payload === null) {
    return errorEnvelope(
      "send",
      null,
      config.endpointUrl,
      "invalid_payload",
      "Payload is required for send operation",
      ""
    );
  }

  return httpRequest("send", "POST", config.endpointUrl, config, payload);
}

export async function smoke(config: ResolvedA2AConfig): Promise<A2AEnvelope> {
  const smokePayload = {
    jsonrpc: "2.0",
    id: "plugin-smoke-1",
    method: "message/send",
    params: {
      message: {
        messageId: "plugin-smoke-message-1",
        role: "user",
        parts: [{ text: "hello from openclaw a2a-client plugin smoke test" }],
      },
    },
  };

  const cardResult = await card(config);
  if (!cardResult.ok) {
    return errorEnvelope(
      "smoke",
      cardResult.status,
      cardResult.url,
      "smoke_card_failed",
      "Smoke test failed during card retrieval",
      JSON.stringify(cardResult)
    );
  }

  const sendResult = await send(config, smokePayload);
  if (!sendResult.ok) {
    return errorEnvelope(
      "smoke",
      sendResult.status,
      sendResult.url,
      "smoke_send_failed",
      "Smoke test failed during send operation",
      JSON.stringify(sendResult)
    );
  }

  const data = (sendResult.data ?? {}) as Record<string, unknown>;
  const observedEchoSignal =
    Object.prototype.hasOwnProperty.call(data, "receivedInput") ||
    Object.prototype.hasOwnProperty.call(data, "message") ||
    Object.prototype.hasOwnProperty.call(data, "result") ||
    Object.prototype.hasOwnProperty.call(data, "response");

  return {
    ok: true,
    operation: "smoke",
    status: sendResult.status,
    url: config.endpointUrl,
    data: {
      checks: {
        card: true,
        send: true,
        echoLikeFieldPresent: observedEchoSignal,
      },
      card: cardResult.data,
      send: sendResult.data,
    },
  };
}
