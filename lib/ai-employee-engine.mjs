const now=()=>new Date().toISOString();
const uid=p=>`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

export const DEFAULT_EMPLOYEE={
  title:'AI Specialist',role:'advisor',mission:'회의 맥락을 이해하고 실행 가능한 의견을 제시한다.',
  persona:{tone:'professional',decision_style:'evidence_first',expertise:[],challenge_level:'balanced'},
  languages:['ko-KR'],model_provider:'auto',model_id:'',skills:[],tool_permissions:[],search_policy:'internal_only',
  memory_policy:'approved_learning',autonomy:'advise',status:'active',cost_limit_daily_usd:5
};

export function normalizeEmployee(input={}){
  return {...DEFAULT_EMPLOYEE,...input,employee_id:input.employee_id||uid('aie'),created_at:input.created_at||now(),updated_at:now(),
    persona:{...DEFAULT_EMPLOYEE.persona,...(input.persona||{})},skills:[...(input.skills||[])],tool_permissions:[...(input.tool_permissions||[])]};
}

export function canUseTool(employee,tool){return employee?.status==='active'&&(employee.tool_permissions||[]).includes(tool)};
export function canSearchWeb(employee){return employee?.status==='active'&&employee.search_policy==='web_allowed'};

export function buildMeetingPrompt(employee,ctx={}){
  const p=employee.persona||{};
  return [
    `당신은 회사의 AI 직원 ${employee.display_name||employee.employee_id}입니다.`,
    `직책: ${employee.title}. 역할: ${employee.role}. 미션: ${employee.mission}.`,
    `전문영역: ${(p.expertise||[]).join(', ')||'일반 업무'}.`,
    `대화 톤: ${p.tone}. 의사결정 방식: ${p.decision_style}. 반론 강도: ${p.challenge_level}.`,
    `회의 주제: ${ctx.topic||''}.`,
    `현재 발언: ${ctx.latest||''}.`,
    `관련 기억: ${(ctx.memories||[]).slice(0,8).join(' | ')||'없음'}.`,
    `목표는 회의에 도움이 되는 의견, 우려, 대안 또는 실행안을 짧고 명확하게 제시하는 것입니다.`,
    `모르는 사실은 추측하지 말고 조사 필요 여부를 표시하십시오. 권한 밖 행동은 실행하지 말고 승인을 요청하십시오.`
  ].join('\n');
}

export function chooseTurn(employees=[],state={}){
  const active=employees.filter(x=>x.status==='active'); if(!active.length)return null;
  if(state.requested_employee_id)return active.find(x=>x.employee_id===state.requested_employee_id)||null;
  const last=state.last_speaker_id; return active.find(x=>x.employee_id!==last)||active[0];
}

export function learningCandidate(employee,meetingResult={}){
  const candidates=[];
  for(const d of meetingResult.decisions||[])candidates.push({type:'decision',text:d,confidence:0.85});
  for(const a of meetingResult.actions||[])candidates.push({type:'workflow',text:a.text||String(a),confidence:0.75});
  return {id:uid('learn'),employee_id:employee.employee_id,status:'pending_approval',items:candidates.slice(0,20),created_at:now()};
}

export function meetingLabPlan({topic,employees=[],rounds=3}={}){
  const participants=employees.filter(x=>x.status==='active').map(x=>({employee_id:x.employee_id,name:x.display_name||x.title,role:x.role}));
  const turns=[]; for(let r=1;r<=Math.max(1,Math.min(10,rounds));r++)for(const p of participants)turns.push({round:r,employee_id:p.employee_id,state:'pending'});
  return {id:uid('lab'),topic:topic||'테스트 회의',mode:'mock-safe',participants,turns,created_at:now()};
}
