import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {providerStatus,buildFallbackPlan,summarizeCaptions} from './lib/provider-router.mjs';
const status=providerStatus();
assert.ok(status.stt.some(x=>x.id==='browser'&&x.configured));
assert.ok(status.translation.some(x=>x.id==='prototype'&&x.configured));
const plan=buildFallbackPlan({providers:{stt:'openai',translation:'openai',validator:'openai'}});
assert.ok(plan.stt);
assert.ok(plan.translation);
assert.ok(plan.validator);
const report=summarizeCaptions([
 {text:'다음 주 월요일부터 배송을 시작하겠습니다.'},
 {text:'VAT는 포함되지 않은 것으로 확정합니다.'},
 {text:'이한에게 최종 가격표를 확인해서 보내주세요.'},
 {text:'납기 지연 위험이 있습니다.'}
]);
assert.equal(report.source_count,4);
assert.ok(report.decisions.length>=1);
assert.ok(report.actions.length>=1);
assert.ok(report.risks.length>=1);
const previousDataDir=process.env.INTEGRATION_DATA_DIR,previousCurrentKey=process.env.INTEGRATION_SECRET_KEY,previousLegacyKey=process.env.GOOGLE_DRIVE_TOKEN_SECRET;
const legacyDir=await fs.mkdtemp(path.join(os.tmpdir(),'voiceflow-legacy-secret-'));
try{
 process.env.INTEGRATION_DATA_DIR=legacyDir;
 process.env.INTEGRATION_SECRET_KEY='';
 process.env.GOOGLE_DRIVE_TOKEN_SECRET='legacy-key-for-regression';
 const writer=await import(`./lib/integration-secrets.mjs?legacy-write=${Date.now()}`);
 await writer.setIntegrationSecret('OPENAI_API_KEY','legacy-provider-secret');
 process.env.INTEGRATION_SECRET_KEY='current-key-for-regression';
 const reader=await import(`./lib/integration-secrets.mjs?legacy-read=${Date.now()}`);
 assert.equal(await reader.getIntegrationSecret('OPENAI_API_KEY'),'legacy-provider-secret');
}finally{
 if(previousDataDir===undefined)delete process.env.INTEGRATION_DATA_DIR;else process.env.INTEGRATION_DATA_DIR=previousDataDir;
 if(previousCurrentKey===undefined)delete process.env.INTEGRATION_SECRET_KEY;else process.env.INTEGRATION_SECRET_KEY=previousCurrentKey;
 if(previousLegacyKey===undefined)delete process.env.GOOGLE_DRIVE_TOKEN_SECRET;else process.env.GOOGLE_DRIVE_TOKEN_SECRET=previousLegacyKey;
 await fs.rm(legacyDir,{recursive:true,force:true});
}
console.log('Provider router and legacy integration secret tests passed');
