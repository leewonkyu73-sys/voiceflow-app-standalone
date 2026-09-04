import fs from 'node:fs/promises';
import path from 'node:path';

const jobIdPattern=/^hrm_[a-z0-9_]+$/;

async function readJson(file){
  try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return null}
}

export async function overlayHermesJobState(job,{bridgeDir=process.env.HERMES_BRIDGE_DIR||''}={}){
  const jobId=String(job?.job_id||'');
  if(!bridgeDir||!jobIdPattern.test(jobId))return job;
  const base=path.resolve(bridgeDir);
  const resultRel=`results/${jobId}.result.json`;
  const result=await readJson(path.join(base,resultRel));
  if(result?.job_id===jobId&&['completed','failed'].includes(result.status)){
    return {
      ...job,
      status:result.status,
      started_at:result.started_at||null,
      finished_at:result.finished_at||null,
      transitions:Array.isArray(result.transitions)?result.transitions:[],
      worker_id:String(result.worker_id||''),
      worker_result:result.result||null,
      worker_error:result.status==='failed'?String(result.error||'worker_failed'):null,
      result_file:resultRel,
      obsidian_file:String(result.obsidian_file||''),
    };
  }
  try{
    await fs.access(path.join(base,'processing',`${jobId}.json`));
    return {...job,status:'processing'};
  }catch{return job}
}

export async function overlayHermesJobs(jobs,options={}){
  return Promise.all(jobs.map(job=>overlayHermesJobState(job,options)));
}
