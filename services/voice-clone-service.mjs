import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createVoiceProfile,approveVoiceProfile,createVoiceRenderJob,createSnsVoiceRequest} from '../modules/voice-clone/index.mjs';
import {claimVoiceJob,completeVoiceJob,failVoiceJob} from '../modules/voice-clone/worker-protocol.mjs';

const port=Number(process.env.VOICE_CLONE_PORT||4188);
const dataDir=process.env.VOICE_CLONE_DATA_DIR||'/data/voice-clone';
const token=process.env.VOICE_CLONE_SERVICE_TOKEN||'';
const workerToken=process.env.VOICE_GPU_WORKER_TOKEN||'';
const pcGpuEnabled=process.env.VOICE_PC_GPU_ENABLED==='true';
const profilesFile=path.join(dataDir,'profiles.json');
const jobsFile=path.join(dataDir,'jobs.json');
const outputsDir=path.join(dataDir,'outputs');
const maxOutputBytes=Math.max(1024*1024,Number(process.env.VOICE_MAX_OUTPUT_BYTES||100*1024*1024));
let jobWrite=Promise.resolve();

async function read(file){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return[];throw e}}
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temp=`${file}.tmp`;await fs.writeFile(temp,JSON.stringify(value,null,2));await fs.rename(temp,file)}
function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);if(!chunks.length)return{};return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
async function binaryBody(req){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>maxOutputBytes)throw new Error('voice_output_too_large');chunks.push(c)}return Buffer.concat(chunks)}
function actor(req){return{actor_id:req.headers['x-actor-id']||'',permissions:String(req.headers['x-actor-permissions']||'').split(',').filter(Boolean)}}
function authenticated(req){return token&&req.headers.authorization===`Bearer ${token}`}
function workerAuthenticated(req){return workerToken&&req.headers.authorization===`Bearer ${workerToken}`}
function workerId(req){return String(req.headers['x-worker-id']||'')}
function mutateJobs(operation){const next=jobWrite.then(async()=>{const jobs=await read(jobsFile);const result=await operation(jobs);await write(jobsFile,jobs);return result});jobWrite=next.catch(()=>{});return next}

