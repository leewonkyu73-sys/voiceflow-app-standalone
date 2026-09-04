import assert from 'node:assert/strict';
import {createMeetingApiAdapter,MeetingApiError} from '../packages/meeting-api-adapter/index.mjs';

const calls=[];
const caption={
  id:'cap_server_1',
  meeting_id:'mtg_contract_1',
  client_id:'client-1',
  text:'원문은 즉시 보존합니다',
  translations:{'vi-VN':'Bản gốc được giữ lại ngay lập tức.'},
  pending_translation:false,
};
const responses=[
  new Response(JSON.stringify({ok:true,data:caption}),{status:201,headers:{'content-type':'application/json'}}),
  new Response(JSON.stringify({ok:true,data:[caption]}),{status:200,headers:{'content-type':'application/json'}}),
  new Response(JSON.stringify({ok:false,error:'caption_idempotency_conflict'}),{status:409,headers:{'content-type':'application/json'}}),
];
const adapter=createMeetingApiAdapter({
  transport:async(url,options)=>{
    calls.push({url,options});
    return responses.shift();
  },
});

const request={
  meeting_id:'mtg_contract_1',
  client_id:'client-1',
  text:caption.text,
  language:'ko-KR',
  detected_language:'ko-KR',
  target_language:'vi-VN',
  input_mode:'manual',
  final:true,
};
const posted=await adapter.postCaption(request);
assert.deepEqual(posted,{data:caption,replayed:false,pending:false});
assert.equal(calls[0].url,'/api/v1/meetings/mtg_contract_1/captions');
assert.equal(calls[0].options.method,'POST');
assert.equal(JSON.parse(calls[0].options.body).client_id,'client-1');

const listed=await adapter.listCaptions({meetingId:'mtg_contract_1',targetLanguage:'vi-VN',since:123});
assert.deepEqual(listed,[caption]);
assert.equal(calls[1].url,'/api/v1/meetings/mtg_contract_1/captions?target=vi-VN&since=123');

await assert.rejects(
  adapter.postCaption({...request,text:'다른 원문'}),
  error=>error instanceof MeetingApiError&&error.code==='caption_idempotency_conflict'&&error.status===409&&error.retryable===false,
);

console.log('VOICEFLOW_V4_PHASE15_API_ADAPTER_PASS');
