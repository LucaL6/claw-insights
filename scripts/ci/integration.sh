#!/usr/bin/env bash
set -euo pipefail

WORK_DIR="${1:?Usage: integration.sh <worktree-path>}"
cd "$WORK_DIR"

chmod +x sandbox/mock-openclaw/bin/openclaw

# Keep local simulation aligned with .github/workflows/ci.yml integration job.
export CLAW_INSIGHTS_API_TOKEN="${CLAW_INSIGHTS_API_TOKEN:-ci-test-token-ci-test-token-ci-1234}"
export CLAW_INSIGHTS_SESSIONS_PATH="${CLAW_INSIGHTS_SESSIONS_PATH:-$WORK_DIR/sandbox/fixtures/sessions.json}"
export CLAW_INSIGHTS_SERVER_PORT="${CLAW_INSIGHTS_SERVER_PORT:-41041}"
export CLAW_INSIGHTS_NO_AUTH="${CLAW_INSIGHTS_NO_AUTH:-false}"
export CLAW_INSIGHTS_SOURCE_ID="${CLAW_INSIGHTS_SOURCE_ID:-agent:main}"

# Isolate local simulation from developer machine state.
TEMP_HOME=''
if [ -n "${CLAW_INSIGHTS_TEST_HOME:-}" ]; then
  export HOME="$CLAW_INSIGHTS_TEST_HOME"
  mkdir -p "$HOME"
else
  TEMP_HOME="$(mktemp -d)"
  export HOME="$TEMP_HOME"
fi

SERVER_PID=''
stop_server() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=''
  fi
}

cleanup_home() {
  if [ -n "$TEMP_HOME" ] && [ -d "$TEMP_HOME" ]; then
    rm -rf "$TEMP_HOME"
  fi
}

cleanup() {
  stop_server
  cleanup_home
}
trap cleanup EXIT

echo "▸ Session hierarchy parity gate"
node packages/server/dist/index.js >/tmp/claw-insights-server.log 2>&1 &
SERVER_PID=$!

for attempt in {1..30}; do
  if curl -sf "http://127.0.0.1:${CLAW_INSIGHTS_SERVER_PORT}/health" >/dev/null; then
    if kill -0 "$SERVER_PID" 2>/dev/null; then
      break
    fi

    echo "Server process exited; health endpoint is served by a different process"
    echo "--- Server log ---"
    cat /tmp/claw-insights-server.log || true
    exit 1
  fi

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server process died during startup"
    echo "--- Server log ---"
    cat /tmp/claw-insights-server.log || true
    exit 1
  fi

  echo "Waiting for server health endpoint (${attempt}/30)..."
  sleep 1
done

if ! curl -sf "http://127.0.0.1:${CLAW_INSIGHTS_SERVER_PORT}/health" >/dev/null; then
  echo "Server health check failed after 30 attempts"
  echo "--- Server log ---"
  cat /tmp/claw-insights-server.log || true
  exit 1
fi

npm run -w @claw-insights/server check:session-hierarchy

# Stop parity server before test:integration (which uses port 4000)
# Keep HOME isolation alive for stage-2 tests; cleanup happens at EXIT.
stop_server

# Mirror CI step boundaries: integration tests run without NO_AUTH override.
unset CLAW_INSIGHTS_NO_AUTH
unset CLAW_INSIGHTS_SOURCE_ID
unset CLAW_INSIGHTS_API_TOKEN

echo ""
echo "▸ Integration tests"
RUN_INTEGRATION=1 \
MOCK_SCENARIO=healthy \
CLAW_INSIGHTS_CLI="$WORK_DIR/sandbox/mock-openclaw/bin/openclaw" \
CLAW_INSIGHTS_SESSIONS_PATH="$WORK_DIR/sandbox/fixtures/sessions.json" \
CLAW_INSIGHTS_SERVER_PORT=4000 \
  npm run -w @claw-insights/server test:integration
