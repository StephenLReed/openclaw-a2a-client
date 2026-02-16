import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { card, probe, resolveConfig, send } from "../dist/client.js";

const execFile = promisify(execFileCb);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let server;
let baseUrl;
const callCounters = {
  retrySend: 0,
};

function unauthorized(res) {
  res.writeHead(401, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "unauthorized" }));
}

function checkAuth(mode, req) {
  const authHeader = req.headers.authorization ?? "";
  if (mode === "none" || mode === "retry") {
    return true;
  }
  if (mode === "bearer") {
    return authHeader === "Bearer token-123";
  }
  if (mode === "basic") {
    return authHeader === "Basic dXNlcjpwYXNz";
  }
  if (mode === "header") {
    return req.headers["x-a2a-test"] === "header-123";
  }
  return false;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

before(async () => {
  server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
    const segments = requestUrl.pathname.split("/").filter(Boolean);
    const mode = segments[0] ?? "none";
    const suffix = segments.length > 1 ? `/${segments.slice(1).join("/")}` : "";

    if (!checkAuth(mode, req)) {
      unauthorized(res);
      return;
    }

    if (req.method === "GET" && suffix === "/.well-known/agent-card.json") {
      sendJson(res, 200, {
        name: "Local Test Agent",
        url: `${baseUrl}/${mode}/a2a`,
      });
      return;
    }

    if (req.method === "GET" && suffix === "") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(`ok-${mode}`);
      return;
    }

    if (req.method === "POST" && suffix === "/a2a") {
      const rawBody = await readRequestBody(req);
      if (mode === "retry") {
        callCounters.retrySend += 1;
        if (callCounters.retrySend < 3) {
          sendJson(res, 503, { error: "temporary failure", attempt: callCounters.retrySend });
          return;
        }
      }
      sendJson(res, 200, {
        message: "ok",
        mode,
        receivedInput: rawBody,
      });
      return;
    }

    sendJson(res, 404, { error: "not_found", path: requestUrl.pathname });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe("plugin auth integration", () => {
  test("supports none/bearer/basic/header auth modes", async () => {
    const modes = [
      { name: "none", config: {} },
      { name: "bearer", config: { authMode: "bearer", authToken: "token-123" } },
      { name: "basic", config: { authMode: "basic", authUser: "user", authPass: "pass" } },
      {
        name: "header",
        config: {
          authMode: "header",
          authHeaderName: "X-A2A-Test",
          authHeaderValue: "header-123",
        },
      },
    ];

    for (const mode of modes) {
      const cfg = resolveConfig({
        baseUrl: `${baseUrl}/${mode.name}`,
        ...mode.config,
      });

      const cardResponse = await card(cfg);
      assert.equal(cardResponse.ok, true);
      assert.equal(cardResponse.status, 200);

      const sendResponse = await send(cfg, { message: `hello-${mode.name}` });
      assert.equal(sendResponse.ok, true);
      const input = JSON.parse(sendResponse.data.receivedInput);
      assert.equal(input.message, `hello-${mode.name}`);

      const probeResponse = await probe(cfg);
      assert.equal(probeResponse.ok, true);
      assert.equal(probeResponse.status, 200);
    }
  });

  test("returns 401 on bad bearer token", async () => {
    const cfg = resolveConfig({
      baseUrl: `${baseUrl}/bearer`,
      authMode: "bearer",
      authToken: "bad-token",
      maxRetries: 0,
    });
    const result = await send(cfg, { test: true });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.equal(result.error.code, "http_error");
  });

  test("retries transient 503 responses", async () => {
    callCounters.retrySend = 0;
    const cfg = resolveConfig({
      baseUrl: `${baseUrl}/retry`,
      authMode: "none",
      maxRetries: 3,
      retryBaseDelayMs: 1,
      retryMaxDelayMs: 2,
    });
    const result = await send(cfg, { retry: true });
    assert.equal(result.ok, true);
    assert.equal(result.attempts, 3);
    assert.equal(callCounters.retrySend, 3);
  });
});

describe("script auth integration", () => {
  async function runScript(action, payloadPath, env = {}) {
    const scriptPath = path.join(REPO_ROOT, "scripts", "a2a_request.sh");
    const args = [scriptPath, action];
    if (payloadPath) {
      args.push(payloadPath);
    }
    const { stdout } = await execFile("bash", args, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
    });
    return JSON.parse(stdout.trim());
  }

  test("script supports bearer/basic/header auth modes", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "a2a-auth-test-"));
    const payloadPath = path.join(tempDir, "payload.json");
    await fs.writeFile(payloadPath, JSON.stringify({ message: "hello-script" }));

    try {
      const scenarios = [
        {
          mode: "bearer",
          env: { A2A_AUTH_MODE: "bearer", A2A_AUTH_TOKEN: "token-123" },
        },
        {
          mode: "basic",
          env: { A2A_AUTH_MODE: "basic", A2A_AUTH_USER: "user", A2A_AUTH_PASS: "pass" },
        },
        {
          mode: "header",
          env: {
            A2A_AUTH_MODE: "header",
            A2A_AUTH_HEADER_NAME: "X-A2A-Test",
            A2A_AUTH_HEADER_VALUE: "header-123",
          },
        },
      ];

      for (const scenario of scenarios) {
        const env = {
          A2A_BASE_URL: `${baseUrl}/${scenario.mode}`,
          ...scenario.env,
        };
        const cardResult = await runScript("card", undefined, env);
        assert.equal(cardResult.ok, true);
        const sendResult = await runScript("send", payloadPath, env);
        assert.equal(sendResult.ok, true);
      }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
