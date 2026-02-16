# ClawHub Packaging and Publishing Guide

## Intended Package Type

This repository ships both:

1. Skill package for ClawHub distribution (`SKILL.md`).
2. Plugin runtime package for OpenClaw Gateway loading (`openclaw.plugin.json` + `src/index.ts`).

## Required Publish Assets

1. `SKILL.md` at repository root.
2. `openclaw.plugin.json` at repository root for plugin-enabled distributions.
3. Only text-based files in package.
4. Size comfortably below 50MB.

## Versioning and Slug Guidance

1. Use semver tags for releases (`v0.1.0`, `v0.2.0`, etc.).
2. Keep package slug lowercase and URL-safe (example: `a2a-client`).

## Recommended Pre-Publish Validation

1. Run local tests:

```bash
npm test
```

2. Validate skill metadata and required binaries:
   - `bash`, `curl`, `jq`
3. Validate plugin manifest:
   - `id` present
   - `configSchema` present
   - method names documented
4. Confirm no secrets are committed:

```bash
git grep -n "A2A_AUTH_TOKEN\\|A2A_AUTH_PASS\\|clh_"
```

5. Confirm `SKILL.md` usage commands resolve relative paths correctly.
6. Build plugin artifact:

```bash
npm run build
```

## Example Runtime Configurations

### Plugin configuration block

```json
{
  "plugins": {
    "openclaw-a2a-client": {
      "enabled": true,
      "config": {
        "baseUrl": "https://hello.a2aregistry.org",
        "authMode": "none",
        "timeoutMs": 20000
      }
    }
  }
}
```

### Public smoke target

```json
{
  "skills": {
    "entries": {
      "a2a-client": {
        "enabled": true,
        "env": {
          "A2A_BASE_URL": "https://hello.a2aregistry.org",
          "A2A_AUTH_MODE": "none"
        }
      }
    }
  }
}
```

### Private endpoint with bearer auth

```json
{
  "skills": {
    "entries": {
      "a2a-client": {
        "enabled": true,
        "env": {
          "A2A_BASE_URL": "https://example-a2a.internal",
          "A2A_AUTH_MODE": "bearer",
          "A2A_AUTH_TOKEN": "REDACTED"
        }
      }
    }
  }
}
```

## Security Notes

1. Configure auth secrets via environment, not inline prompt text.
2. Avoid publishing endpoint credentials in issue threads or logs.
3. Prefer short-lived tokens for hub and peer integrations.
4. Keep Consullo as decision authority for trust and policy enforcement.

## Operational Notes

1. Public hello endpoint is a transport compatibility baseline, not complete protocol conformance.
2. Production workflows should include policy-aware wrappers and audit capture in Consullo.
