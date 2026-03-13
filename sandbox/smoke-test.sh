#!/usr/bin/env bash
set -uo pipefail

PASS=0; FAIL=0; TOTAL=0
OUTPUT_DIR="$HOME/output"
CI_PORT=4111
AUTH_TOKEN="smoke-test-token-aaaa-bbbb-cccc-dddd-$(date +%s)"
GW_PID=0

cleanup() {
  claw-insights stop 2>/dev/null || true
  [ "$GW_PID" -gt 0 ] && kill $GW_PID 2>/dev/null || true
}
trap cleanup EXIT

check() {
  local name="$1"; shift
  TOTAL=$((TOTAL+1))
  if eval "$@" >/dev/null 2>&1; then
    echo "  ✅ $name"; PASS=$((PASS+1))
  else
    echo "  ❌ $name"; FAIL=$((FAIL+1))
  fi
}

inject_timestamps() {
  local now_ms=$(date +%s)000
  local minus_2h=$(( $(date +%s) - 7200 ))000
  local iso_time=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  local today=$(date -u +%Y-%m-%d)
  # sessions.json
  sed -e "s/__TIMESTAMP__/${now_ms}/g" -e "s/__TIMESTAMP_MINUS_2H__/${minus_2h}/g" \
    "$HOME/fixtures/sessions.json" > /tmp/sessions-live.json
  # logs — filename must match log-tailer pattern: openclaw-YYYY-MM-DD.log
  mkdir -p /tmp/openclaw
  sed "s/__ISO_TIME__/${iso_time}/g" \
    "$HOME/fixtures/sample-logs/openclaw.log" > "/tmp/openclaw/openclaw-${today}.log"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Phase 0: Install & Config
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "🔧 Phase 0: Install & Config"

check "openclaw CLI available" \
  "openclaw --version"

check "claw-insights CLI available" \
  "claw-insights --help"

# Write minimal config (avoids onboard schema drift)
mkdir -p ~/.openclaw
cp "$HOME/fixtures/openclaw.json" ~/.openclaw/openclaw.json

# Start gateway in background
openclaw gateway &
GW_PID=$!

# Wait for gateway with retry loop (max 15s)
GW_READY=0
for i in $(seq 1 30); do
  if openclaw status --json 2>/dev/null | jq -e '.' >/dev/null 2>&1; then
    GW_READY=1; break
  fi
  sleep 0.5
done

if [ "$GW_READY" -eq 1 ]; then
  check "gateway readiness" "true"
else
  echo "  💥 Gateway startup failed. Diagnostics:"
  openclaw status --json 2>&1 | tail -20 || true
  check "gateway readiness" "false"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Phase 1: Server Bootstrap
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "🚀 Phase 1: Server Bootstrap"

claw-insights start --no-auth --port $CI_PORT
sleep 3

check "server is running" \
  "curl -sf http://127.0.0.1:${CI_PORT}/health"

check "health: status ok + db ok" \
  "curl -sf http://127.0.0.1:${CI_PORT}/health | jq -e '.status == \"ok\" and .db == \"ok\"'"

check "SPA frontend serves HTML" \
  "curl -sf http://127.0.0.1:${CI_PORT}/ | grep -q '<div id=\"root\"'"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Phase 2: API Empty State
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "📦 Phase 2: API Empty State"

check "GraphQL liveness" \
  "curl -sf -X POST http://127.0.0.1:${CI_PORT}/graphql \
    -H 'Content-Type: application/json' \
    -d '{\"query\":\"{__typename}\"}' | jq -e '.data.__typename == \"Query\"'"

check "GraphQL gateway integration" \
  "curl -sf -X POST http://127.0.0.1:${CI_PORT}/graphql \
    -H 'Content-Type: application/json' \
    -d '{\"query\":\"{gateway{running,version}}\"}' | jq -e '.data.gateway'"

check "GraphQL sessions empty" \
  "curl -sf -X POST http://127.0.0.1:${CI_PORT}/graphql \
    -H 'Content-Type: application/json' \
    -d '{\"query\":\"{sessions{key}}\"}' | jq -e '.data.sessions | length == 0'"

check "snapshot/json empty sessions" \
  "curl -sf -X POST http://127.0.0.1:${CI_PORT}/api/snapshot \
    -H 'Content-Type: application/json' \
    -d '{\"format\":\"json\"}' | jq -e '.sessions | length == 0'"

for detail in compact standard full; do
  check "screenshot/${detail}/empty → valid PNG" \
    "curl -sf -X POST http://127.0.0.1:${CI_PORT}/api/snapshot \
      -H 'Content-Type: application/json' \
      -d '{\"detail\":\"${detail}\"}' \
      -o ${OUTPUT_DIR}/empty-${detail}.png \
    && test \$(stat -c%s ${OUTPUT_DIR}/empty-${detail}.png) -gt 5000 \
    && head -c8 ${OUTPUT_DIR}/empty-${detail}.png | xxd -p | grep -q '89504e470d0a1a0a'"
done

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Phase 3: Fixture Injection
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "📊 Phase 3: Fixture Injection"

claw-insights stop
sleep 1

inject_timestamps

mkdir -p ~/.openclaw/agents/main/sessions
cp /tmp/sessions-live.json ~/.openclaw/agents/main/sessions/sessions.json

claw-insights start --no-auth --port $CI_PORT
sleep 3

check "sessions populated" \
  "curl -sf -X POST http://127.0.0.1:${CI_PORT}/api/snapshot \
    -H 'Content-Type: application/json' \
    -d '{\"format\":\"json\"}' | jq -e '.sessions | length > 0'"

check "GraphQL sessions have data" \
  "curl -sf -X POST http://127.0.0.1:${CI_PORT}/graphql \
    -H 'Content-Type: application/json' \
    -d '{\"query\":\"{sessions{key,model,totalTokens}}\"}' | jq -e '.data.sessions | length > 0'"

check "GraphQL metrics queryable" \
  "curl -sf -X POST http://127.0.0.1:${CI_PORT}/graphql \
    -H 'Content-Type: application/json' \
    -d '{\"query\":\"{metrics{totalTokensK,totalErrors,totalWarnings}}\"}' | jq -e '.data.metrics'"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Phase 4: Full Integration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "🔒 Phase 4: Full Integration"

for detail in compact standard full; do
  for theme in dark light; do
    check "screenshot/${detail}/${theme} → valid PNG" \
      "curl -sf -X POST http://127.0.0.1:${CI_PORT}/api/snapshot \
        -H 'Content-Type: application/json' \
        -d '{\"detail\":\"${detail}\",\"theme\":\"${theme}\"}' \
        -o ${OUTPUT_DIR}/data-${detail}-${theme}.png \
      && test \$(stat -c%s ${OUTPUT_DIR}/data-${detail}-${theme}.png) -gt 5000"
  done
done

check "data screenshot larger than empty" \
  "test \$(stat -c%s ${OUTPUT_DIR}/data-standard-dark.png) -gt \$(stat -c%s ${OUTPUT_DIR}/empty-standard.png)"

# Auth tests: restart without --no-auth, with known token
claw-insights stop
sleep 1

CLAW_INSIGHTS_API_TOKEN="$AUTH_TOKEN" claw-insights start --port $CI_PORT
sleep 3

check "auth: no token → 401" \
  "curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:${CI_PORT}/api/snapshot \
    -H 'Content-Type: application/json' \
    -d '{\"format\":\"json\"}' | grep -q '401'"

check "auth: Bearer token → 200" \
  "curl -sf -X POST http://127.0.0.1:${CI_PORT}/api/snapshot \
    -H 'Content-Type: application/json' \
    -H \"Authorization: Bearer ${AUTH_TOKEN}\" \
    -d '{\"format\":\"json\"}' | jq -e '.sessions'"

BAD_TOKEN='wrong-token-should-be-rejected' # gitleaks:allow
check "auth: wrong token → 403" \
  "curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:${CI_PORT}/api/snapshot \
    -H 'Content-Type: application/json' \
    -H \"Authorization: Bearer ${BAD_TOKEN}\" \
    -d '{\"format\":\"json\"}' | grep -q '403'"

claw-insights stop 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Results
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: ${PASS}/${TOTAL} passed, ${FAIL} failed"
echo "  Screenshots: ${OUTPUT_DIR}/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -lh ${OUTPUT_DIR}/*.png 2>/dev/null || true
exit ${FAIL}
