import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'vf-invite-qr-'));
const expiresAt=new Date(Date.now()+86400000).toISOString();
await fs.writeFile(path.join(dir,'users.json'),JSON.stringify([{id:'usr_qr',name:'QR Host',email:'qr@example.com',role:'admin',status:'active'}]));
await fs.writeFile(path.join(dir,'sessions.json'),JSON.stringify([{id:'ses_qr',user_id:'usr_qr',expires_at:expiresAt}]));
await fs.writeFile(path.join(dir,'meetings.json'),JSON.stringify([{id:'mtg_qr',title:'QR Test',status:'live',participants:[]}]));
const port=43184;
const child=spawn(process.execPath,['services/device-nearby-tapjoin-service.mjs'],{env:{...process.env,DEVICE_NEARBY_PORT:String(port),DEVICE_NEARBY_DATA_DIR:dir,MEETING_PUBLIC_BASE_URL:'http://127.0.0.1:'+port},stdio:['ignore','pipe','pipe']});
const base='http://127.0.0.1:'+port;
const wait=async()=>{for(let i=0;i<50;i++){try{const r=await fetch(base+'/health');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error('service_not_ready')};
try{
  await wait();
  const response=await fetch(base+'/api/v1/tapjoin/activate',{method:'POST',headers:{cookie:'voiceflow_session=ses_qr','content-type':'application/json'},body:JSON.stringify({meeting_id:'mtg_qr',title:'QR Test',ttl_minutes:120})});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ok,true);
  assert.equal(body.tap_url,base+'/tap.html?id=tap_usr_qr');
  assert.match(body.qr_url,/^data:image\/gif;base64,/);
  const gif=Buffer.from(body.qr_url.split(',')[1],'base64');
  assert.equal(gif.subarray(0,6).toString('ascii'),'GIF87a');
  assert.ok(gif.length>100,'QR image must contain encoded invite data');
  console.log('MEETING_INVITE_QR_TEST PASS');
}finally{
  child.kill('SIGTERM');
  await fs.rm(dir,{recursive:true,force:true});
}
