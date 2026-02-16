# Architecture and Design

## Scope

This repository implements a skill-first OpenClaw A2A client intended for ClawHub publication and direct use inside OpenClaw instances. It is designed as an edge transport layer and diagnostic surface, not a policy engine.

## Consullo Alignment

The implementation follows a split-responsibility model:

1. OpenClaw skill executes A2A transport operations at the user edge.
2. Consullo remains the core governance and intelligence layer.
3. Consullo policy can permit, deny, or shape operations before and after transport.
4. Consullo audit systems can consume normalized operation envelopes returned by this client.

## Runtime Components

### `SKILL.md`

Declares OpenClaw metadata and usage instructions for:

1. Endpoint discovery (`card`)
2. Message delivery (`send`)
3. Connectivity checks (`probe`)
4. End-to-end smoke validation (`a2a_smoke.sh`)

### `scripts/a2a_request.sh`

Primary transport script with:

1. Endpoint resolution through environment overrides.
2. Authentication header construction for four auth modes.
3. Input validation for required credentials and JSON payload shape.
4. Request execution with timeout and normalized JSON response envelopes.
5. Structured error reporting for both network and HTTP failures.

### `scripts/a2a_smoke.sh`

Integration script for public endpoint confidence checks:

1. Generates a known JSON-RPC payload.
2. Confirms agent-card retrieval.
3. Sends message payload to A2A endpoint.
4. Validates response body shape and expected echo-like behavior.

### `examples/`

Stores reproducible JSON payload fixtures suitable for:

1. Manual transport tests.
2. Operator troubleshooting.
3. Regression checks during protocol iteration.

### `tests/test.sh`

Runs a practical test matrix:

1. Script syntax validation.
2. Auth-mode input guard checks.
3. Optional live smoke path against public endpoint.

## Endpoint Strategy

Default endpoint selection:

1. Base URL: `https://hello.a2aregistry.org`
2. Card URL: `https://hello.a2aregistry.org/.well-known/agent-card.json`
3. A2A endpoint: `https://hello.a2aregistry.org/a2a`

The endpoint can be fully overridden for private hubs or peer agents without code changes.

## Authorization Model

Supported auth modes:

1. `none`
2. `bearer`
3. `basic`
4. `header`

Credential handling principles:

1. Required credential variables are validated before network calls.
2. Secrets are consumed from environment variables only.
3. Output envelopes do not echo configured credential values.

## Response Normalization

Every operation emits a stable JSON envelope.

Success envelope:

1. `ok: true`
2. `operation`
3. `status`
4. `url`
5. `data` (JSON object or raw text fallback)

Error envelope:

1. `ok: false`
2. `operation`
3. `status` (nullable when request fails before HTTP response)
4. `url`
5. `error.code`
6. `error.message`
7. `body` (JSON object or raw text fallback)

This structure enables Consullo-side policy and audit tooling to reason consistently across endpoint types.

## Operational Boundaries

Implemented in this v1:

1. Public endpoint transport validation.
2. Auth-aware request path for private peers.
3. Packaging pattern compatible with OpenClaw skill loading.

Not implemented in this v1:

1. Streaming session management.
2. Advanced A2A method negotiation.
3. Cryptographic trust chains and delegated credential brokers.
4. Native TypeScript runtime plugin hooks.

## Upgrade Path

The repository is structured for incremental extension:

1. Add streamed operation command set while preserving envelope format.
2. Add correlation fields expected by Consullo orchestration wrappers.
3. Add plugin module and `openclaw.plugin.json` once runtime hooks are needed.
4. Keep skill docs as stable user/operator interface across implementation upgrades.
