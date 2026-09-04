#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace

echo "=== STAR45 AI Meeting live repair v2.6.1 ==="
git fetch origin main
git reset --hard origin/main

if [ ! -f .env ]; then
  cp deploy/.env.v24.example .env
  echo "Created .env. Fill required Google OAuth values and rerun."
  exit 2
fi

sh deploy/finalize-v26.sh

echo "=== Runtime fingerprint ==="
curl -fsS http://127.0.0.1:4173/version.json; echo

echo "=== Gateway health ==="
curl -fsS http://127.0.0.1:4173/api/health; echo

echo "=== UI fingerprints ==="
APP=$(curl -fsS 'http://127.0.0.1:4173/app.js?v=2.6.1')
printf '%s' "$APP" | grep -q 'STAR45 AI MEETING WORKSPACE'
printf '%s' "$APP" | grep -q '녹음 시작'
printf '%s' "$APP" | grep -q '회의결과 검토'
printf '%s' "$APP" | grep -q 'approveResult'
echo "MEETING-FIRST UI PASS"

echo "=== Run live browser E2E ==="
sh deploy/run-live-e2e-v261.sh

echo "=== FINAL STATUS ==="
echo "VERSION          PASS 2.6.1"
echo "SERVICES         PASS"
echo "UI BINDINGS      PASS"
echo "BROWSER E2E      PASS"
echo "LIVE REPAIR COMPLETE"
