#!/usr/bin/env bash
# NOTE: Must be run with bash (uses $RANDOM as fallback for port generation).
set -euo pipefail

# --- Isolation: use temp directory to avoid killing production instances ---
export CLAW_INSIGHTS_HOME="$(mktemp -d -t claw-insights-smoke-home-XXXXXX)"

# --- Random high ports to avoid conflicts ---
random_port() {
  if command -v shuf >/dev/null 2>&1; then
    shuf -i 50000-59999 -n 1
  elif command -v jot >/dev/null 2>&1; then
    jot -r 1 50000 59999
  else
    echo $(( (RANDOM % 10000) + 50000 ))
  fi
}

PORT="${1:-$(random_port)}"
RUN_PORT="${2:-$((PORT + 1))}"
CLI_BIN="${CLAW_INSIGHTS_BIN:-claw-insights}"
LOG_DIR="$(mktemp -d -t claw-insights-smoke-XXXXXX)"
RUN_LOG="$LOG_DIR/foreground-run.log"
RUN_PID=""
RUN_KILL_TARGET=""

# --- Abort if target ports already in use (safety net) ---
port_in_use() {
  nc -z 127.0.0.1 "$1" 2>/dev/null
}

if port_in_use "$PORT"; then
  echo "ERROR: port ${PORT} already in use — aborting to protect running instance" >&2
  exit 1
fi
if port_in_use "$RUN_PORT"; then
  echo "ERROR: port ${RUN_PORT} already in use — aborting to protect running instance" >&2
  exit 1
fi

wait_for_health() {
  local port="$1"
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

cleanup() {
  "$CLI_BIN" stop >/dev/null 2>&1 || true

  if [[ -n "$RUN_PID" ]]; then
    if [[ -n "$RUN_KILL_TARGET" ]]; then
      kill -TERM "$RUN_KILL_TARGET" >/dev/null 2>&1 || true
    else
      kill -TERM "$RUN_PID" >/dev/null 2>&1 || true
    fi
    wait "$RUN_PID" >/dev/null 2>&1 || true
  fi

  rm -rf "$LOG_DIR" "$CLAW_INSIGHTS_HOME"
}
trap cleanup EXIT

# 1) Daemon startup path (claw-insights start ...)
"$CLI_BIN" start --server-only --no-auth --port "$PORT"
if ! wait_for_health "$PORT"; then
  "$CLI_BIN" logs --lines 80 || true
  echo "Smoke check failed: daemon start health endpoint not reachable" >&2
  exit 1
fi
"$CLI_BIN" stop >/dev/null 2>&1 || true

# 2) Foreground default path (claw-insights ... => run)
if command -v setsid >/dev/null 2>&1; then
  setsid "$CLI_BIN" --server-only --no-auth --port "$RUN_PORT" >"$RUN_LOG" 2>&1 &
  RUN_PID="$!"
  RUN_KILL_TARGET="-$RUN_PID"
else
  "$CLI_BIN" --server-only --no-auth --port "$RUN_PORT" >"$RUN_LOG" 2>&1 &
  RUN_PID="$!"
  RUN_KILL_TARGET="$RUN_PID"
fi

if ! wait_for_health "$RUN_PORT"; then
  cat "$RUN_LOG" || true
  echo "Smoke check failed: foreground run health endpoint not reachable" >&2
  exit 1
fi

if [[ -n "$RUN_KILL_TARGET" ]]; then
  kill -TERM "$RUN_KILL_TARGET" >/dev/null 2>&1 || true
else
  kill -TERM "$RUN_PID" >/dev/null 2>&1 || true
fi
wait "$RUN_PID" >/dev/null 2>&1 || true
RUN_PID=""
RUN_KILL_TARGET=""

echo "✅ Smoke test passed (ports: ${PORT}, ${RUN_PORT}, home: ${CLAW_INSIGHTS_HOME})"
