(()=>{
  const langInfo={
    'ko-KR':{code:'ko-KR',label:'한국어'},'vi-VN':{code:'vi-VN',label:'Tiếng Việt'},'en-US':{code:'en-US',label:'English'},'zh-CN':{code:'zh-CN',label:'中文'},'ja-JP':{code:'ja-JP',label:'日本語'}
  };
  const session={participants:new Map(),meetingId:null};
  function detect(text=''){
    const s=String(text).trim();
    if(/[가-힣]/.test(s))return 'ko-KR';
    if(/[\u4e00-\u9fff]/.test(s))return 'zh-CN';
    if(/[ぁ-んァ-ン]/.test(s))return 'ja-JP';
    if(/[ăâđêôơưĂÂĐÊÔƠƯ]|[àáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(s))return 'vi-VN';
    return 'en-US';
  }
  function otherLanguage(source){
    const ui=localStorage.language||({'ko':'ko-KR','vi':'vi-VN','en':'en-US','zh':'zh-CN'}[localStorage.uiLanguage]||'ko-KR');
    const langs=[...new Set([...session.participants.values()].filter(Boolean))];
    const participantTarget=langs.find(x=>x!==source&&x===ui)||langs.find(x=>x!==source);
    if(participantTarget)return participantTarget;
    if(ui!==source)return ui;
    return {'ko-KR':'vi-VN','vi-VN':'ko-KR','en-US':'ko-KR','zh-CN':'ko-KR','ja-JP':'ko-KR'}[source]||'en-US';
  }
  const normalize=s=>String(s||'').trim().replace(/\s+/g,' ').replace(/[.!?。！？]+$/,'').toLowerCase();
  const nums=s=>String(s||'').match(/\d+(?:[.,]\d+)*/g)||[];
  function localValidate(original,translated,source,target,base={}){
    const issues=[...(base.issues||[])];
    const components={...(base.components||{})};
    let score=Number.isFinite(base.score)?base.score:100;
    const same=normalize(original)===normalize(translated);
    if(source!==target&&same){score=Math.min(score,35);issues.push('untranslated_text');components.semantic=25}
    const a=nums(original),b=nums(translated);const numberOk=a.every(x=>b.includes(x));
    components.number=numberOk?100:55;if(!numberOk){score=Math.min(score,65);issues.push('number_mismatch')}
    const critical=[/VAT/i,/MOQ/i,/USD|VND|KRW|원|동|달러/i,/포함되어 있지|포함되지|không bao gồm|chưa bao gồm|not included/i];
    const lostCritical=critical.some(re=>re.test(original)&&!re.test(translated));
    components.criticalTerms=lostCritical?45:100;if(lostCritical){score=Math.min(score,60);issues.push('critical_term_or_negation_loss')}
    if(source!==target&&translated&&detect(translated)===source&&same===false){score=Math.min(score,68);issues.push('target_language_mismatch')}
    score=Math.max(0,Math.round(score));
    const light=score>=90?'green':score>=70?'yellow':'red';
    return{...base,score,light,issues:[...new Set(issues)],components};
  }
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input?.url||'');
    let nextInit=init;
    if(/\/api\/v1\/meetings\/.+\/captions(?:\?|$)/.test(url)&&String(init.method||'GET').toUpperCase()==='POST'&&typeof init.body==='string'){
      try{const b=JSON.parse(init.body);if(b.text){b.language=detect(b.text);b.detected_language=b.language;nextInit={...init,body:JSON.stringify(b)}}}catch{}
    }
    const res=await originalFetch(input,nextInit);
    try{
      const clone=res.clone(),data=await clone.json();
      if(url.endsWith('/api/v1/meetings')&&String(nextInit.method||'GET').toUpperCase()==='POST'&&data?.data){session.meetingId=data.data.id;(data.data.participants||[]).forEach(p=>session.participants.set(p.peer_id,p.language))}
      if(/\/api\/v1\/meetings\/.+\/join$/.test(url)&&data?.data){session.meetingId=data.data.id;(data.data.participants||[]).forEach(p=>session.participants.set(p.peer_id,p.language))}
      if(/\/api\/v1\/meetings\/.+\/captions\?/.test(url)&&Array.isArray(data?.data)){
        data.data=data.data.map(c=>{
          const source=detect(c.text||'');const target=otherLanguage(source);
          const translated=c.translations?.[target]||c.translation||c.text;
          const serverValidation=c.assurance?.[target]||c.validation||{score:100,light:'green',issues:[]};
          const validation=localValidate(c.text||'',translated,source,target,serverValidation);
          return {...c,language:source,detected_language:source,display_source_language:source,display_target_language:target,translation:translated,validation};
        });
        return new Response(JSON.stringify(data),{status:res.status,statusText:res.statusText,headers:res.headers});
      }
    }catch{}
    return res;
  };
  function label(code){return langInfo[code]?.label||code||''}
  function issueText(validation){
    const issues=validation?.issues||[];
    if(issues.includes('untranslated_text'))return '번역 미처리';
    if(issues.includes('number_mismatch'))return '숫자/금액 확인';
    if(issues.includes('critical_term_or_negation_loss'))return '중요 용어·부정표현 확인';
    if(issues.includes('target_language_mismatch'))return '대상 언어 확인';
    return validation?.light==='green'?'검정 통과':validation?.light==='yellow'?'문맥 확인':'재확인 필요';
  }
  function decorate(){
    document.querySelectorAll('.caption').forEach(card=>{
      const ps=card.querySelectorAll('p');if(ps.length<2)return;
      const source=detect(ps[0].textContent||'');const target=otherLanguage(source);
      if(!card.querySelector('.source-lang')){const s=document.createElement('div');s.className='caption-lang-row source-lang';s.innerHTML=`<span>${label(source)} 원문</span><small>자동 감지</small>`;ps[0].before(s)}
      if(!card.querySelector('.target-lang')){const t=document.createElement('div');t.className='caption-lang-row target-lang';t.innerHTML=`<span>${label(target)} 번역</span><small>상대방 언어</small>`;ps[1].before(t)}
      const score=card.querySelector('.score');if(score&&!card.querySelector('.assurance-detail')){
        const light=score.classList.contains('red')?'red':score.classList.contains('yellow')?'yellow':'green';
        const detail=document.createElement('small');detail.className=`assurance-detail ${light}`;detail.textContent=light==='green'?'검정 통과':light==='yellow'?'문맥 확인 권장':'재확인 필요';score.after(detail);
      }
      card.dataset.langDecorated='1';
    });
  }
  new MutationObserver(decorate).observe(document.documentElement,{subtree:true,childList:true});
  setInterval(decorate,1000);
  window.VoiceFlowLanguage={detect,otherLanguage,label,localValidate,issueText,participants:session.participants};
})();