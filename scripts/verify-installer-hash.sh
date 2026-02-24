#!/usr/bin/env bash
# Verify (and optionally update) the pinned OpenClaw installer SHA-256 hash.
#
# Usage:
#   bash scripts/verify-installer-hash.sh          # compare only
#   bash scripts/verify-installer-hash.sh --update  # update sandbox.yml in place
#
# Outputs audit information for commit messages.
set -euo pipefail

WORKFLOW=".github/workflows/sandbox.yml"
UPDATE=false
[ "${1:-}" = "--update" ] && UPDATE=true

# Extract current pinned hash
CURRENT=$(grep -oE "INSTALLER_SHA256: '[a-f0-9]{64}'" "$WORKFLOW" | grep -oE '[a-f0-9]{64}')
echo "📌 Pinned hash:   $CURRENT"

# Download and compute latest
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
curl -fsSL https://openclaw.ai/install.sh -o "$TMP"

if command -v sha256sum &>/dev/null; then
  LATEST=$(sha256sum "$TMP" | awk '{print $1}')
else
  LATEST=$(shasum -a 256 "$TMP" | awk '{print $1}')
fi
echo "🌐 Upstream hash: $LATEST"

SIZE=$(wc -c < "$TMP" | tr -d ' ')
LINES=$(wc -l < "$TMP" | tr -d ' ')
echo "📄 Script size:   ${SIZE} bytes, ${LINES} lines"
echo ""

if [ "$CURRENT" = "$LATEST" ]; then
  echo "✅ Hash matches — no update needed."
  exit 0
fi

echo "⚠️  Hash mismatch — upstream installer has changed."
echo ""
echo "--- Audit info (include in commit message) ---"
echo "Old: $CURRENT"
echo "New: $LATEST"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Script header:"
head -5 "$TMP" | sed 's/^/  /'
echo "-----------------------------------------------"

if [ "$UPDATE" = true ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/$CURRENT/$LATEST/" "$WORKFLOW"
    sed -i '' "s/Last verified: [0-9-]*/Last verified: $(date +%Y-%m-%d)/" "$WORKFLOW"
  else
    sed -i "s/$CURRENT/$LATEST/" "$WORKFLOW"
    sed -i "s/Last verified: [0-9-]*/Last verified: $(date +%Y-%m-%d)/" "$WORKFLOW"
  fi
  echo ""
  echo "✅ Updated $WORKFLOW"
  echo "   Remember to commit with audit info above."
else
  echo ""
  echo "Run with --update to apply the change."
fi
