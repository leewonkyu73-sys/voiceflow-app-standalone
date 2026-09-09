const DEFAULT_SOURCE_APP = 'voice';

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function priorityFromVoice(priority = '') {
  const p = String(priority).toLowerCase();
  if (p === 'urgent' || p === 'high') return 'AS';
  if (p === 'low') return 'BB';
  return undefined;
}

function visibilityFromVoice(value = '') {
  if (value === 'private_personal') return 'private';
  if (value === 'shared_company' || value === 'individual_company') return 'organization';
  return undefined;
}

export function voiceTaskToNow(task = {}) {
  const isEvent = task.work_type === 'schedule';
  const sourceId = clean(task.id || task.source_result_id || task.source_meeting_id, 200);
  const organizationId = clean(task.organization_id || task.organization_unit_id, 200) || undefined;
  const base = {
    title: clean(task.title, 200) || 'Voice 업무',
    description: clean(task.description || task.source_text),
    category: task.scope === 'personal' ? 'personal' : 'work',
    visibility: visibilityFromVoice(task.visibility),
    organization_id: organizationId,
    source_app: DEFAULT_SOURCE_APP,
    source_object_type: isEvent ? 'voice_schedule' : 'voice_task',
    source_object_id: sourceId,
    priority_code: priorityFromVoice(task.priority)
  };
  if (isEvent) {
    return {
      kind: 'event',
      path: '/v1/events',
      payload: {
        ...base,
        start_at: clean(task.start_at || task.deadline, 100),
        end_at: clean(task.end_at, 100) || undefined,
        location: clean(task.location, 300) || undefined
      }
    };
  }
  return {
    kind: 'task',
    path: '/v1/tasks',
    payload: {
      ...base,
      due_at: clean(task.deadline, 100) || undefined,
      assignee_user_id: clean(task.owner_id, 200) || undefined
    }
  };
}

export function meetingDecisionToNow(decision = {}, meta = {}) {
  const mapped = voiceTaskToNow({
    ...decision,
    id: decision.id || `${clean(meta.meeting_id, 120)}:${Number(meta.decision_index ?? decision.decision_index ?? 0)}`,
    source_meeting_id: meta.meeting_id || decision.source_meeting_id,
    source_result_id: meta.result_id || decision.source_result_id,
    organization_id: meta.organization_id || decision.organization_id
  });
  mapped.payload.source_object_type = decision.work_type === 'schedule' ? 'meeting_schedule' : 'meeting_action';
  mapped.payload.source_object_id = clean(
    decision.id || `${meta.meeting_id || decision.source_meeting_id || 'meeting'}:${Number(meta.decision_index ?? decision.decision_index ?? 0)}`,
    200
  );
  return mapped;
}

export function voiceChatToNowDraft(message = {}, meta = {}) {
  const text = clean(message.text || message.content || message.message, 8000);
  if (!text) throw new Error('chat_text_required');
  const sourceId = clean(message.id || message.message_id || `${meta.room_id || 'chat'}:${meta.sequence || 0}`, 200);
  return {
    kind: 'draft',
    path: '/v1/intake/chat',
    payload: {
      text,
      organization_id: clean(meta.organization_id || message.organization_id, 200) || undefined,
      source_app: DEFAULT_SOURCE_APP,
      source_object_type: 'chat_message',
      source_object_id: sourceId,
      metadata: {
        room_id: clean(meta.room_id || message.room_id, 200) || null,
        sender_id: clean(message.sender_id || meta.sender_id, 200) || null
      }
    }
  };
}

function assertBaseUrl(baseUrl) {
  const url = new URL(String(baseUrl || ''));
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('now_https_required');
  return url.origin;
}

async function postNow({baseUrl,item,authorization='',organizationId='',fetchImpl=fetch}) {
  if (!item?.path || !item?.payload) throw new Error('now_item_required');
  const origin = assertBaseUrl(baseUrl);
  const headers = {'content-type': 'application/json', accept: 'application/json'};
  if (authorization) headers.authorization = authorization.startsWith('Bearer ') ? authorization : `Bearer ${authorization}`;
  if (organizationId) headers['x-star45-organization'] = String(organizationId);
  if (item.payload.source_object_id) headers['x-star45-idempotency-key'] = `voice:${item.payload.source_object_type}:${item.payload.source_object_id}`.slice(0, 240);
  const response = await fetchImpl(`${origin}${item.path}`, {method:'POST',headers,body:JSON.stringify(item.payload),signal:AbortSignal.timeout(7000)});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `now_http_${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function sendConfirmedToNow({baseUrl,item,confirmed=false,authorization='',organizationId='',fetchImpl=fetch} = {}) {
  if (confirmed !== true) throw new Error('confirmation_required');
  if (item?.kind === 'draft') throw new Error('use_chat_draft_bridge');
  return postNow({baseUrl,item,authorization,organizationId,fetchImpl});
}

export async function sendRequestedChatDraftToNow({baseUrl,item,requested=false,authorization='',organizationId='',fetchImpl=fetch} = {}) {
  if (requested !== true) throw new Error('user_request_required');
  if (item?.kind !== 'draft' || item?.path !== '/v1/intake/chat') throw new Error('chat_draft_required');
  return postNow({baseUrl,item,authorization,organizationId,fetchImpl});
}

export function nowIntegrationStatus(env = process.env) {
  const baseUrl = clean(env.STAR45_NOW_BASE_URL, 500);
  return {
    enabled: String(env.STAR45_NOW_INTEGRATION_ENABLED || '').toLowerCase() === 'true',
    configured: !!baseUrl,
    base_url: baseUrl,
    mode: 'api_only',
    chat_mode: 'opt_in_draft_only',
    direct_database_access: false,
    automatic_external_send: false
  };
}
