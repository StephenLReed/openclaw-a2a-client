#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_LIVE="${RUN_LIVE:-1}"

cd "${ROOT_DIR}"

echo "[1/4] Syntax checks"
bash -n scripts/a2a_request.sh
bash -n scripts/a2a_smoke.sh
bash -n tests/test.sh

echo "[2/4] Validation checks for auth input guards"
if A2A_AUTH_MODE="bearer" bash scripts/a2a_request.sh probe >/tmp/a2a-test-out.log 2>/tmp/a2a-test-err.log; then
  echo "Expected bearer mode without token to fail"
  exit 1
fi
if ! rg -q "A2A_AUTH_TOKEN required" /tmp/a2a-test-err.log; then
  echo "Expected A2A_AUTH_TOKEN required error message"
  exit 1
fi

if A2A_AUTH_MODE="header" bash scripts/a2a_request.sh probe >/tmp/a2a-test-out.log 2>/tmp/a2a-test-err.log; then
  echo "Expected header mode without header fields to fail"
  exit 1
fi
if ! rg -q "A2A_AUTH_HEADER_NAME required" /tmp/a2a-test-err.log; then
  echo "Expected A2A_AUTH_HEADER_NAME required error message"
  exit 1
fi

echo "[3/4] Normalized output shape checks"
PROBE_RESPONSE="$(A2A_AUTH_MODE="none" bash scripts/a2a_request.sh probe)"
echo "${PROBE_RESPONSE}" | jq -e '.ok == true and .operation == "probe" and .status >= 200 and .status < 500' >/dev/null

echo "[4/4] Live smoke test"
if [ "${RUN_LIVE}" = "1" ]; then
  SMOKE_RESPONSE="$(A2A_AUTH_MODE="none" bash scripts/a2a_smoke.sh)"
  echo "${SMOKE_RESPONSE}" | jq -e '.ok == true and .test == "hello_world_smoke"' >/dev/null
else
  echo "RUN_LIVE=0, skipping live endpoint smoke test"
fi

echo "All tests passed"
