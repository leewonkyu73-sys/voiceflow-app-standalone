export const WORKER_PROTOCOL_VERSION=1;

export function claimVoiceJob(jobs,request,now=new Date()){
  if(!request?.worker_id)throw new Error('voice_worker_id_required');
  const providers=new Set(request.providers||[]);
  const languages=new Set(request.languages||[]);
  const nowMs=now.getTime();
  const job=jobs.find(item=>{
    const expired=item.status==='processing'&&Date.parse(item.lease_expires_at||0)<=nowMs;
    const available=item.status==='queued'||expired;
    return available&&providers.has(item.provider?.provider_id)&&languages.has(item.source?.language);
  });
  if(!job)return null;
  job.status='processing';
  job.worker_id=request.worker_id;
  job.worker_name=request.worker_name||request.worker_id;
  job.worker_capabilities={gpu_name:request.gpu_name||null,providers:[...providers],languages:[...languages]};
  job.claimed_at=now.toISOString();
  job.lease_expires_at=new Date(nowMs+Math.max(60,Number(request.lease_seconds||300))*1000).toISOString();
  job.attempts=(job.attempts||0)+1;
  return job;
}

export function completeVoiceJob(job,result,workerId,now=new Date()){
  if(!job)throw new Error('voice_job_not_found');
  if(job.status!=='processing'||job.worker_id!==workerId)throw new Error('voice_worker_job_not_owned');
  if(!result?.asset_id||!result?.sha256||!result?.bytes)throw new Error('voice_worker_result_invalid');
  job.status='completed';
  job.output={...job.output,asset_id:result.asset_id,sha256:result.sha256,bytes:result.bytes,content_type:result.content_type||'audio/wav',duration_seconds:result.duration_seconds??null};
  job.completed_at=now.toISOString();
  delete job.lease_expires_at;
  return job;
}

export function failVoiceJob(job,error,workerId,now=new Date()){
  if(!job)throw new Error('voice_job_not_found');
  if(job.status!=='processing'||job.worker_id!==workerId)throw new Error('voice_worker_job_not_owned');
  job.last_error=String(error||'voice_worker_failed').slice(0,1000);
  job.failed_at=now.toISOString();
  job.status=(job.attempts||0)>=3?'failed':'queued';
  delete job.lease_expires_at;
  delete job.worker_id;
  return job;
}
