#!/usr/bin/env bash
# NOTE: Must be run with bash.
set -euo pipefail

export CLAW_INSIGHTS_HOME="$(mktemp -d -t claw-insights-snapshot-home-XXXXXX)"

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
CLI_BIN="${CLAW_INSIGHTS_BIN:-claw-insights}"
PID_FILE="$CLAW_INSIGHTS_HOME/claw-insights.pid"
OUT_DIR="$(mktemp -d -t claw-insights-snapshot-out-XXXXXX)"
OUT_FILE="$OUT_DIR/snapshot.png"

port_in_use() {
  nc -z 127.0.0.1 "$1" 2>/dev/null
}

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
  # Only stop daemon when the isolated home produced its own PID file.
  if [[ -f "$PID_FILE" ]]; then
    "$CLI_BIN" stop >/dev/null 2>&1 || true
  fi
  rm -rf "$OUT_DIR" "$CLAW_INSIGHTS_HOME"
}
trap cleanup EXIT

if port_in_use "$PORT"; then
  echo "ERROR: port ${PORT} already in use — aborting to protect running instance" >&2
  exit 1
fi

"$CLI_BIN" start --server-only --no-auth --port "$PORT"
if ! wait_for_health "$PORT"; then
  "$CLI_BIN" logs --lines 80 || true
  echo "Smoke check failed: daemon start health endpoint not reachable" >&2
  exit 1
fi

if [[ ! -f "$PID_FILE" ]]; then
  echo "Smoke check failed: isolated daemon PID file missing at ${PID_FILE}" >&2
  exit 1
fi

"$CLI_BIN" snapshot --detail full --theme light --lang zh --port "$PORT" -o "$OUT_FILE"

if [[ ! -s "$OUT_FILE" ]]; then
  echo "Smoke check failed: snapshot command did not produce output file" >&2
  exit 1
fi

MIME_TYPE="$(file -b --mime-type "$OUT_FILE" 2>/dev/null || echo unknown)"
if [[ "$MIME_TYPE" != "image/png" ]]; then
  echo "Smoke check failed: snapshot output is not image/png (got ${MIME_TYPE})" >&2
  file "$OUT_FILE" >&2 || true
  exit 1
fi

echo "✅ Snapshot smoke test passed (port: ${PORT}, file: ${OUT_FILE}, home: ${CLAW_INSIGHTS_HOME})"
