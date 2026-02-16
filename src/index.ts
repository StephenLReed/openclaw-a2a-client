import {
  ConfigError,
  card,
  probe,
  resolveConfig,
  send,
  smoke,
} from "./client.js";
import type { A2APluginConfig, GatewayContext, PluginApi, ResolvedA2AConfig } from "./types.js";

type MethodRunner = (ctx: GatewayContext, config: ResolvedA2AConfig) => Promise<unknown>;

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function response(ctx: GatewayContext, payload: unknown, ok: boolean): unknown {
  if (typeof ctx.respond === "function") {
    return ctx.respond(ok, payload);
  }
  return payload;
}

function configErrorEnvelope(operation: string, targetUrl: string, message: string) {
  return {
    ok: false,
    operation,
    status: null,
    url: targetUrl,
    error: {
      code: "config_error",
      message,
    },
    body: null,
  };
}

function methodHandler(operation: string, run: MethodRunner, baseConfig: A2APluginConfig) {
  return async (ctx: GatewayContext) => {
    const params = toObject(ctx.params);
    const callConfigInput = toObject(params.config);
    const mergedConfig: A2APluginConfig = { ...baseConfig, ...callConfigInput };

    let config: ResolvedA2AConfig;
    try {
      config = resolveConfig(mergedConfig);
    } catch (error) {
      if (error instanceof ConfigError) {
        return response(
          ctx,
          configErrorEnvelope(operation, String(mergedConfig.endpointUrl ?? mergedConfig.baseUrl ?? ""), error.message),
          false
        );
      }
      throw error;
    }

    const result = await run(ctx, config);
    return response(ctx, result, Boolean((result as { ok?: boolean })?.ok));
  };
}

function readPayload(params: Record<string, unknown>): unknown {
  if (Object.prototype.hasOwnProperty.call(params, "payload")) {
    return params.payload;
  }
  return undefined;
}

const plugin = {
  id: "openclaw-a2a-client",
  async register(api: PluginApi): Promise<void> {
    if (typeof api.registerGatewayMethod !== "function") {
      throw new Error("Plugin API missing registerGatewayMethod");
    }

    const baseConfig = toObject(api.pluginConfig) as A2APluginConfig;

    api.registerGatewayMethod(
      "a2a-client.card",
      methodHandler("card", async (_ctx, config) => card(config), baseConfig)
    );

    api.registerGatewayMethod(
      "a2a-client.probe",
      methodHandler("probe", async (_ctx, config) => probe(config), baseConfig)
    );

    api.registerGatewayMethod(
      "a2a-client.send",
      methodHandler("send", async (ctx, config) => {
        const params = toObject(ctx.params);
        return send(config, readPayload(params));
      }, baseConfig)
    );

    api.registerGatewayMethod(
      "a2a-client.smoke",
      methodHandler("smoke", async (_ctx, config) => smoke(config), baseConfig)
    );

    api.logger?.info?.("Registered A2A client gateway methods", {
      methods: [
        "a2a-client.card",
        "a2a-client.probe",
        "a2a-client.send",
        "a2a-client.smoke",
      ],
    });
  },
};

export default plugin;
