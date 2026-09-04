import fs from 'node:fs/promises';

const file=new URL('../server-v2.mjs',import.meta.url);
let s=await fs.readFile(file,'utf8');

const fromTranslate="async function translate(text,target,settings){const preferred=settings.providers?.translation||'prototype',plan=buildFallbackPlan(settings),candidates=[preferred,plan.translation?.id,'openai','gemini','deepl','prototype'].filter((x,i,a)=>x&&a.indexOf(x)===i);for(const p of candidates){try{if(p==='prototype')return{provider:p,text:known[text]?.[target]||text,fallback:p!==preferred};const out=await translateExternal(p,text,target);if(out)return{provider:p,text:out,fallback:p!==preferred}}catch{}}return{provider:'prototype',text:known[text]?.[target]||text,fallback:true}}";
const toTranslate="async function translate(text,target,settings){const preferred=settings.providers?.translation||'prototype',plan=buildFallbackPlan(settings);const requested=[preferred,plan.translation?.id].filter(p=>p&&p!=='prototype');const candidates=[...requested,'openai','gemini','deepl'].filter((x,i,a)=>x&&a.indexOf(x)===i);const errors=[];for(const p of candidates){try{const out=await translateExternal(p,text,target);if(out&&String(out).trim()!==String(text).trim())return{provider:p,text:out,fallback:p!==preferred,errors}}catch(e){errors.push(`${p}:${e?.message||'error'}`)}}return{provider:'prototype',text:known[text]?.[target]||text,fallback:true,errors}}";
if(s.includes(fromTranslate))s=s.replace(fromTranslate,toTranslate);
else if(!s.includes(toTranslate)&&!s.includes("ROOM_CORE_VERSION='v344-provider-first'")&&!s.includes("ROOM_CORE_VERSION='v345-caption-revision-sync'"))throw new Error('patch_missing:translate-routing');

const oldPoll="for(const c of all){if(c.peer_id){const p=m?.participants?.find(x=>x.peer_id===c.peer_id);if(p?.language)c.participant_language=p.language}c.display_target=target}return json(res,200,{ok:true,data:all})";
const mappedPoll="for(const c of all){if(c.peer_id){const p=m?.participants?.find(x=>x.peer_id===c.peer_id);if(p?.language)c.participant_language=p.language}c.display_target=target;c.display_target_language=target;c.translation=c.translations?.[target]||'';c.validation=c.assurance?.[target]||null}return json(res,200,{ok:true,data:all})";
const lazyPoll="const settings=await rd(files.settings);let captionsDirty=false;for(const c of all){if(c.peer_id){const p=m?.participants?.find(x=>x.peer_id===c.peer_id);if(p?.language)c.participant_language=p.language}const source=c.detected_language||c.language||c.participant_language||detect(c.text||'');if(target&&target!==source&&!c.translations?.[target]){const tr=await translate(c.text,target,settings);if(tr?.text&&String(tr.text).trim()!==String(c.text||'').trim()){const va=await validate(c.text,tr.text,source,target,settings);c.translations={...(c.translations||{}),[target]:tr.text};c.assurance={...(c.assurance||{}),[target]:{...va,translation_provider:tr.provider,fallback:!!tr.fallback,errors:tr.errors||[]}};captionsDirty=true}}c.display_target=target;c.display_target_language=target;c.translation=target===source?c.text:(c.translations?.[target]||'');c.validation=target===source?{provider:'local',score:100,light:'green',issues:[]}:(c.assurance?.[target]||null)}if(captionsDirty){const stored=await rd(files.captions);const byId=new Map(all.map(c=>[c.id,c]));for(let i=0;i<stored.length;i++){const n=byId.get(stored[i].id);if(n)stored[i]={...stored[i],translations:n.translations,assurance:n.assurance}}await wr(files.captions,stored)}return json(res,200,{ok:true,data:all})";
if(s.includes(oldPoll))s=s.replace(oldPoll,lazyPoll);
else if(s.includes(mappedPoll))s=s.replace(mappedPoll,lazyPoll);
else if(!s.includes(lazyPoll))throw new Error('patch_missing:caption-lazy-target-translation');

const captionManageCode=`
const captionItem=u.pathname.match(/^\\/api\\/v1\\/meetings\\/(mtg_[A-Za-z0-9_]+)\\/captions\\/(cap_[A-Za-z0-9_]+)$/);
if(captionItem&&req.method==='DELETE'){const b=await body(req),peer=String(b.peer_id||u.searchParams.get('peer_id')||''),a=await rd(files.captions),i=a.findIndex(x=>x.id===captionItem[2]&&x.meeting_id===captionItem[1]);if(i<0)return json(res,404,{ok:false,error:'caption_not_found'});const user=await me(req),own=!!peer&&a[i].peer_id===peer,admin=user?.role==='admin';if(!own&&!admin)return json(res,403,{ok:false,error:'caption_delete_forbidden'});const removed=a.splice(i,1)[0];await wr(files.captions,a);await emit('caption.deleted',{meeting_id:captionItem[1],caption_id:removed.id,peer_id:removed.peer_id});return json(res,200,{ok:true,data:{id:removed.id,deleted:true}})}
const captionFeedback=u.pathname.match(/^\\/api\\/v1\\/meetings\\/(mtg_[A-Za-z0-9_]+)\\/captions\\/(cap_[A-Za-z0-9_]+)\\/translation-feedback$/);
if(captionFeedback&&(req.method==='POST'||req.method==='PATCH')){const b=await body(req),target=String(b.target||'').trim(),peer=String(b.peer_id||''),a=await rd(files.captions),i=a.findIndex(x=>x.id===captionFeedback[2]&&x.meeting_id===captionFeedback[1]);if(i<0)return json(res,404,{ok:false,error:'caption_not_found'});if(!target)return json(res,400,{ok:false,error:'target_required'});const feedback={status:'incorrect',reason:String(b.reason||'wrong_translation'),reported_by:peer||'participant',reported_at:now()};a[i]={...a[i],translation_feedback:{...(a[i].translation_feedback||{}),[target]:feedback}};await wr(files.captions,a);await emit('caption.translation_flagged',{meeting_id:captionFeedback[1],caption_id:captionFeedback[2],target,peer_id:peer});return json(res,200,{ok:true,data:{caption_id:captionFeedback[2],target,feedback}})}
`;
const anchor="if(u.pathname==='/api/v1/tasks'&&req.method==='GET')";
if(!s.includes("caption.translation_flagged")){
  if(!s.includes(anchor))throw new Error('patch_missing:caption-management-anchor');
  s=s.replace(anchor,captionManageCode+anchor);
}

await fs.writeFile(file,s,'utf8');
console.log('live translation routing + lazy target + caption correction APIs v2.7.7 patch applied');
