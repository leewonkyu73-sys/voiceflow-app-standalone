import assert from 'node:assert/strict';
import {CAPTION_STATUS} from '../packages/meeting-contracts/index.mjs';
import {createMobileCaptionSession} from '../packages/mobile-caption-session/index.mjs';

function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
  return {promise,resolve,reject};
}

{
  const pendingResponse=deferred(),calls=[],snapshots=[];
  const api={
    postCaption:request=>{
      calls.push(request);
      return pendingResponse.promise;
    },
    listCaptions:async()=>[],
  };
  const session=createMobileCaptionSession({
    meetingId:'mtg_mobile_1',
    api,
    createClientId:()=> 'mobile-client-1',
  });
  session.subscribe(snapshot=>snapshots.push(snapshot));

  const submitting=session.submit('휴대폰 원문은 즉시 보여야 합니다');
  const pending=snapshots.at(-1);
  assert.equal(pending.items[0].status,CAPTION_STATUS.PENDING);
  assert.equal(pending.items[0].text,'휴대폰 원문은 즉시 보여야 합니다');
  assert.equal(pending.draft,'휴대폰 원문은 즉시 보여야 합니다');
  assert.equal(calls[0].client_id,'mobile-client-1');

  pendingResponse.resolve({
    data:{
      id:'cap_mobile_1',
      meeting_id:'mtg_mobile_1',
      client_id:'mobile-client-1',
      text:'휴대폰 원문은 즉시 보여야 합니다',
      translations:{'vi-VN':'Bản gốc trên điện thoại phải hiển thị ngay.'},
      created_at:100,
    },
  });
  await submitting;
  const committed=session.getSnapshot();
  assert.equal(committed.items[0].status,CAPTION_STATUS.COMMITTED);
  assert.equal(committed.items[0].translations['vi-VN'],'Bản gốc trên điện thoại phải hiển thị ngay.');
  assert.equal(committed.draft,'','draft clears only after the API commit');
}

{
  const calls=[];
  const api={
    postCaption:async request=>{
      calls.push(request);
      if(calls.length===1)throw new Error('network');
      return {
        data:{
          id:'cap_mobile_retry',
          meeting_id:'mtg_mobile_retry',
          client_id:request.client_id,
          text:request.text,
          translations:{},
          created_at:200,
        },
      };
    },
    listCaptions:async()=>[
      {
        id:'cap_mobile_retry',
        meeting_id:'mtg_mobile_retry',
        client_id:'mobile-client-retry',
        text:'실패해도 원문을 보존합니다',
        translations:{},
        created_at:200,
      },
      {
        id:'cap_mobile_server',
        meeting_id:'mtg_mobile_retry',
        client_id:'mobile-client-server',
        text:'재접속 문장',
        translations:{},
        created_at:300,
      },
    ],
  };
  const session=createMobileCaptionSession({
    meetingId:'mtg_mobile_retry',
    api,
    createClientId:()=> 'mobile-client-retry',
  });
  await assert.rejects(session.submit('실패해도 원문을 보존합니다'),/network/);
  const failed=session.getSnapshot();
  assert.equal(failed.items[0].status,CAPTION_STATUS.FAILED);
  assert.equal(failed.draft,'실패해도 원문을 보존합니다');

  await session.retry('mobile-client-retry');
  assert.equal(calls[1].client_id,'mobile-client-retry','retry must reuse the idempotency key');
  assert.equal(session.getSnapshot().items[0].status,CAPTION_STATUS.COMMITTED);

  await session.reconnect();
  assert.deepEqual(
    session.getSnapshot().items.map(item=>item.id),
    ['cap_mobile_retry','cap_mobile_server'],
    'reconnect must merge without duplicating the retried caption',
  );
}

console.log('VOICEFLOW_V4_PHASE2_MOBILE_CAPTION_SESSION_PASS');
