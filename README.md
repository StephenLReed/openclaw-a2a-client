# OpenClaw A2A Client

OpenClaw-compatible A2A client skill designed as an edge transport layer, with Consullo retained as the core intelligence, governance, and policy authority.

## What This Repository Delivers

1. A publishable OpenClaw skill package (`SKILL.md`) for ClawHub.
2. Auth-aware A2A transport scripts for card discovery, send, and probe operations.
3. A live smoke test against the public Hello World A2A endpoint.
4. Comprehensive implementation and operations documentation.

## Repository Layout

```text
openclaw-a2a-client/
  SKILL.md
  README.md
  docs/
    architecture.md
    publishing.md
  scripts/
    a2a_request.sh
    a2a_smoke.sh
  examples/
    message-send.json
    ping.json
  tests/
    test.sh
```

## Quick Start

### 1. Validate prerequisites

```bash
command -v bash curl jq
```

### 2. Fetch agent card from public endpoint

```bash
bash scripts/a2a_request.sh card
```

### 3. Send a JSON-RPC payload

```bash
bash scripts/a2a_request.sh send examples/message-send.json
```

### 4. Run end-to-end smoke test

```bash
bash scripts/a2a_smoke.sh
```

## Environment Variables

### Endpoint controls

1. `A2A_BASE_URL` (default: `https://hello.a2aregistry.org`)
2. `A2A_CARD_URL` (default: `${A2A_BASE_URL}/.well-known/agent-card.json`)
3. `A2A_ENDPOINT_URL` (default: `${A2A_BASE_URL}/a2a`)
4. `A2A_TIMEOUT_SEC` (default: `20`)

### Authorization controls

1. `A2A_AUTH_MODE` with allowed values:
   - `none` (default)
   - `bearer`
   - `basic`
   - `header`
2. `A2A_AUTH_TOKEN` for `bearer`
3. `A2A_AUTH_USER` and `A2A_AUTH_PASS` for `basic`
4. `A2A_AUTH_HEADER_NAME` and `A2A_AUTH_HEADER_VALUE` for `header`

## Command Reference

### `a2a_request.sh card`
Fetches the agent card.

### `a2a_request.sh send <payload.json>`
Sends a JSON payload to the A2A endpoint.

### `a2a_request.sh probe`
Checks reachability for the configured base URL.

All commands return normalized JSON envelopes:

```json
{
  "ok": true,
  "operation": "send",
  "status": 200,
  "url": "https://hello.a2aregistry.org/a2a",
  "data": {}
}
```

On failure:

```json
{
  "ok": false,
  "operation": "send",
  "status": 401,
  "url": "https://example/a2a",
  "error": {
    "code": "http_error",
    "message": "Request failed with HTTP 401"
  },
  "body": {}
}
```

## Testing

### Full suite including live public endpoint smoke

```bash
bash tests/test.sh
```

### Offline-only checks (skip live network call)

```bash
RUN_LIVE=0 bash tests/test.sh
```

## Consullo Positioning

This client is intentionally transport-focused and operationally thin:

1. OpenClaw skill handles endpoint I/O and normalization.
2. Consullo remains authoritative for policy, trust, and governance decisions.
3. Correlation and audit metadata should be injected and evaluated by Consullo-side orchestration.

For design rationale and publication guidance, see:

1. `docs/architecture.md`
2. `docs/publishing.md`
