import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const apiBase=(process.env.VOICE_WORKER_API_URL||'').replace(/\/$/,'');
const token=process.env.VOICE_WORKER_TOKEN||'';
const workerId=process.env.VOICE_WORKER_ID||os.hostname();
const providers=(process.env.VOICE_WORKER_PROVIDERS||'cosyvoice_3').split(',').map(x=>x.trim()).filter(Boolean);
const languages=(process.env.VOICE_WORKER_LANGUAGES||'ko-KR').split(',').map(x=>x.trim()).filter(Boolean);
const python=process.env.VOICE_WORKER_PYTHON||'python';
const renderScript=process.env.VOICE_WORKER_RENDER_SCRIPT||'';
const pollMs=Math.max(2000,Number(process.env.VOICE_WORKER_POLL_MS||5000));
const gpuName=process.env.VOICE_WORKER_GPU_NAME||'PC GPU';
let stopping=false;

if(!apiBase||!token||!renderScript)throw new Error('VOICE_WORKER_API_URL, VOICE_WORKER_TOKEN, VOICE_WORKER_RENDER_SCRIPT are required');

async function api(url,options={}){
  const response=await fetch(`${apiBase}${url}`,{...options,headers:{authorization:`Bearer ${token}`,'x-worker-id':workerId,...options.headers}});
  if(response.status===204)return null;
  if(!response.ok)throw new Error(`worker_api_${response.status}_${await response.text()}`);
  const type=response.headers.get('content-type')||'';
  return type.includes('json')?response.json():response.arrayBuffer();
}
function run(command,args){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:'inherit',windowsHide:true});
    child.once('error',reject);
    child.once('exit',code=>code===0?resolve():reject(new Error(`voice_render_exit_${code}`)));
  });
}
async function processJob(job){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'star45-voice-'));
  const inputFile=path.join(dir,'job.json');
  const outputFile=path.join(dir,`output.${job.output?.format||'wav'}`);
  try{
    await fs.writeFile(inputFile,JSON.stringify(job,null,2));
    await run(python,[renderScript,'--job',inputFile,'--output',outputFile]);
    const audio=await fs.readFile(outputFile);
    await api(`/v1/workers/jobs/${job.voice_job_id}/output`,{method:'PUT',headers:{'content-type':job.output?.format==='mp3'?'audio/mpeg':'audio/wav'},body:audio});
    console.log(`[voice-worker] completed ${job.voice_job_id}`);
  }catch(error){
    console.error(`[voice-worker] failed ${job.voice_job_id}`,error.message);
    await api(`/v1/workers/jobs/${job.voice_job_id}/fail`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({error:error.message})}).catch(()=>{});
  }finally{
    await fs.rm(dir,{recursive:true,force:true});
  }
}
async function loop(){
  console.log(`[voice-worker] ${workerId} connected to ${apiBase}; providers=${providers.join(',')}`);
  while(!stopping){
    try{
      const response=await api('/v1/workers/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({worker_id:workerId,worker_name:workerId,gpu_name:gpuName,providers,languages,lease_seconds:900})});
      if(response?.data)await processJob(response.data);
      else await new Promise(r=>setTimeout(r,pollMs));
    }catch(error){
      console.error('[voice-worker] poll error',error.message);
      await new Promise(r=>setTimeout(r,Math.max(pollMs,10000)));
    }
  }
}
process.on('SIGINT',()=>{stopping=true});
process.on('SIGTERM',()=>{stopping=true});
await loop();
