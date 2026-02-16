# TypeScript Plugin Layer

## Purpose

This document describes the OpenClaw plugin layer added on top of the v1 skill package.

The plugin layer enables runtime registration of Gateway-callable methods while preserving the existing skill scripts for operator and ClawHub workflows.

## Files

1. Manifest: `openclaw.plugin.json`
2. Runtime module: `src/index.ts`
3. Transport core: `src/client.ts`
4. Types: `src/types.ts`
5. Build config: `package.json`, `tsconfig.json`

## Runtime Contract

The runtime exports a default plugin object with:

1. `id: "openclaw-a2a-client"`
2. `register(api)` method

`register(api)` binds four gateway methods:

1. `a2a-client.card`
2. `a2a-client.send`
3. `a2a-client.probe`
4. `a2a-client.smoke`

The implementation supports both response styles:

1. If context includes `respond(ok, payload)`, it uses that.
2. Otherwise it returns payload directly.

## Method Semantics

### `a2a-client.card`

Retrieves agent card from configured `cardUrl` (or default `.well-known` path under `baseUrl`).

### `a2a-client.send`

POSTs JSON payload to `endpointUrl` (or default `/a2a` under `baseUrl`).

Input shape:

```json
{
  "payload": {}
}
```

### `a2a-client.probe`

GET reachability probe against `baseUrl`.

### `a2a-client.smoke`

Runs card + send sequence with canonical hello payload and returns smoke diagnostics.

## Config Resolution

Config is resolved from:

1. Plugin config (`api.pluginConfig`)
2. Environment variables (`A2A_*`)
3. Hard defaults

Per-call overrides are supported via method params:

```json
{
  "config": {
    "baseUrl": "...",
    "authMode": "bearer"
  }
}
```

## Authorization

Supported modes:

1. `none`
2. `bearer`
3. `basic`
4. `header`

Validation occurs before network requests. Missing credentials produce `config_error` envelopes.

## Reliability Policy

Transport retries are configurable and bounded:

1. `maxRetries` (default `2`, max `5`)
2. `retryBaseDelayMs` (default `250`)
3. `retryMaxDelayMs` (default `2000`)

Retry policy applies to:

1. Network-level failures (`fetch`/timeout errors)
2. Transient HTTP responses: `408`, `429`, `500`, `502`, `503`, `504`

Backoff is exponential and capped by `retryMaxDelayMs`.

## Output Envelope Contract

Success envelope:

```json
{
  "ok": true,
  "operation": "send",
  "attempts": 1,
  "status": 200,
  "url": "https://hello.a2aregistry.org/a2a",
  "data": {}
}
```

Error envelope:

```json
{
  "ok": false,
  "operation": "send",
  "attempts": 2,
  "status": 401,
  "url": "https://example/a2a",
  "error": {
    "code": "http_error",
    "message": "Request failed with HTTP 401"
  },
  "body": {}
}
```

Error code categories used by runtime:

1. `config_error`
2. `invalid_payload`
3. `network_error`
4. `http_error`
5. `smoke_card_failed`
6. `smoke_send_failed`

## Build and Test

1. Install dependencies:
```bash
npm install
```
2. Build:
```bash
npm run build
```
3. Plugin unit tests:
```bash
npm run test:plugin
```
4. Full suite:
```bash
npm test
```

## Consullo Integration Notes

The plugin is intentionally transport-focused. Consullo should remain the authority for:

1. Policy gating
2. Trust decisions
3. Governance actions
4. Audit continuity

The normalized envelopes are intentionally stable so Consullo can wrap method calls and enforce controls deterministically.
