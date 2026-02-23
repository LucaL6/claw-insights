#!/usr/bin/env bash
# One-line install for claw-insights from local tarball.
# Usage: bash scripts/install.sh [path-to-tgz]

set -euo pipefail

TGZ="${1:-}"

# Find tgz
if [ -z "$TGZ" ]; then
  TGZ=$(ls -t dist/claw-insights-*.tgz 2>/dev/null | head -1)
fi

if [ -z "$TGZ" ] || [ ! -f "$TGZ" ]; then
  echo "❌ No tgz found. Run: npm run release:build"
  exit 1
fi

echo "📦 Installing claw-insights from $TGZ..."
npm install -g "$TGZ"

echo ""
echo "✅ Installed! Run: claw-insights --help"
echo ""
echo "Quick start:"
echo "  claw-insights                    # default port 4000"
echo "  claw-insights --port 8080        # custom port"
echo "  claw-insights --cli-path /path   # custom OpenClaw CLI"
