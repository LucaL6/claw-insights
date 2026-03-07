#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

VERSION="${1:-0.9.0}"

echo "🔨 Building release tarball..."
bash scripts/build-release.sh "$VERSION"

echo "🐳 Building Docker image..."
docker build -f sandbox/Dockerfile.smoke -t claw-insights-smoke .

echo "🧪 Running smoke test..."
OUTPUT_DIR="/tmp/smoke-output"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

set +e
docker run --rm -v "$OUTPUT_DIR:/home/testuser/output" claw-insights-smoke
EXIT=$?
set -e

echo ""
echo "📸 Screenshots saved to: $OUTPUT_DIR/"
ls -lh "$OUTPUT_DIR"/*.png 2>/dev/null || true

exit $EXIT
