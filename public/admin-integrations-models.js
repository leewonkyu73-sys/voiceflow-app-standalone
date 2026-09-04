(()=>{
  const modelOptions={
    OPENAI_TEXT_MODEL:{
      recommended:'gpt-5.6-sol',
      options:[
        ['gpt-5.6-sol','gpt-5.6-sol · 최고품질 추천 · 복잡한 업무/추론'],
        ['gpt-5.6-terra','gpt-5.6-terra · 품질/비용 균형'],
        ['gpt-5.6-luna','gpt-5.6-luna · 고속/대량 처리'],
        ['gpt-5.5','gpt-5.5 · 호환 고품질']
      ]
    },
    GEMINI_TEXT_MODEL:{
      recommended:'gemini-3.7-flash',
      options:[
        ['gemini-3.7-flash','gemini-3.7-flash · 추천 · 최신 안정/고품질'],
        ['gemini-3.6-flash','gemini-3.6-flash · 안정 · 속도/품질 균형'],
        ['gemini-3.5-flash','gemini-3.5-flash · 호환 안정'],
        ['gemini-3.5-flash-lite','gemini-3.5-flash-lite · 저비용/고속']
      ]
    },
    GEMINI_STT_MODEL:{
      recommended:'gemini-3.5-transcribe',
      options:[
        ['gemini-3.5-transcribe','Gemini 3.5 Transcribe · 추천 · 파일/구간 음성인식'],
        ['gemini-3.5-transcribe-live','Gemini 3.5 Transcribe Live · 실시간 Live API 전용']
      ]
    },
    ANTHROPIC_TEXT_MODEL:{
      recommended:'claude-opus-5',
      options:[
        ['claude-opus-5','claude-opus-5 · 최고품질 추천 · 복잡한 분석/에이전트'],
        ['claude-sonnet-5','claude-sonnet-5 · 고품질/효율 균형'],
        ['claude-opus-4-8','claude-opus-4-8 · 호환 고품질']
      ]
    }
  };

  function enhance(input){
    const name=input?.dataset?.field;
    const spec=modelOptions[name];
    if(!spec||input.dataset.modelEnhanced==='1')return;
    const raw=String(input.value||'').trim();
    const deprecatedGemini=name==='GEMINI_TEXT_MODEL'&&/^gemini-2\./.test(raw);
    const current=deprecatedGemini?spec.recommended:(raw||spec.recommended);
    const select=document.createElement('select');
    select.dataset.field=name;
    select.dataset.modelEnhanced='1';
    select.setAttribute('aria-label',name==='GEMINI_STT_MODEL'?'Gemini 음성인식 모델 선택':`${name} 모델 선택`);
    const values=new Set();
    for(const [value,label] of spec.options){
      values.add(value);
      const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o);
    }
    if(current&&!values.has(current)){
      const o=document.createElement('option');o.value=current;o.textContent=`${current} · 현재 저장값`;select.insertBefore(o,select.firstChild);
    }
    const custom=document.createElement('option');custom.value='__custom__';custom.textContent='직접 모델명 입력…';select.appendChild(custom);
    select.value=current;
    select.style.cursor='pointer';
    select.title=name==='GEMINI_STT_MODEL'?'음성인식에 사용할 Gemini 모델을 선택합니다.':'클릭하면 사용할 모델 목록을 볼 수 있습니다.';
    select.addEventListener('change',()=>{
      if(select.value!=='__custom__')return;
      const typed=prompt('사용할 모델명을 정확히 입력하세요.',current||spec.recommended);
      if(!typed){select.value=current;return}
      const value=typed.trim();
      let o=[...select.options].find(x=>x.value===value);
      if(!o){o=document.createElement('option');o.value=value;o.textContent=`${value} · 직접 입력`;select.insertBefore(o,custom)}
      select.value=value;
    });
    const hint=document.createElement('small');
    hint.className='model-hint';
    hint.style.cssText='display:block;color:#64748b;margin:-2px 0 8px;font-size:11px';
    hint.textContent=name==='GEMINI_STT_MODEL'?'추천: gemini-3.5-transcribe · Live는 실시간 Live API 경로에서 사용':deprecatedGemini?`기존 ${raw}는 신규 사용 제한 가능 · 추천 ${spec.recommended}로 전환`:`추천: ${spec.recommended} · ▼를 눌러 다른 모델 선택`;
    const label= input.closest('label');
    if(name==='GEMINI_STT_MODEL'&&label?.firstChild?.nodeType===Node.TEXT_NODE)label.firstChild.textContent='STT Model';
    input.replaceWith(select);
    select.insertAdjacentElement('afterend',hint);
  }

  function scan(){
    document.querySelectorAll('input[data-field="OPENAI_TEXT_MODEL"],input[data-field="GEMINI_TEXT_MODEL"],input[data-field="GEMINI_STT_MODEL"],input[data-field="ANTHROPIC_TEXT_MODEL"]').forEach(enhance);
  }
  scan();
  const observer=new MutationObserver(scan);
  observer.observe(document.documentElement,{childList:true,subtree:true});

  if(!document.querySelector('script[data-provider-guides]')){
    const s=document.createElement('script');
    s.src='/provider-setup-guides.js?v=2';
    s.defer=true;
    s.dataset.providerGuides='1';
    document.head.appendChild(s);
  }
})();
