#!/usr/bin/env bash
# Sandbox E2E verification script.
# Tests the full claw-insights release bin: install, daemon, web UI, GraphQL, auth.
#
# Usage:
#   MOCK_SCENARIO=healthy bash sandbox/sandbox-verify.sh [options]
#
# Options:
#   --cli-path <path>   Path to openclaw CLI (default: sandbox mock)
#   --port <port>       Server port (default: 4111)
#   --scenario <name>   Mock scenario (default: healthy)
#   --release-bin <path> Path to claw-insights bin (default: auto-detect)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
CLI_PATH="${CLAW_INSIGHTS_CLI:-$SCRIPT_DIR/mock-openclaw/bin/openclaw}"
PORT="${CLAW_INSIGHTS_PORT:-4111}"
SCENARIO="${MOCK_SCENARIO:-healthy}"
RELEASE_BIN=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cli-path) CLI_PATH="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --scenario) SCENARIO="$2"; shift 2 ;;
    --release-bin) RELEASE_BIN="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ── Resolve claw-insights binary (R2: use array to avoid shell splitting) ──
CI_BIN_ARGS=()
if [ -n "$RELEASE_BIN" ]; then
  CI_BIN_ARGS=("$RELEASE_BIN")
elif command -v claw-insights &> /dev/null; then
  CI_BIN_ARGS=(claw-insights)
elif [ -f "$REPO_DIR/dist/release/bin/claw-insights" ]; then
  CI_BIN_ARGS=(node "$REPO_DIR/dist/release/bin/claw-insights")
else
  echo "❌ Cannot find claw-insights. Build first: bash scripts/build-release.sh"
  exit 1
fi

# Wrapper function for safe execution (handles paths with spaces)
run_bin() {
  CLAW_INSIGHTS_CLI="$CLI_PATH" MOCK_SCENARIO="$SCENARIO" "${CI_BIN_ARGS[@]}" "$@"
}

PASS=0
FAIL=0
TOTAL=0
DAEMON_STARTED=false

check() {
  local name="$1"
  local result="$2"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "0" ]; then
    PASS=$((PASS + 1))
    echo "  ✅ $name"
  else
    FAIL=$((FAIL + 1))
    echo "  ❌ $name"
  fi
}

