#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace
fail(){ echo "BUILD FAIL: $1"; exit 1; }
BACK=/tmp/voiceflow-build-backup-$$
mkdir -p "$BACK"
cp public/app.js "$BACK/app.js"; cp public/style.css "$BACK/style.css"; cp public/audio-monitor.js "$BACK/audio-monitor.js"; cp public/caption-language.js "$BACK/caption-language.js"; cp services/integration-hub-bridge-service.mjs "$BACK/integration-hub-bridge-service.mjs"
restore(){ cp "$BACK/app.js" public/app.js 2>/dev/null||true; cp "$BACK/style.css" public/style.css 2>/dev/null||true; cp "$BACK/audio-monitor.js" public/audio-monitor.js 2>/dev/null||true; cp "$BACK/caption-language.js" public/caption-language.js 2>/dev/null||true; cp "$BACK/integration-hub-bridge-service.mjs" services/integration-hub-bridge-service.mjs 2>/dev/null||true; rm -rf "$BACK" 2>/dev/null||true; }
trap restore EXIT INT TERM

echo "[BUILD 1/4] source and isolated tests"
for f in server-v2.mjs services/device-nearby-tapjoin-service.mjs services/admin-integration-service.mjs services/original-media-storage-service.mjs services/identity-organization-service.mjs deploy/gateway.mjs public/device-nearby-bridge.js public/tap.js public/tap-settings.js scripts/patch-admin-drive-v262.mjs scripts/patch-solo-overlay-v264.mjs scripts/patch-mobile-launcher-v265.mjs scripts/patch-mobile-media-stability-v266.mjs scripts/patch-device-hub-catalog-v264.mjs scripts/patch-identity-org-audio-v268.mjs scripts/patch-design-system-v270.mjs scripts/audit-ui-controls-design-v270.mjs scripts/patch-runtime-guards-v262.mjs; do node --check "$f"; done
npm test

echo "[BUILD 2/4] create exact frontend and Hub artifact"
node scripts/patch-admin-drive-v262.mjs
node scripts/patch-solo-overlay-v264.mjs
node scripts/patch-mobile-launcher-v265.mjs
node scripts/patch-mobile-media-stability-v266.mjs
node scripts/patch-device-hub-catalog-v264.mjs
node scripts/patch-identity-org-audio-v268.mjs
node scripts/patch-design-system-v270.mjs
node scripts/patch-runtime-guards-v262.mjs
node --check public/app.js; node --check public/audio-monitor.js; node --check public/caption-language.js; node --check services/integration-hub-bridge-service.mjs
node scripts/verify-ui-bindings-v261.mjs
node scripts/audit-ui-controls-design-v270.mjs
grep -q "2.6.2-r3" public/app.js || fail 'runtime guard r3 missing'
grep -q "stable-v266" public/app.js || fail 'mobile stability marker missing'
grep -q "drive-v267" public/app.js || fail 'original media marker missing'
grep -q "coreon-v270" public/app.js || fail 'COREON design system marker missing'
grep -q '음성메모' public/app.js || fail 'solo voice memo missing'
grep -q '음성회의' public/app.js || fail 'solo voice meeting missing'
grep -q '영상회의' public/app.js || fail 'solo video meeting missing'
grep -q 'bottom-nav.cols-6' public/style.css || fail 'mobile six-item nav missing'
grep -q 'safe-area-inset-bottom' public/style.css || fail 'mobile safe area missing'
grep -q 'width:220px' public/style.css || fail 'desktop sidebar missing'
grep -q 'width:76px' public/style.css || fail 'medium icon rail missing'
grep -q '사람별 음성 입력' public/app.js || fail 'participant audio level UI missing'
grep -q 'audio-level' public/app.js || fail 'participant audio level signal missing'
grep -q 'joinOrgCode' public/app.js || fail 'organization code signup missing'
grep -q 'joinCompany' public/app.js || fail 'company signup missing'
grep -q 'morePageV268' public/app.js || fail 'more nav missing'
grep -q 'device_tapjoin' public/admin-integrations.js || fail 'admin device connector missing'
grep -q 'device_tapjoin' services/integration-hub-bridge-service.mjs || fail 'Hub device connector catalog missing'

echo "[BUILD 3/4] build production image once"
docker build --no-cache --pull -f deploy/Dockerfile.v2 -t voiceflow-smart-workspace:v2.6 .

echo "[BUILD 4/4] verify image artifact"
docker run --rm --entrypoint node voiceflow-smart-workspace:v2.6 -e "const fs=require('fs');const a=fs.readFileSync('/app/public/app.js','utf8');const c=fs.readFileSync('/app/public/style.css','utf8');const g=fs.readFileSync('/app/deploy/gateway.mjs','utf8');const i=fs.readFileSync('/app/services/identity-organization-service.mjs','utf8');if(!a.includes('stable-v266')||!a.includes('drive-v267')||!a.includes('coreon-v270'))process.exit(1);if(!a.includes('사람별 음성 입력')||!a.includes('audio-level'))process.exit(2);if(!c.includes('bottom-nav.cols-6')||!c.includes('safe-area-inset-bottom'))process.exit(3);if(!c.includes('width:220px')||!c.includes('width:76px'))process.exit(4);if(!a.includes('joinOrgCode')||!a.includes('joinCompany')||!a.includes('morePageV268'))process.exit(5);if(!g.includes('IDENTITY_ORG_PORT')||!i.includes('H-IDENTITY-ORG-01'))process.exit(6);console.log('IMAGE COREON + ALL BUTTON AUDIT + IDENTITY-ORG PASS')" || fail 'built image verification failed'
echo "VALIDATED IMAGE BUILD PASS"
