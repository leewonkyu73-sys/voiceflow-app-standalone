(()=>{
  const qs=(s,r=document)=>r.querySelector(s);
  const ensureFeedback=card=>{
    let el=qs('.action-feedback',card);
    if(!el){
      el=document.createElement('div');
      el.className='action-feedback';
      el.style.cssText='margin-top:12px;padding:10px 12px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;line-height:1.5;display:none';
      card.appendChild(el);
    }
    return el;
  };
  const feedback=(card,message,type='info')=>{
    const el=ensureFeedback(card);
    const styles={info:['#f8fafc','#475569','#e2e8f0'],busy:['#eff6ff','#1d4ed8','#bfdbfe'],ok:['#ecfdf5','#047857','#a7f3d0'],bad:['#fef2f2','#b91c1c','#fecaca']};
    const [bg,fg,border]=styles[type]||styles.info;
    el.style.display='block';el.style.background=bg;el.style.color=fg;el.style.borderColor=border;el.textContent=message;
  };
  const request=async(url,opt={})=>{
    const r=await fetch(url,{credentials:'same-origin',headers:{'content-type':'application/json',...(opt.headers||{})},...opt});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(d.error||d.message||`HTTP ${r.status}`);e.status=r.status;e.data=d;throw e}
    return d;
  };
  const explain=e=>{
    const m=String(e.message||'');
    if(e.status===401||e.status===403||m==='admin_required')return '관리자 로그인이 필요합니다. 회의 화면에서 관리자 계정으로 로그인한 뒤 다시 시도하세요.';
    if(m==='api_key_missing')return 'API Key가 저장되어 있지 않습니다. API Key를 입력하고 먼저 “API 등록 / 저장”을 누르세요.';
    if(/http_401|http_403|invalid.*key|unauthorized|authentication/i.test(m))return 'API 인증에 실패했습니다. 입력한 API Key와 해당 서비스의 사용 권한을 확인하세요.';
    if(/http_429|quota|credit|billing|rate.?limit/i.test(m))return 'API 사용 한도 또는 크레딧 문제입니다. Provider의 Billing/Usage에서 잔여 크레딧과 사용 한도를 확인한 뒤 다시 테스트하세요.';
    if(/http_404|model.*not.*found|model.*unavailable|not available|does not exist/i.test(m))return '선택한 모델을 현재 프로젝트에서 사용할 수 없습니다. 모델 목록에서 최신 권장 모델을 선택해 저장한 뒤 다시 테스트하세요.';
    if(/http_400|invalid.*model|unsupported/i.test(m))return '모델명 또는 요청 형식이 현재 Provider와 맞지 않습니다. 권장 모델로 바꿔 저장한 뒤 다시 테스트하세요.';
    if(/fetch|network|timeout|timed out/i.test(m))return '서버 또는 외부 API 연결에 실패했습니다. 네트워크와 서버 연결 상태를 확인한 뒤 다시 시도하세요.';
    return `오류: ${m}`;
  };
  const collect=card=>{
    const payload={};
    card.querySelectorAll('[data-field]').forEach(i=>{
      const v=String(i.value||'').trim();
      if(i.type==='password'){if(v)payload[i.dataset.field]=v}
      else payload[i.dataset.field]=v;
    });
    return payload;
  };
  const refreshCardStatus=(card,data)=>{
    const badge=qs('.status',card);
    if(badge&&data){badge.textContent=data.configured?'● 연결됨':'○ 연결 필요';badge.className='status '+(data.configured?'ok':'warn')}
    if(data?.secret_status){
      const p=card.querySelector('p.secret-note');
      if(p)p.textContent=Object.entries(data.secret_status).map(([k,v])=>`${k.replace(/_/g,' ')}: ${v?'저장됨':'미설정'}`).join(' · ');
    }
  };
  async function save(card,id,btn){
    const old=btn.textContent;btn.disabled=true;btn.textContent='저장 중…';feedback(card,'API 설정을 서버에 저장하고 있습니다.','busy');
    try{
      const d=await request(`/api/v1/admin/integrations/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(collect(card))});
      card.querySelectorAll('input[type=password][data-field]').forEach(i=>i.value='');
      refreshCardStatus(card,d.data);feedback(card,'✓ 저장 완료. 이제 “연결 테스트”를 눌러 실제 선택 모델의 응답까지 확인하세요.','ok');
    }catch(e){feedback(card,'✕ 저장 실패 · '+explain(e),'bad')}
    finally{btn.disabled=false;btn.textContent=old}
  }
  async function test(card,id,btn){
    const old=btn.textContent;btn.disabled=true;btn.textContent='테스트 중…';feedback(card,'선택한 모델에 짧은 실제 요청을 보내 인증·모델 사용 가능 여부·응답을 확인하고 있습니다.','busy');
    try{
      const d=await request(`/api/v1/admin/integrations/${encodeURIComponent(id)}?action=test`,{method:'POST',body:'{}'});
      feedback(card,'✓ 연결 테스트 성공 · '+(d.data?.message||'Provider가 실제 요청에 정상 응답했습니다.'),'ok');
      const badge=qs('.status',card);if(badge){badge.textContent='● 연결됨';badge.className='status ok'}
    }catch(e){feedback(card,'✕ 연결 테스트 실패 · '+explain(e),'bad')}
    finally{btn.disabled=false;btn.textContent=old}
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest('button[data-save],button[data-test]');if(!btn)return;
    const card=btn.closest('[data-id]');if(!card)return;
    e.preventDefault();e.stopImmediatePropagation();
    const id=card.dataset.id;
    if(btn.dataset.save)save(card,id,btn);else if(btn.dataset.test)test(card,id,btn);
  },true);

  async function testHubDirect(btn){
    const old=btn.textContent;btn.disabled=true;btn.textContent='테스트 중…';
    const msg=qs('#hubMessage');if(msg)msg.textContent='Integration Hub에 실제 연결 중입니다…';
    try{
      const d=await request('/api/v1/admin/integration-hub/test',{method:'POST',body:'{}'});
      const s=await request('/api/v1/admin/integration-hub/status');
      const hub=s.data||{};
      const badge=qs('#hubStatus');
      if(badge){badge.textContent='● 연결됨';badge.className='status ok'}
      if(msg)msg.textContent='연결 테스트 성공 · Hub URL과 Access Token이 정상이며 중앙 연동을 사용할 수 있습니다.';
      if(typeof window.log==='function')window.log({message:'Integration Hub 연결 테스트 성공',result:d.data,status:hub});
    }catch(e){
      const badge=qs('#hubStatus');if(badge){badge.textContent='● 연결 오류';badge.className='status bad'}
      if(msg)msg.textContent='Hub 연결 테스트 실패 · '+explain(e);
    }finally{btn.disabled=false;btn.textContent=old}
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest('#testHub');if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    testHubDirect(btn);
  },true);

  request('/api/v1/auth/me').then(d=>{
    if(!d.user||d.user.role!=='admin'){
      const top=qs('.top');if(!top)return;
      const n=document.createElement('section');n.className='card';n.style.cssText='border-color:#fdba74;background:#fff7ed;margin-top:16px';n.innerHTML='<b style="color:#9a3412">관리자 로그인 확인 필요</b><p class="muted" style="margin:6px 0 0">API 등록과 실제 모델 연결 테스트는 관리자 계정에서만 가능합니다. 현재 관리자 세션이 아니면 저장 버튼을 눌렀을 때 권한 오류가 표시됩니다.</p>';
      top.insertAdjacentElement('afterend',n);
    }
  }).catch(()=>{});
  const navRow=qs('.top .row');
  if(navRow&&!qs('#functionRoutingLink')){
    const route=document.createElement('a');route.id='functionRoutingLink';route.className='btn secondary';route.href='/function-ai-routing.html';route.textContent='기능별 AI 엔진';navRow.prepend(route);
    const tts=document.createElement('a');tts.id='ttsToolLink';tts.className='btn secondary';tts.href='/text-to-speech.html';tts.textContent='텍스트 읽어주기';navRow.prepend(tts);
  }
  const focusRequestedProvider=()=>{
    const provider=new URL(location.href).searchParams.get('provider');
    if(!provider)return;
    const card=document.querySelector(`[data-id="${CSS.escape(provider)}"]`);
    if(card){
      card.style.boxShadow='0 0 0 3px rgba(37,99,235,.22)';
      card.style.borderColor='#2563eb';
      card.scrollIntoView({behavior:'smooth',block:'center'});
      const input=card.querySelector('input[type=password],input,select');
      setTimeout(()=>input?.focus(),500);
      setTimeout(()=>{card.style.boxShadow='';card.style.borderColor=''},5000);
      return;
    }
    let n=qs('#missingProviderNotice');
    if(!n){n=document.createElement('section');n.id='missingProviderNotice';n.className='card';n.style.cssText='border-color:#fdba74;background:#fff7ed;margin-top:16px';qs('.top')?.insertAdjacentElement('afterend',n)}
    const names={google_speech:'Google Speech',elevenlabs:'ElevenLabs',azure_speech:'Azure Speech',google_vision:'Google Vision'};
    n.innerHTML=`<b style="color:#9a3412">${names[provider]||provider} API 등록 카드 준비 필요</b><p class="muted" style="margin:6px 0 0">기능별 AI 엔진에서 이 Provider를 선택할 수 있도록 예약되어 있지만, 현재 API 등록 카드는 아직 추가되지 않았습니다.</p>`;
    n.scrollIntoView({behavior:'smooth',block:'start'});
  };
  const providerTimer=setInterval(()=>{if(qs('#cards')?.children.length){clearInterval(providerTimer);focusRequestedProvider()}},200);
  setTimeout(()=>{clearInterval(providerTimer);focusRequestedProvider()},2500);
  const modelScript=document.createElement('script');
  modelScript.src='/admin-integrations-models.js?v=2.7.4';
  modelScript.defer=true;
  document.head.appendChild(modelScript);
})();