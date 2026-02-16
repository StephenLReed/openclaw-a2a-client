#!/usr/bin/env bash
set -euo pipefail

DEFAULT_BASE_URL="https://hello.a2aregistry.org"
BASE_URL="${A2A_BASE_URL:-$DEFAULT_BASE_URL}"
CARD_URL="${A2A_CARD_URL:-$BASE_URL/.well-known/agent-card.json}"
A2A_URL="${A2A_ENDPOINT_URL:-$BASE_URL/a2a}"
TIMEOUT_SEC="${A2A_TIMEOUT_SEC:-20}"
AUTH_MODE="${A2A_AUTH_MODE:-none}"

AUTH_HEADERS=()

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required binary: $1" >&2
    exit 127
  fi
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "$name required for A2A_AUTH_MODE=${AUTH_MODE}" >&2
    exit 2
  fi
}

usage() {
  cat <<'EOF'
Usage:
  a2a_request.sh card
  a2a_request.sh send <payload.json>
  a2a_request.sh probe

Environment:
  A2A_BASE_URL           Base service URL (default: https://hello.a2aregistry.org)
  A2A_CARD_URL           Override card URL (default: ${A2A_BASE_URL}/.well-known/agent-card.json)
  A2A_ENDPOINT_URL       Override A2A endpoint URL (default: ${A2A_BASE_URL}/a2a)
  A2A_TIMEOUT_SEC        Timeout in seconds (default: 20)
  A2A_AUTH_MODE          none|bearer|basic|header (default: none)
  A2A_AUTH_TOKEN         Required for bearer
  A2A_AUTH_USER          Required for basic
  A2A_AUTH_PASS          Required for basic
  A2A_AUTH_HEADER_NAME   Required for header
  A2A_AUTH_HEADER_VALUE  Required for header
EOF
}

build_auth_headers() {
  case "$AUTH_MODE" in
    none)
      ;;
    bearer)
      require_env "A2A_AUTH_TOKEN"
      AUTH_HEADERS+=("Authorization: Bearer ${A2A_AUTH_TOKEN}")
      ;;
    basic)
      require_env "A2A_AUTH_USER"
      require_env "A2A_AUTH_PASS"
      basic_cred="$(printf '%s:%s' "${A2A_AUTH_USER}" "${A2A_AUTH_PASS}" | base64 | tr -d '\r\n')"
      AUTH_HEADERS+=("Authorization: Basic ${basic_cred}")
      ;;
    header)
      require_env "A2A_AUTH_HEADER_NAME"
      require_env "A2A_AUTH_HEADER_VALUE"
      AUTH_HEADERS+=("${A2A_AUTH_HEADER_NAME}: ${A2A_AUTH_HEADER_VALUE}")
      ;;
    *)
      echo "Unsupported A2A_AUTH_MODE: ${AUTH_MODE}" >&2
      exit 2
      ;;
  esac
}

emit_success() {
  local operation="$1"
  local status="$2"
  local url="$3"
  local body="$4"

  jq -cn \
    --arg operation "$operation" \
    --argjson status "$status" \
    --arg url "$url" \
    --arg body "$body" \
    '{
      ok: true,
      operation: $operation,
      status: $status,
      url: $url,
      data: (try ($body | fromjson) catch $body)
    }'
}

emit_error() {
  local operation="$1"
  local err_code="$2"
  local message="$3"
  local status="$4"
  local url="$5"
  local body="$6"

  jq -cn \
    --arg operation "$operation" \
    --arg err_code "$err_code" \
    --arg message "$message" \
    --arg status "${status}" \
    --arg url "$url" \
    --arg body "$body" \
    '{
      ok: false,
      operation: $operation,
      status: (if ($status | length) == 0 then null else ($status | tonumber) end),
      url: $url,
      error: {
        code: $err_code,
        message: $message
      },
      body: (if ($body | length) == 0 then null else (try ($body | fromjson) catch $body) end)
    }'
}

perform_request() {
  local operation="$1"
  local method="$2"
  local url="$3"
  local payload_file="${4:-}"
  local body_file status_code curl_exit body_text
  local -a curl_cmd

  body_file="$(mktemp)"
  trap "rm -f '${body_file}'" RETURN

  curl_cmd=(
    curl
    --silent
    --show-error
    --location
    --max-time "${TIMEOUT_SEC}"
    --request "${method}"
    --write-out "%{http_code}"
    --output "${body_file}"
    "${url}"
    -H "Accept: application/json"
  )

  for header in "${AUTH_HEADERS[@]}"; do
    curl_cmd+=(-H "${header}")
  done

  if [ -n "$payload_file" ]; then
    curl_cmd+=(-H "Content-Type: application/json" --data-binary "@${payload_file}")
  fi

  if ! status_code="$("${curl_cmd[@]}")"; then
    curl_exit=$?
    body_text="$(cat "${body_file}" 2>/dev/null || true)"
    emit_error \
      "${operation}" \
      "network_error" \
      "Request failed before receiving an HTTP response (curl exit ${curl_exit})" \
      "" \
      "${url}" \
      "${body_text}"
    return 1
  fi

  body_text="$(cat "${body_file}" 2>/dev/null || true)"
  if [[ "${status_code}" =~ ^2[0-9][0-9]$ ]]; then
    emit_success "${operation}" "${status_code}" "${url}" "${body_text}"
    return 0
  fi

  emit_error \
    "${operation}" \
    "http_error" \
    "Request failed with HTTP ${status_code}" \
    "${status_code}" \
    "${url}" \
    "${body_text}"
  return 1
}

main() {
  require_bin "curl"
  require_bin "jq"
  require_bin "base64"

  action="${1:-}"
  payload_file="${2:-}"

  if [ -z "$action" ] || [ "$action" = "--help" ] || [ "$action" = "-h" ]; then
    usage
    exit 0
  fi

  build_auth_headers

  case "$action" in
    card)
      perform_request "card" "GET" "${CARD_URL}"
      ;;
    send)
      if [ -z "$payload_file" ]; then
        echo "Payload file required for send action" >&2
        exit 2
      fi
      if [ ! -f "$payload_file" ]; then
        echo "Payload file not found: ${payload_file}" >&2
        exit 2
      fi
      if ! jq -e . "${payload_file}" >/dev/null 2>&1; then
        echo "Payload file must be valid JSON: ${payload_file}" >&2
        exit 2
      fi
      perform_request "send" "POST" "${A2A_URL}" "${payload_file}"
      ;;
    probe)
      perform_request "probe" "GET" "${BASE_URL}"
      ;;
    *)
      echo "Unknown action: ${action}" >&2
      usage >&2
      exit 2
      ;;
  esac
}

main "${@}"
