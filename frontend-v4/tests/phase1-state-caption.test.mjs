import assert from 'node:assert/strict';
import {
  CAPTION_STATUS,
  MEETING_PHASE,
  createCaptionRequest,
} from '../packages/meeting-contracts/index.mjs';
import {
  bindMeeting,
  createMeetingSession,
  transitionMeeting,
} from '../packages/meeting-state/index.mjs';
import {
  beginCaption,
  commitCaption,
  createCaptionStore,
  failCaption,
  mergeServerCaptions,
  setCaptionTranslation,
} from '../packages/caption-store/index.mjs';

{
  const idle=createMeetingSession();
  assert.equal(idle.phase,MEETING_PHASE.IDLE);
  assert.throws(()=>transitionMeeting(idle,MEETING_PHASE.LIVE),/invalid_meeting_transition/);

  const first=bindMeeting(idle,'mtg_first');
  assert.equal(first.phase,MEETING_PHASE.PREPARING);
  const ready=transitionMeeting(first,MEETING_PHASE.READY);
  const live=transitionMeeting(ready,MEETING_PHASE.LIVE);
  const ended=transitionMeeting(transitionMeeting(live,MEETING_PHASE.FINALIZING),MEETING_PHASE.ENDED);
  assert.throws(()=>bindMeeting(ended,'mtg_first'),/ended_meeting_cannot_reopen/);
  const second=bindMeeting(ended,'mtg_second');
  assert.equal(second.meetingId,'mtg_second');
  assert.equal(second.phase,MEETING_PHASE.PREPARING);
  assert.equal(second.generation,first.generation+1);
  assert.equal(second.error,null);
}

{
  const request=createCaptionRequest({
    meetingId:'mtg_first',
    clientId:'client_1',
    text:'원문은 사라지면 안 됩니다',
    sourceLanguage:'ko-KR',
    targetLanguage:'vi-VN',
    inputMode:'manual',
  });
  assert.equal(request.client_id,'client_1');
  assert.equal(request.text,'원문은 사라지면 안 됩니다');
  assert.equal(request.target_language,'vi-VN');

  const empty=createCaptionStore('mtg_first');
  const pending=beginCaption(empty,request);
  assert.equal(pending.items.length,1);
  assert.equal(pending.items[0].status,CAPTION_STATUS.PENDING);
  assert.equal(pending.draft,'원문은 사라지면 안 됩니다');
  assert.equal(empty.items.length,0,'caption updates must not mutate the previous store');
  assert.equal(beginCaption(pending,request),pending,'the same idempotent request must be a no-op');
  assert.throws(()=>beginCaption(pending,{...request,text:'같은 키의 다른 문장'}),/caption_idempotency_conflict/);

  const failed=failCaption(pending,'client_1','network');
  assert.equal(failed.items[0].status,CAPTION_STATUS.FAILED);
  assert.equal(failed.items[0].text,'원문은 사라지면 안 됩니다');
  assert.equal(failed.draft,'원문은 사라지면 안 됩니다','failed sends must preserve the draft');

  const committed=commitCaption(failed,'client_1',{
    id:'cap_server_1',
    meeting_id:'mtg_first',
    text:'원문은 사라지면 안 됩니다',
    translations:{'vi-VN':'Không được làm mất bản gốc'},
    created_at:100,
  });
  assert.equal(committed.items[0].status,CAPTION_STATUS.COMMITTED);
  assert.equal(committed.items[0].id,'cap_server_1');
  assert.equal(committed.items[0].text,'원문은 사라지면 안 됩니다');
  assert.equal(committed.draft,'','draft clears only after commit');

  const translationFailed=setCaptionTranslation(committed,'cap_server_1',{
    targetLanguage:'en-US',
    status:'failed',
    error:'provider_unavailable',
  });
  assert.equal(translationFailed.items[0].text,'원문은 사라지면 안 됩니다');
  assert.equal(translationFailed.items[0].translations['vi-VN'],'Không được làm mất bản gốc');
  assert.equal(translationFailed.items[0].translationState['en-US'].status,'failed');

  const reconnected=mergeServerCaptions(translationFailed,[
    {id:'cap_server_1',meeting_id:'mtg_first',client_id:'client_1',text:'원문은 사라지면 안 됩니다',translations:{'vi-VN':'Không được làm mất bản gốc'},created_at:100},
    {id:'cap_server_2',meeting_id:'mtg_first',client_id:'client_2',text:'두 번째 문장',translations:{},created_at:200},
    {id:'cap_other',meeting_id:'mtg_other',client_id:'client_3',text:'다른 회의',translations:{},created_at:300},
  ]);
  assert.equal(reconnected.items.length,2,'reconnect merge must deduplicate and reject other meetings');
  assert.deepEqual(reconnected.items.map(row=>row.id),['cap_server_1','cap_server_2']);
  assert.equal(reconnected.cursor,200);
}

console.log('VOICEFLOW_V4_PHASE1_STATE_CAPTION_PASS');