export async function handler(req,res){
  const url=new URL(req.url,'http://voice-clone.local');
  if(url.pathname==='/health')return json(res,200,{ok:true,service:'voice-clone',module:'F-VOICE-CLONE-001',pc_gpu_enabled:pcGpuEnabled});

  if(url.pathname.startsWith('/v1/workers/')){
    if(!workerAuthenticated(req))return json(res,401,{ok:false,error:'worker_unauthorized'});
    try{
      if(url.pathname==='/v1/workers/claim'&&req.method==='POST'){
        const request=await body(req);
        if(request.worker_id!==workerId(req))throw new Error('voice_worker_identity_mismatch');
        const job=await mutateJobs(jobs=>claimVoiceJob(jobs,request));
        return job?json(res,200,{ok:true,data:job}):(res.writeHead(204,{'cache-control':'no-store'}),res.end());
      }
      const output=url.pathname.match(/^\/v1\/workers\/jobs\/([^/]+)\/output$/);
      if(output&&req.method==='PUT'){
        const id=workerId(req);if(!id)throw new Error('voice_worker_id_required');
        const audio=await binaryBody(req);if(!audio.length)throw new Error('voice_worker_empty_output');
        const extension=String(req.headers['content-type']||'').includes('mpeg')?'mp3':'wav';
        const assetId=`voice-output/${output[1]}.${extension}`;
        const target=path.join(outputsDir,`${output[1]}.${extension}`);
        await fs.mkdir(outputsDir,{recursive:true});await fs.writeFile(target,audio);
        const result={asset_id:assetId,sha256:crypto.createHash('sha256').update(audio).digest('hex'),bytes:audio.length,content_type:req.headers['content-type']||'audio/wav'};
        const job=await mutateJobs(jobs=>completeVoiceJob(jobs.find(x=>x.voice_job_id===output[1]),result,id));
        return json(res,200,{ok:true,data:job});
      }
      const fail=url.pathname.match(/^\/v1\/workers\/jobs\/([^/]+)\/fail$/);
      if(fail&&req.method==='POST'){
        const id=workerId(req),input=await body(req);
        const job=await mutateJobs(jobs=>failVoiceJob(jobs.find(x=>x.voice_job_id===fail[1]),input.error,id));
        return json(res,200,{ok:true,data:job});
      }
      return json(res,404,{ok:false,error:'worker_route_not_found'});
    }catch(e){return json(res,400,{ok:false,error:e.message})}
  }

  if(!authenticated(req))return json(res,401,{ok:false,error:'unauthorized'});
  try{
    if(url.pathname==='/v1/profiles'&&req.method==='GET'){
      const org=url.searchParams.get('organization_id');const rows=(await read(profilesFile)).filter(x=>!org||x.organization_id===org);
      return json(res,200,{ok:true,data:rows.map(({reference_asset_id,consent,...safe})=>({...safe,consent:{scope:consent.scope,expires_at:consent.expires_at}}))});
    }
    if(url.pathname==='/v1/profiles'&&req.method==='POST'){
      const profile=createVoiceProfile(await body(req),actor(req));const rows=await read(profilesFile);rows.push(profile);await write(profilesFile,rows);
      return json(res,201,{ok:true,data:profile});
    }
    const approve=url.pathname.match(/^\/v1\/profiles\/([^/]+)\/approve$/);
    if(approve&&req.method==='POST'){
      const rows=await read(profilesFile),i=rows.findIndex(x=>x.voice_profile_id===approve[1]);if(i<0)return json(res,404,{ok:false,error:'profile_not_found'});
      rows[i]=approveVoiceProfile(rows[i],(await body(req)).quality,actor(req));await write(profilesFile,rows);return json(res,200,{ok:true,data:rows[i]});
    }
    if(url.pathname==='/v1/jobs'&&req.method==='POST'){
      const input=await body(req),profile=(await read(profilesFile)).find(x=>x.voice_profile_id===input.voice_profile_id);if(!profile)return json(res,404,{ok:false,error:'profile_not_found'});
      const job=createVoiceRenderJob(profile,input,actor(req),{gpu_available:pcGpuEnabled});const jobs=await read(jobsFile);jobs.push(job);await write(jobsFile,jobs);return json(res,202,{ok:true,data:job});
    }
    const sns=url.pathname.match(/^\/v1\/sns\/content\/([^/]+)\/voice$/);
    if(sns&&req.method==='POST'){
      const raw=await body(req),input=createSnsVoiceRequest({...raw,content_id:sns[1]});const profile=(await read(profilesFile)).find(x=>x.voice_profile_id===input.voice_profile_id);
      if(!profile)return json(res,404,{ok:false,error:'profile_not_found'});const job=createVoiceRenderJob(profile,input,actor(req),{gpu_available:pcGpuEnabled});const jobs=await read(jobsFile);jobs.push(job);await write(jobsFile,jobs);
      return json(res,202,{ok:true,data:job});
    }
    const jobMatch=url.pathname.match(/^\/v1\/jobs\/([^/]+)$/);
    if(jobMatch&&req.method==='GET'){const job=(await read(jobsFile)).find(x=>x.voice_job_id===jobMatch[1]);return job?json(res,200,{ok:true,data:job}):json(res,404,{ok:false,error:'job_not_found'})}
    return json(res,404,{ok:false,error:'not_found'});
  }catch(e){return json(res,400,{ok:false,error:e.message})}
}

if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  if(process.env.NODE_ENV==='production'&&(!token||!workerToken))throw new Error('VOICE_CLONE_AND_WORKER_TOKENS_REQUIRED');
  http.createServer((req,res)=>handler(req,res)).listen(port,'0.0.0.0',()=>console.log(`voice-clone service listening on ${port}`));
}
