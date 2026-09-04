import assert from 'node:assert/strict';
import {claimVoiceJob,completeVoiceJob,failVoiceJob,WORKER_PROTOCOL_VERSION} from './worker-protocol.mjs';

const jobs=[{voice_job_id:'job_1',status:'queued',provider:{provider_id:'cosyvoice_3'},source:{language:'ko-KR'},output:{format:'wav'}}];
const now=new Date('2026-08-24T00:00:00Z');
const claimed=claimVoiceJob(jobs,{worker_id:'STAR45-PC-GPU-01',providers:['cosyvoice_3'],languages:['ko-KR'],gpu_name:'RTX'},now);
assert.equal(WORKER_PROTOCOL_VERSION,1);
assert.equal(claimed.status,'processing');
assert.equal(claimed.worker_id,'STAR45-PC-GPU-01');
assert.equal(claimVoiceJob(jobs,{worker_id:'other',providers:['openvoice_v2'],languages:['ko-KR']},now),null);
const done=completeVoiceJob(claimed,{asset_id:'voice-output/job_1.wav',sha256:'abc',bytes:10},'STAR45-PC-GPU-01',now);
assert.equal(done.status,'completed');
assert.equal(done.output.bytes,10);

const retry={voice_job_id:'job_2',status:'processing',worker_id:'pc',attempts:1};
assert.equal(failVoiceJob(retry,'temporary','pc',now).status,'queued');
const terminal={voice_job_id:'job_3',status:'processing',worker_id:'pc',attempts:3};
assert.equal(failVoiceJob(terminal,'bad model','pc',now).status,'failed');
console.log('VOICE GPU WORKER PROTOCOL PASS');
