# OpenClaw A2A Client

OpenClaw-compatible A2A client implementation with two layers:

1. Skill layer for ClawHub and edge-script workflows.
2. TypeScript plugin runtime layer for Gateway method registration.

The design keeps Consullo as the system-of-record for governance, trust, and policy decisions.

## What This Repository Delivers

1. Publishable OpenClaw skill package (`SKILL.md`).
2. Auth-aware transport scripts (`card`, `send`, `probe`, `smoke`).
3. TypeScript plugin with `openclaw.plugin.json` and runtime module.
4. Unit and integration tests.
5. Comprehensive markdown documentation.

## Repository Layout

```text
openclaw-a2a-client/
  SKILL.md
  openclaw.plugin.json
  package.json
  tsconfig.json
  README.md
  docs/
    architecture.md
    plugin-layer.md
    publishing.md
  src/
    client.ts
    index.ts
    types.ts
  scripts/
    a2a_request.sh
    a2a_smoke.sh
  examples/
    message-send.json
    ping.json
  tests/
    test.sh
    plugin-runtime.test.mjs
```

## Quick Start

### 1. Validate skill prerequisites

```bash
command -v bash curl jq
```

### 2. Run script-based smoke test

```bash
bash scripts/a2a_smoke.sh
```

### 3. Build plugin runtime

```bash
npm install
npm run build
```

### 4. Run full test suite

```bash
npm test
```

## Skill Layer Commands

1. Fetch card:
```bash
bash scripts/a2a_request.sh card
```
2. Send payload:
```bash
bash scripts/a2a_request.sh send examples/message-send.json
```
3. Probe base URL:
```bash
bash scripts/a2a_request.sh probe
```
4. End-to-end smoke:
```bash
bash scripts/a2a_smoke.sh
```

## Plugin Layer

Manifest:

1. `openclaw.plugin.json`

Runtime entry:

1. `src/index.ts`

Registered gateway methods:

1. `a2a-client.card`
2. `a2a-client.send`
3. `a2a-client.probe`
4. `a2a-client.smoke`

`a2a-client.send` parameters:

```json
{
  "payload": {
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {}
  }
}
```

Optional per-call config overrides:

```json
{
  "config": {
    "baseUrl": "https://hello.a2aregistry.org",
    "authMode": "none"
  }
}
```

## Configuration

Plugin config schema fields:

1. Endpoint: `baseUrl`, `cardUrl`, `endpointUrl`, `timeoutMs`
2. Auth: `authMode`, `authToken`, `authUser`, `authPass`, `authHeaderName`, `authHeaderValue`
3. Headers: `defaultHeaders`

Script env variables:

1. Endpoint: `A2A_BASE_URL`, `A2A_CARD_URL`, `A2A_ENDPOINT_URL`, `A2A_TIMEOUT_SEC`
2. Auth mode: `A2A_AUTH_MODE` (`none|bearer|basic|header`)
3. Auth secrets: `A2A_AUTH_TOKEN`, `A2A_AUTH_USER`, `A2A_AUTH_PASS`, `A2A_AUTH_HEADER_NAME`, `A2A_AUTH_HEADER_VALUE`

## Consullo Positioning

1. OpenClaw layer performs transport and diagnostics.
2. Consullo remains authoritative for policy, trust, and governance controls.
3. Normalized envelopes are designed for Consullo-side audit and control pipelines.

## Documentation

1. Architecture: `docs/architecture.md`
2. Plugin runtime: `docs/plugin-layer.md`
3. Publishing flow: `docs/publishing.md`
