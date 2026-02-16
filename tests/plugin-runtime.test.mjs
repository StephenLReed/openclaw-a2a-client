import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import plugin from "../dist/index.js";
import {
  buildHeaders,
  resolveConfig,
  send,
} from "../dist/client.js";

const originalFetch = globalThis.fetch;

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("config and header behavior", () => {
  test("resolveConfig applies defaults", () => {
    const cfg = resolveConfig({}, {});
    assert.equal(cfg.baseUrl, "https://hello.a2aregistry.org");
    assert.equal(cfg.cardUrl, "https://hello.a2aregistry.org/.well-known/agent-card.json");
    assert.equal(cfg.endpointUrl, "https://hello.a2aregistry.org/a2a");
    assert.equal(cfg.authMode, "none");
  });

  test("buildHeaders sets basic auth header", () => {
    const cfg = resolveConfig({
      authMode: "basic",
      authUser: "user",
      authPass: "pass",
    });
    const headers = buildHeaders(cfg, true);
    assert.equal(headers.Authorization, "Basic dXNlcjpwYXNz");
    assert.equal(headers["Content-Type"], "application/json");
  });

  test("send rejects undefined payload", async () => {
    const cfg = resolveConfig({});
    const result = await send(cfg, undefined);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "invalid_payload");
  });
});

describe("plugin runtime registration and handlers", () => {
  test("registers gateway methods and executes send", async () => {
    const handlers = new Map();
    const logs = [];

    await plugin.register({
      pluginConfig: {
        baseUrl: "https://hello.a2aregistry.org",
      },
      registerGatewayMethod(name, handler) {
        handlers.set(name, handler);
      },
      logger: {
        info(msg, meta) {
          logs.push({ msg, meta });
        },
      },
    });

    assert.ok(handlers.has("a2a-client.card"));
    assert.ok(handlers.has("a2a-client.probe"));
    assert.ok(handlers.has("a2a-client.send"));
    assert.ok(handlers.has("a2a-client.smoke"));
    assert.equal(logs.length, 1);

    globalThis.fetch = async (url, init) => {
      const method = init?.method ?? "GET";
      if (String(url).endsWith("/a2a") && method === "POST") {
        return jsonResponse(200, {
          message: "hello",
          receivedInput: JSON.parse(String(init.body)),
        });
      }
      return jsonResponse(200, { ok: true });
    };

    const sendHandler = handlers.get("a2a-client.send");
    const sent = [];
    const callResult = await sendHandler({
      params: { payload: { ping: true } },
      respond(ok, payload) {
        sent.push({ ok, payload });
        return payload;
      },
    });

    assert.equal(sent[0].ok, true);
    assert.equal(sent[0].payload.ok, true);
    assert.equal(sent[0].payload.operation, "send");
    assert.equal(sent[0].payload.data.receivedInput.ping, true);
    assert.equal(callResult.ok, true);
  });

  test("returns config error when auth is misconfigured", async () => {
    const handlers = new Map();
    await plugin.register({
      pluginConfig: {
        baseUrl: "https://hello.a2aregistry.org",
        authMode: "bearer",
      },
      registerGatewayMethod(name, handler) {
        handlers.set(name, handler);
      },
    });

    const probeHandler = handlers.get("a2a-client.probe");
    const result = await probeHandler({ params: {} });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "config_error");
  });
});