cleanup() {
  if [ "$DAEMON_STARTED" = true ]; then
    echo ""
    echo "▶ Cleanup: stopping daemon"
    run_bin stop 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "🧪 Sandbox E2E (scenario=$SCENARIO, port=$PORT, bin=${CI_BIN_ARGS[*]})"
echo ""

# ── Phase 1: Pre-flight ──

echo "▶ Phase 1: Pre-flight checks"

# 1.1 Mock CLI
if [ -x "$CLI_PATH" ]; then
  check "Mock CLI is executable" 0
else
  check "Mock CLI is executable" 1
  echo "  Error: $CLI_PATH not found or not executable"
  exit 1
fi

# 1.2 Mock CLI returns JSON
MOCK_SCENARIO="$SCENARIO" "$CLI_PATH" status --json > /dev/null 2>&1
check "Mock CLI returns JSON" $?

# 1.3 Version (R3: assert structured output)
VERSION_OUT=$(run_bin --version 2>&1 || echo "FAIL")
if echo "$VERSION_OUT" | grep -qE "^claw-insights v[0-9]+\.[0-9]+"; then
  check "--version output" 0
else
  check "--version output (expected 'claw-insights vX.Y.Z')" 1
fi

# 1.4 Help (R3: assert specific subcommands listed)
HELP_OUT=$(run_bin --help 2>&1 || echo "FAIL")
if echo "$HELP_OUT" | grep -q "start" && echo "$HELP_OUT" | grep -q "stop" && echo "$HELP_OUT" | grep -q "status"; then
  check "--help shows start/stop/status commands" 0
else
  check "--help shows start/stop/status commands" 1
fi

# ── Phase 2: Daemon lifecycle (no-auth mode) ──

echo ""
echo "▶ Phase 2: Daemon lifecycle (--no-auth)"

export CLAW_INSIGHTS_CLI="$CLI_PATH"
export MOCK_SCENARIO="$SCENARIO"

# 2.1 Start daemon
START_OUT=$(run_bin start --no-auth --port "$PORT" 2>&1 || echo "FAIL")
if echo "$START_OUT" | grep -q "started\|PID"; then
  check "daemon start" 0
  DAEMON_STARTED=true
else
  check "daemon start" 1
  echo "  Output: $START_OUT"
  exit 1
fi

# Wait for server ready (max 15s)
READY=false
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 0.5
done

if [ "$READY" = true ]; then
  check "server healthy after start" 0
else
  check "server healthy after start" 1
  echo "  Server not ready within 15s"
fi

# 2.2 Status (R3: assert PID number in output)
STATUS_OUT=$(run_bin status 2>&1 || echo "FAIL")
if echo "$STATUS_OUT" | grep -qE "PID.*[0-9]+|running"; then
  check "daemon status shows PID" 0
else
  check "daemon status shows PID" 1
fi

# 2.3 Logs (R3: assert exit code 0 + non-empty output)
LOGS_OUT=$(run_bin logs --lines 3 2>&1)
LOGS_RC=$?
if [ "$LOGS_RC" -eq 0 ] && [ -n "$LOGS_OUT" ]; then
  check "daemon logs (exit 0, non-empty)" 0
else
  check "daemon logs (exit=$LOGS_RC, output=${#LOGS_OUT} bytes)" 1
fi

# ── Phase 3: Web UI + GraphQL ──

echo ""
echo "▶ Phase 3: Web UI + GraphQL"

# 3.1 Web UI serves HTML
WEB_OUT=$(curl -sf "http://127.0.0.1:$PORT/" 2>&1 || echo "")
if echo "$WEB_OUT" | grep -qi "<!doctype html\|<html"; then
  check "Web UI serves HTML (production static)" 0
else
  check "Web UI serves HTML (production static)" 1
fi

# 3.2 SPA fallback (non-API route returns index.html)
SPA_OUT=$(curl -sf "http://127.0.0.1:$PORT/sessions" 2>&1 || echo "")
if echo "$SPA_OUT" | grep -qi "<!doctype html\|<html"; then
  check "SPA fallback (/sessions → index.html)" 0
else
  check "SPA fallback (/sessions → index.html)" 1
fi

# 3.3 GraphQL gateway query
GW_OUT=$(curl -sf "http://127.0.0.1:$PORT/graphql" -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ gateway { running version } }"}' 2>&1 || echo "CURL_FAIL")
if echo "$GW_OUT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['data']['gateway']" 2>/dev/null; then
  check "GraphQL gateway query" 0
else
  check "GraphQL gateway query" 1
fi

# 3.4 GraphQL metrics query
METRICS_OUT=$(curl -sf "http://127.0.0.1:$PORT/graphql" -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ metrics(range: TWENTY_FOUR_HOUR) { totalTokensK uptimePercent } }"}' 2>&1 || echo "CURL_FAIL")
if echo "$METRICS_OUT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['data']['metrics']" 2>/dev/null; then
  check "GraphQL metrics query" 0
else
  check "GraphQL metrics query" 1
fi

# 3.5 Health endpoint (R3: assert specific fields)
HEALTH_OUT=$(curl -sf "http://127.0.0.1:$PORT/health" 2>&1 || echo "CURL_FAIL")
if echo "$HEALTH_OUT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['status'] and 'uptime' in d" 2>/dev/null; then
  check "Health endpoint (status + uptime)" 0
else
  check "Health endpoint (status + uptime)" 1
fi

# ── Phase 4: Daemon stop + restart ──

echo ""
echo "▶ Phase 4: Daemon stop + restart"

# 4.1 Restart
RESTART_OUT=$(run_bin restart --no-auth --port "$PORT" 2>&1 || echo "FAIL")
if echo "$RESTART_OUT" | grep -q "started\|PID"; then
  check "daemon restart" 0
else
  check "daemon restart" 1
fi

# Wait for ready after restart
sleep 2
READY2=false
for i in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
    READY2=true
    break
  fi
  sleep 0.5
done
check "server healthy after restart" "$([ "$READY2" = true ] && echo 0 || echo 1)"

# 4.2 Stop
STOP_OUT=$(run_bin stop 2>&1 || echo "FAIL")
if echo "$STOP_OUT" | grep -qi "stop"; then
  check "daemon stop" 0
  DAEMON_STARTED=false
else
  check "daemon stop" 1
fi

# 4.3 Verify stopped (R3: check both status output AND PID file)
sleep 1
STATUS_AFTER=$(run_bin status 2>&1 || echo "")
PID_FILE="$HOME/.claw-insights/claw-insights.pid"
PID_GONE=true
if [ -f "$PID_FILE" ]; then
  PID_GONE=false
fi
if echo "$STATUS_AFTER" | grep -qi "not running" && [ "$PID_GONE" = true ]; then
  check "confirmed stopped (status + PID file cleaned)" 0
else
  check "confirmed stopped (status not-running=$( echo "$STATUS_AFTER" | grep -qi "not running" && echo Y || echo N ), pid_gone=$PID_GONE)" 1
fi

# ── Phase 5: Auth verification (R1+R4: inject known token via env) ──

echo ""
echo "▶ Phase 5: Auth verification"

AUTH_PORT=$((PORT + 1))
AUTH_TOKEN="sandbox-test-token-$(date +%s)-abcdef1234567890"

# 5.1 Start with auth enabled, inject known token (R4: no log grep needed)
CLAW_INSIGHTS_API_TOKEN="$AUTH_TOKEN" \
  run_bin start --port "$AUTH_PORT" 2>&1 || true
DAEMON_STARTED=true

# Wait for server ready
AUTH_READY=false
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$AUTH_PORT/health" > /dev/null 2>&1; then
    AUTH_READY=true
    break
  fi
  sleep 0.5
done

if [ "$AUTH_READY" = true ]; then
  check "daemon start (auth enabled, injected token)" 0

  # 5.2 Unauthenticated request → should be rejected
  UNAUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://127.0.0.1:$AUTH_PORT/graphql" -X POST \
    -H "Content-Type: application/json" \
    -d '{"query":"{ gateway { running } }"}' 2>&1 || echo "000")
  if [ "$UNAUTH_CODE" = "401" ] || [ "$UNAUTH_CODE" = "403" ]; then
    check "unauthenticated GraphQL → $UNAUTH_CODE" 0
  else
    check "unauthenticated GraphQL → expected 401/403, got $UNAUTH_CODE" 1
  fi

  # 5.3 Bearer token → should succeed
  AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://127.0.0.1:$AUTH_PORT/graphql" -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d '{"query":"{ gateway { running } }"}' 2>&1 || echo "000")
  if [ "$AUTH_CODE" = "200" ]; then
    check "Bearer token GraphQL → 200" 0
  else
    check "Bearer token GraphQL → expected 200, got $AUTH_CODE" 1
  fi

  # 5.4 Cookie exchange (token URL → Set-Cookie → cookie-auth GraphQL)
  COOKIE_JAR=$(mktemp)
  COOKIE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" -L \
    "http://127.0.0.1:$AUTH_PORT/?token=$AUTH_TOKEN" 2>&1 || echo "000")
  if grep -q "claw_session" "$COOKIE_JAR" 2>/dev/null; then
    check "Cookie exchange (Set-Cookie on token URL)" 0

    # 5.5 Cookie-authenticated GraphQL (R2-minor: full cookie roundtrip)
    # Note: CSRF check requires Origin header for POST requests with cookie auth
    COOKIE_GQL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" \
      "http://127.0.0.1:$AUTH_PORT/graphql" -X POST \
      -H "Content-Type: application/json" \
      -H "Origin: http://127.0.0.1:$AUTH_PORT" \
      -d '{"query":"{ gateway { running } }"}' 2>&1 || echo "000")
    if [ "$COOKIE_GQL_CODE" = "200" ]; then
      check "Cookie-authenticated GraphQL → 200" 0
    else
      check "Cookie-authenticated GraphQL → expected 200, got $COOKIE_GQL_CODE" 1
    fi
  else
    check "Cookie exchange (no claw_session cookie)" 1
    check "Cookie-authenticated GraphQL (skipped)" 1
  fi
  rm -f "$COOKIE_JAR"
else
  check "auth server ready" 1
  check "unauthenticated GraphQL (skipped)" 1
  check "Bearer token (skipped)" 1
  check "Cookie exchange (skipped)" 1
  check "Cookie-authenticated GraphQL (skipped)" 1
fi

# 5.6 Stop auth server
run_bin stop 2>/dev/null || true
DAEMON_STARTED=false

# ── Summary ──

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
