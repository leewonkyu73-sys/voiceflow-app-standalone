#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace

BASE_URL=${E2E_BASE_URL:-https://voice.star45.net}
REPORT=/opt/star45/voiceflow-data/live-e2e-report.json

echo "[LIVE E2E] target=$BASE_URL"

echo "[1/5] Verify live version"
VERSION=$(curl -fsSL "$BASE_URL/version.json" || true)
echo "$VERSION"
echo "$VERSION" | grep -q '"version":"2.6.1"' || { echo "FAIL: live version is not 2.6.1"; exit 1; }

echo "[2/5] Verify health"
curl -fsSL "$BASE_URL/api/health" | grep -q '"ok":true' || { echo "FAIL: gateway health"; exit 1; }

echo "[3/5] Pull Playwright runner image"
docker pull mcr.microsoft.com/playwright:v1.55.0-noble >/dev/null

echo "[4/5] Run Chromium E2E against live domain"
docker run --rm --network host \
  -e E2E_BASE_URL="$BASE_URL" \
  -e E2E_REPORT_FILE=/report/live-e2e-report.json \
  -v "$PWD:/work" -v /opt/star45/voiceflow-data:/report -w /work \
  mcr.microsoft.com/playwright:v1.55.0-noble \
  bash -lc "npm install --no-save playwright@1.55.0 >/dev/null 2>&1 && node tests/e2e-meeting.mjs"

echo "[5/5] Run service QA"
sh deploy/qa-v23.sh

echo "=== LIVE E2E REPORT ==="
cat "$REPORT"
echo

grep -q '"ok": true' "$REPORT" || { echo "FAIL: live browser E2E report is not 100% PASS"; exit 1; }
echo "LIVE BROWSER E2E PASS"
