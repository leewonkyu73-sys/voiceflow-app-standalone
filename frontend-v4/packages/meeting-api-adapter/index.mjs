const JSON_HEADERS=Object.freeze({'content-type':'application/json'});

export class MeetingApiError extends Error{
  constructor(code,{status=0,retryable=false,payload=null}={}){
    super(code);
    this.name='MeetingApiError';
    this.code=code;
    this.status=status;
    this.retryable=retryable;
    this.payload=payload;
  }
}

function assertMeetingIdValue(value){
  const id=String(value||'');
  if(!/^mtg_[A-Za-z0-9_]+$/.test(id))throw new MeetingApiError('invalid_meeting_id');
  return id;
}

async function decode(response){
  const status=Number(response?.status||0);
  let payload;
  try{payload=await response.json()}catch{throw new MeetingApiError('invalid_api_response',{status,retryable:status>=500})}
  if(!response.ok){
    const code=String(payload?.error||`meeting_api_http_${status}`);
    throw new MeetingApiError(code,{status,retryable:status===408||status===429||status>=500,payload});
  }
  return {payload,status};
}

export function createMeetingApiAdapter({transport}={}){
  if(typeof transport!=='function')throw new TypeError('meeting_api_transport_required');
  return Object.freeze({
    async postCaption(request={}){
      const id=assertMeetingIdValue(request.meeting_id);
      const {payload,status}=await decode(await transport(`/api/v1/meetings/${id}/captions`,{
        method:'POST',
        headers:JSON_HEADERS,
        body:JSON.stringify(request),
      }));
      return {
        data:payload.data,
        replayed:Boolean(payload.replayed),
        pending:status===202||Boolean(payload.data?.pending_translation),
      };
    },
    async listCaptions({meetingId,targetLanguage='ko-KR',since=0}={}){
      const id=assertMeetingIdValue(meetingId),query=new URLSearchParams({target:String(targetLanguage||'ko-KR'),since:String(Number(since)||0)});
      const {payload}=await decode(await transport(`/api/v1/meetings/${id}/captions?${query}`,{method:'GET'}));
      return Array.isArray(payload.data)?payload.data:[];
    },
  });
}
