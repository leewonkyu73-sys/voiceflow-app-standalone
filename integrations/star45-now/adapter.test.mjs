import assert from 'node:assert/strict';
import test from 'node:test';
import {meetingDecisionToNow, nowIntegrationStatus, sendConfirmedToNow, voiceTaskToNow} from './adapter.mjs';

test('Voice task maps to NOW without database coupling', () => {
  const mapped = voiceTaskToNow({
    id: 'tsk_42',
    title: '매출표 준비',
    work_type: 'task',
    scope: 'company',
    visibility: 'individual_company',
    deadline: '2026-09-10T08:00:00Z',
    priority: 'urgent',
    organization_id: 'org-1'
  });
  assert.equal(mapped.path, '/v1/tasks');
  assert.equal(mapped.payload.source_app, 'voice');
  assert.equal(mapped.payload.source_object_type, 'voice_task');
  assert.equal(mapped.payload.source_object_id, 'tsk_42');
  assert.equal(mapped.payload.priority_code, 'AS');
  assert.equal(mapped.payload.organization_id, 'org-1');
});

test('Voice schedule maps to NOW event', () => {
  const mapped = voiceTaskToNow({id: 'tsk_99', title: '재무회의', work_type: 'schedule', start_at: '2026-09-14T03:00:00Z'});
  assert.equal(mapped.path, '/v1/events');
  assert.equal(mapped.payload.start_at, '2026-09-14T03:00:00Z');
  assert.equal(mapped.payload.source_object_type, 'voice_schedule');
});

test('Meeting decision retains meeting provenance', () => {
  const mapped = meetingDecisionToNow(
    {title: '보고서 준비', work_type: 'task'},
    {meeting_id: 'meet-7', result_id: 'result-3', decision_index: 2, organization_id: 'org-1'}
  );
  assert.equal(mapped.payload.source_object_type, 'meeting_action');
  assert.equal(mapped.payload.source_object_id, 'meet-7:2');
  assert.equal(mapped.payload.organization_id, 'org-1');
});

test('Nothing is sent before explicit confirmation', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error('should_not_call'); };
  await assert.rejects(
    sendConfirmedToNow({baseUrl: 'http://127.0.0.1:4695', item: voiceTaskToNow({id: 'x', title: 'x'}), fetchImpl}),
    /confirmation_required/
  );
  assert.equal(calls, 0);
});

test('Confirmed send uses API, source idempotency key and no DB path', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = {url, options};
    return {ok: true, status: 201, json: async () => ({item: {id: 'now-1'}})};
  };
  const item = voiceTaskToNow({id: 'tsk_5', title: '확인된 업무', organization_id: 'org-1'});
  const result = await sendConfirmedToNow({
    baseUrl: 'http://127.0.0.1:4695',
    item,
    confirmed: true,
    authorization: 'test-token',
    organizationId: 'org-1',
    fetchImpl
  });
  assert.equal(result.item.id, 'now-1');
  assert.equal(request.url, 'http://127.0.0.1:4695/v1/tasks');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.authorization, 'Bearer test-token');
  assert.equal(request.options.headers['x-star45-organization'], 'org-1');
  assert.equal(request.options.headers['x-star45-idempotency-key'], 'voice:voice_task:tsk_5');
  assert.doesNotMatch(request.url, /postgres|database|5432/i);
});

test('Non-local HTTP endpoint is rejected', async () => {
  await assert.rejects(
    sendConfirmedToNow({
      baseUrl: 'http://now.example.test',
      item: voiceTaskToNow({id: 'x', title: 'x'}),
      confirmed: true,
      fetchImpl: async () => ({ok: true, json: async () => ({})})
    }),
    /now_https_required/
  );
});

test('Integration is disabled by default and exposes no secret', () => {
  const status = nowIntegrationStatus({STAR45_NOW_BASE_URL: 'https://now.star45.net'});
  assert.equal(status.enabled, false);
  assert.equal(status.configured, true);
  assert.equal(status.direct_database_access, false);
  assert.equal(status.automatic_external_send, false);
  assert.equal(Object.keys(status).some(k => /secret|token|password/i.test(k)), false);
});
