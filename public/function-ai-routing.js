(()=>{
const $=s=>document.querySelector(s);
const api=async(url,opt={})=>{const r=await fetch(url,{credentials:'same-origin',headers:{'content-type':'application/json',...(opt.headers||{})},...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||d.message||`HTTP ${r.status}`);return d};
const PROVIDERS={
 browser:{label:'Browser STT',models:['browser'],note:'무료 fallback'},
 openai:{label:'OpenAI',models:['gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','gpt-5.5'],note:'추론·요약·멀티모달'},
 gemini:{label:'Gemini',models:['gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite'],note:'STT·멀티모달·번역·에이전트'},
 claude:{label:'Claude',models:['claude-opus-5','claude-sonnet-5','claude-opus-4-8'],note:'문서·검토·고난도 분석'},
 deepl:{label:'DeepL',models:['deepl'],note:'전문 번역'},
 google_speech:{label:'Google Speech',models:['chirp_3','latest_long','latest_short'],note:'고품질 STT'},
 azure_speech:{label:'Azure Speech',models:['speech-default'],note:'기업형 STT/번역'},
 elevenlabs:{label:'ElevenLabs',models:['eleven_multilingual_v2'],note:'고품질 TTS'},
 google_vision:{label:'Google Vision',models:['vision-default'],note:'OCR/문서'},
 local:{label:'Local',models:['local'],note:'검증 fallback'},
 none:{label:'사용 안 함',models:['none'],note:''}
};
const FUNCTION_MODELS={
 stt_realtime:{openai:['gpt-4o-transcribe','gpt-4o-transcribe-diarize','gpt-4o-mini-transcribe'],gemini:['gemini-3.5-transcribe-live','gemini-3.5-transcribe'],google_speech:['chirp_3','latest_long','latest_short'],azure_speech:['speech-default'],browser:['browser']},
 tts:{gemini:['gemini-2.5-pro-preview-tts','gemini-3.1-flash-tts-preview','gemini-2.5-flash-preview-tts'],elevenlabs:['eleven_multilingual_v2'],openai:['gpt-4o-mini-tts','tts-1-hd','tts-1'],azure_speech:['speech-default']}
};
const FUNCTIONS=[
 {id:'stt_realtime',title:'🎙 실시간 음성인식 STT',desc:'회의 중 발화를 즉시 텍스트로 변환',providers:['openai','gemini','google_speech','azure_speech','browser'],best:{primary:'openai',fallback:'google_speech',profile:'quality'}},
 {id:'translation_live',title:'🌐 실시간 번역',desc:'회의 중 상대 언어로 즉시 번역',providers:['deepl','openai','gemini','azure_speech'],best:{primary:'deepl',fallback:'openai',profile:'quality'}},
 {id:'translation_verify',title:'✓ 번역 검증',desc:'숫자·부정·고유명사·문맥을 교차검증',providers:['openai','gemini','claude','local'],best:{primary:'openai',fallback:'claude',profile:'max_quality'}},
 {id:'meeting_summary',title:'📝 회의 요약 · 최종 보고서',desc:'회의 종료 후 결정사항·업무·리스크 정리',providers:['openai','claude','gemini'],best:{primary:'openai',fallback:'claude',profile:'max_quality'}},
 {id:'ai_employee',title:'🤖 AI 직원',desc:'업무 실행·분석·후속작업',providers:['openai','claude','gemini'],best:{primary:'openai',fallback:'claude',profile:'max_quality'}},
 {id:'document_vision',title:'👁 문서 · 이미지 분석',desc:'사진·PDF·메뉴·계약서·현장 이미지 분석',providers:['openai','gemini','claude','google_vision'],best:{primary:'openai',fallback:'gemini',profile:'max_quality'}},
 {id:'ocr',title:'🔎 OCR · 영수증/문서 추출',desc:'이미지에서 문자·표·숫자 추출',providers:['google_vision','gemini','openai'],best:{primary:'google_vision',fallback:'gemini',profile:'quality'}},
 {id:'tts',title:'🔊 TTS · 텍스트 읽어주기',desc:'번역문·AI 직원 응답·직접 입력 텍스트를 자연스럽게 음성으로 출력',providers:['gemini','elevenlabs','openai','azure_speech'],best:{primary:'gemini',fallback:'openai',profile:'max_quality'}},
 {id:'research',title:'🌍 검색 · 리서치',desc:'외부 최신정보 조사와 근거 수집',providers:['openai','gemini','claude'],best:{primary:'openai',fallback:'gemini',profile:'max_quality'}},
 {id:'final_review',title:'🛡 최종 품질 검수',desc:'중요 회의·계약·금액 결과를 다른 모델로 2차 확인',providers:['claude','openai','gemini'],best:{primary:'claude',fallback:'openai',profile:'max_quality'}}
];
let routing={};let status={};
const profileOptions=[['max_quality','최고 품질'],['quality','품질 우선'],['balanced','균형'],['speed','속도 우선'],['cost','비용 우선']];
function providerOptions(ids,sel){return ids.map(id=>`<option value="${id}" ${id===sel?'selected':''}>${PROVIDERS[id]?.label||id}</option>`).join('')}
function modelOptions(provider,sel,fnId=''){const models=FUNCTION_MODELS[fnId]?.[provider]||PROVIDERS[provider]?.models||[sel||'default'];return [...new Set([sel,...models].filter(Boolean))].map(m=>`<option value="${m}" ${m===sel?'selected':''}>${m}</option>`).join('')}
function render(){
 $('#providerStrip').innerHTML=['openai','gemini','claude','deepl','google_speech','elevenlabs'].map(id=>{const s=status[id];return `<div class="p"><b>${PROVIDERS[id].label}</b><small>${PROVIDERS[id].note}</small><div class="status ${s?.configured?'ok':'warn'}">${s?.configured?'● 등록됨':'○ 추후 등록 가능'}</div></div>`}).join('');
 $('#cards').innerHTML=FUNCTIONS.map(f=>{const r=routing[f.id]||f.best;const p=r.primary||f.best.primary;const action=f.id==='tts'?`<div class="row" style="margin-top:12px"><a class="btn primary" href="/text-to-speech.html">▶ 텍스트 읽어주기 실행</a></div>`:f.id==='stt_realtime'?`<div class="row" style="margin-top:12px"><a class="btn secondary" href="/admin-integrations.html?provider=gemini">Gemini STT 모델 · 연결 설정</a></div>`:'';const liveNote=f.id==='stt_realtime'&&p==='gemini'&&String(r.model||'').endsWith('-live')?' · Live 모델은 Live API 경로에서 사용하며 구간형 테스트는 일반 Transcribe로 안전 전환됩니다.':'';return `<section class="card" data-fn="${f.id}"><span class="badge">기능 중심</span><h2>${f.title}</h2><p class="muted">${f.desc}</p><div class="fields"><label>Primary Provider<select data-k="primary">${providerOptions(f.providers,p)}</select></label><label>Primary Model<select data-k="model">${modelOptions(p,r.model||'',f.id)}</select></label><label>Fallback Provider<select data-k="fallback">${providerOptions([...f.providers,'none'],r.fallback||'none')}</select></label><label>품질 정책<select data-k="profile">${profileOptions.map(([v,l])=>`<option value="${v}" ${v===(r.profile||'quality')?'selected':''}>${l}</option>`).join('')}</select></label></div>${action}<p class="note">Primary 장애/쿼터초과 시 Fallback을 사용합니다. API Key는 “API 연결 설정”에서 별도로 등록합니다.${liveNote}</p></section>`}).join('');
 document.querySelectorAll('[data-fn] select[data-k=primary]').forEach(s=>s.onchange=()=>{const card=s.closest('[data-fn]'),m=card.querySelector('[data-k=model]');m.innerHTML=modelOptions(s.value,'',card.dataset.fn)});
}
function collect(){const out={};document.querySelectorAll('[data-fn]').forEach(card=>{const get=k=>card.querySelector(`[data-k=${k}]`)?.value||'';out[card.dataset.fn]={primary:get('primary'),model:get('model'),fallback:get('fallback'),profile:get('profile')}});return out}
async function load(){try{const [settings,integrations]=await Promise.all([api('/api/v1/admin/settings'),api('/api/v1/admin/integrations').catch(()=>({data:{}}))]);routing=settings.data?.functionRouting||{};status=integrations.data||{};render();$('#log').textContent='기능별 AI 엔진 설정을 불러왔습니다.'}catch(e){$('#log').textContent='로드 실패: '+e.message}}
$('#applyBest').onclick=()=>{routing=Object.fromEntries(FUNCTIONS.map(f=>{const p=f.best.primary;const model=(FUNCTION_MODELS[f.id]?.[p]||PROVIDERS[p]?.models||[])[0]||'';return[f.id,{...f.best,model}]}));render();$('#log').textContent='최고 품질 권장값을 화면에 적용했습니다. 저장을 눌러 확정하세요.'};
$('#save').onclick=async()=>{try{const functionRouting=collect();await api('/api/v1/admin/settings',{method:'PATCH',body:JSON.stringify({functionRouting})});routing=functionRouting;$('#log').textContent='✓ 기능별 AI 엔진 설정 저장 완료';}catch(e){$('#log').textContent='저장 실패: '+e.message}};
$('#reload').onclick=load;load();
})();
