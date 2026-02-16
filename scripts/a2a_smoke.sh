#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REQUEST_SCRIPT="${SCRIPT_DIR}/a2a_request.sh"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 127
fi

PAYLOAD_FILE="$(mktemp)"
trap 'rm -f "${PAYLOAD_FILE}"' EXIT

cat > "${PAYLOAD_FILE}" <<'JSON'
{
  "jsonrpc": "2.0",
  "id": "smoke-hello-1",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "smoke-message-1",
      "role": "user",
      "parts": [
        {
          "text": "hello from openclaw a2a-client smoke test"
        }
      ]
    }
  }
}
JSON

CARD_RESPONSE="$(bash "${REQUEST_SCRIPT}" card)"
if [ "${A2A_DEBUG:-0}" = "1" ]; then
  echo "Card response: ${CARD_RESPONSE}" >&2
fi
echo "${CARD_RESPONSE}" | jq -e '.ok == true and .operation == "card"' >/dev/null

SEND_RESPONSE="$(bash "${REQUEST_SCRIPT}" send "${PAYLOAD_FILE}")"
if [ "${A2A_DEBUG:-0}" = "1" ]; then
  echo "Send response: ${SEND_RESPONSE}" >&2
fi
echo "${SEND_RESPONSE}" | jq -e '.ok == true and .operation == "send"' >/dev/null
echo "${SEND_RESPONSE}" | jq -e '.data != null' >/dev/null
echo "${SEND_RESPONSE}" | jq -e '.data.receivedInput != null or .data.message != null or .data.result != null or .data.response != null' >/dev/null

jq -cn \
  --arg base_url "${A2A_BASE_URL:-https://hello.a2aregistry.org}" \
  --arg endpoint "${A2A_ENDPOINT_URL:-${A2A_BASE_URL:-https://hello.a2aregistry.org}/a2a}" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{
    ok: true,
    test: "hello_world_smoke",
    baseUrl: $base_url,
    endpoint: $endpoint,
    timestamp: $timestamp
  }'
