import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const dir=await fs.mkdtemp(path.join(os.tmpdir(),'vf-dispatch-')),port=45261,base='http://127.0.0.1:'+port;
const users=[{id:'usr_host',name:'Host',status:'active'},{id:'usr_kim',name:'김대리',status:'active'},{id:'usr_lee',name:'이과장',status:'active'}];
const sessions=[{id:'ses_host',user_id:'usr_host',expires_at:new Date(Date.now()+60000).toISOString()}];
await Promise.all([fs.writeFile(path.join(dir,'users.json'),JSON.stringify(users)),fs.writeFile(path.join(dir,'sessions.json'),JSON.stringify(sessions)),fs.writeFile(path.join(dir,'tasks.json'),'[]')]);
const child=spawn(process.execPath,['services/task-calendar-service.mjs'],{env:{...process.env,TASK_PORT:String(port),TASK_DATA_DIR:dir},stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
  for(let i=0;i<40;i++){try{if((await fetch(base+'/health')).ok)break}catch{}await sleep(50)}
  const headers={'content-type':'application/json',cookie:'voiceflow_session=ses_host'};
  const interpreted=await fetch(base+'/api/v1/tasks/interpret',{method:'POST',headers,body:JSON.stringify({text:'김대리와 이과장이 내일 오후 3시 재고회의를 진행한다\n김대리가 금요일까지 가격표를 확인한다'})}).then(r=>r.json());
  assert.equal(interpreted.ok,true);assert.equal(interpreted.data.drafts.length,2);
  const schedule=interpreted.data.drafts[0];assert.equal(schedule.work_type,'schedule');assert.equal(schedule.visibility,'shared_company');assert.equal(schedule.assignees.length,2);assert.equal(schedule.ready,true);
  const task=interpreted.data.drafts[1];assert.equal(task.work_type,'task');assert.equal(task.visibility,'individual_company');
  const incomplete=await fetch(base+'/api/v1/tasks/batch',{method:'POST',headers,body:JSON.stringify({confirmed:true,tasks:[{title:'담당자 없음',work_type:'task',assignees:[]}]})});assert.equal(incomplete.status,400);
  const saved=await fetch(base+'/api/v1/tasks/batch',{method:'POST',headers,body:JSON.stringify({confirmed:true,tasks:interpreted.data.drafts})}).then(r=>r.json());assert.equal(saved.data.length,2);
  const source=await fs.readFile(new URL('./public/meeting-auto-dispatch-v361.js',import.meta.url),'utf8');new Function(source);assert.match(source,/validMeeting/);assert.match(source,/source_meeting_id/);assert.match(source,/required_fields_missing|missing_fields/);
  console.log('VoiceFlow meeting auto-distribution integration passed');
}finally{child.kill('SIGTERM');await sleep(80);await fs.rm(dir,{recursive:true,force:true})}
