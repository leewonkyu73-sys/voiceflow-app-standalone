import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {overlayHermesJobState,overlayHermesJobs} from './lib/hermes-job-state.mjs';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'hermes-state-test-'));
await fs.mkdir(path.join(root,'processing'),{recursive:true});
await fs.mkdir(path.join(root,'results'),{recursive:true});
const pending={job_id:'hrm_test_001',status:'pending',instruction:'redacted from result'};

assert.equal((await overlayHermesJobState(pending,{bridgeDir:root})).status,'pending');
await fs.writeFile(path.join(root,'processing','hrm_test_001.json'),'{}');
assert.equal((await overlayHermesJobState(pending,{bridgeDir:root})).status,'processing');
await fs.writeFile(path.join(root,'results','hrm_test_001.result.json'),JSON.stringify({
  job_id:'hrm_test_001',status:'completed',worker_id:'worker-test',started_at:'2026-08-28T00:00:00Z',finished_at:'2026-08-28T00:00:01Z',
  transitions:[{status:'pending'},{status:'processing'},{status:'completed'}],
  result:{handler:'skill-distribution-e2e-v1',acknowledged:true},
  obsidian_file:'System-Verification/Hermes Result hrm_test_001.md',
}));
const completed=await overlayHermesJobState(pending,{bridgeDir:root});
assert.equal(completed.status,'completed');
assert.equal(completed.worker_result.handler,'skill-distribution-e2e-v1');
assert.deepEqual(completed.transitions.map(x=>x.status),['pending','processing','completed']);
assert.equal(completed.result_file,'results/hrm_test_001.result.json');
assert.equal((await overlayHermesJobs([pending],{bridgeDir:root}))[0].status,'completed');

await fs.writeFile(path.join(root,'results','hrm_test_002.result.json'),JSON.stringify({job_id:'hrm_test_002',status:'failed',error:'checksum'}));
const failed=await overlayHermesJobState({job_id:'hrm_test_002',status:'pending'},{bridgeDir:root});
assert.equal(failed.status,'failed');
assert.equal(failed.worker_error,'checksum');

assert.equal((await overlayHermesJobState({job_id:'../escape',status:'pending'},{bridgeDir:root})).status,'pending');
await fs.rm(root,{recursive:true,force:true});
console.log('HERMES_JOB_STATE_PASS');
