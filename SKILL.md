---
name: a2a-client
description: Interact with A2A endpoints for card discovery, message send, probing, and smoke testing with optional auth.
homepage: https://a2aregistry.org
metadata: { "openclaw": { "requires": { "bins": ["bash", "curl", "jq"] }, "primaryEnv": "A2A_AUTH_MODE", "install": [{ "kind": "brew", "formula": "jq", "bins": ["jq"], "label": "Install jq" }] } }
---

# A2A Client

Use this skill to validate and operate A2A transport from OpenClaw against public or private endpoints.

## Defaults

1. Base URL: `${A2A_BASE_URL:-https://hello.a2aregistry.org}`
2. Agent card URL: `${A2A_CARD_URL:-${A2A_BASE_URL}/.well-known/agent-card.json}`
3. A2A endpoint URL: `${A2A_ENDPOINT_URL:-${A2A_BASE_URL}/a2a}`

## Commands

### Fetch agent card

```bash
bash {baseDir}/scripts/a2a_request.sh card
```

### Send a JSON payload

```bash
bash {baseDir}/scripts/a2a_request.sh send {baseDir}/examples/message-send.json
```

### Probe endpoint reachability

```bash
bash {baseDir}/scripts/a2a_request.sh probe
```

### Run full smoke test

```bash
bash {baseDir}/scripts/a2a_smoke.sh
```

## Authorization

Supported modes:

1. `A2A_AUTH_MODE=none`
2. `A2A_AUTH_MODE=bearer` with `A2A_AUTH_TOKEN`
3. `A2A_AUTH_MODE=basic` with `A2A_AUTH_USER` and `A2A_AUTH_PASS`
4. `A2A_AUTH_MODE=header` with `A2A_AUTH_HEADER_NAME` and `A2A_AUTH_HEADER_VALUE`

The scripts never print credential values in success or error envelopes.
