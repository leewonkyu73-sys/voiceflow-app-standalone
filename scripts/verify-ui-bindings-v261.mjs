import fs from 'node:fs/promises';

const appFile = new URL('../public/app.js', import.meta.url);
const uiCssFile = new URL('../public/voiceflow-ui-v300.css', import.meta.url);
const indexFile = new URL('../public/index.html', import.meta.url);
const s = await fs.readFile(appFile, 'utf8');
const css = await fs.readFile(uiCssFile, 'utf8');
const index = await fs.readFile(indexFile, 'utf8');

const checks = [
  ['home voice start', /id="quickAudioStart"/, /quickAudioV263[^\n]*launchSimpleSession\('audio'\)/],
  ['pause control', /id="pauseCapture"/, /#pauseCapture[^\n]*addEventListener\('click',toggleRecordingPause\)/],
  ['inline invite control', /id="inviteInline"/, /#inviteInline[^\n]*VoiceFlowMeetingCollab/],
  ['chat send control', /id="sendChat"/, /#sendChat[^\n]*(addEventListener|onclick)/],
  ['session stop control', /id="stopCapture"/, /#stopCapture[^\n]*endMeeting/],
  ['result approve control', /id="approveResult"/, /#approveResult[^\n]*addEventListener/],
  ['result reject control', /id="rejectResult"/, /#rejectResult[^\n]*addEventListener/],
  ['Drive open control', /id="openDrive"/, /#openDrive[^\n]*addEventListener/],
  ['login form', /id="loginForm"/, /#loginForm[^\n]*addEventListener/],
  ['register form', /id="joinForm"/, /#joinForm[^\n]*addEventListener/],
  ['register marketing consent', /id="agreeMarketing"/, /marketingAccepted:\$\('#agreeMarketing'\)\.checked/],
  ['logout control', /id="logout"/, /#logout[^\n]*addEventListener/],
  ['delete account control', /id="deleteAccount"/, /#deleteAccount[^\n]*addEventListener/],
  ['admin provider save', /id="saveProviders"/, /#saveProviders[^\n]*addEventListener/],
  ['admin diagnostics refresh', /id="refreshDiag"/, /#refreshDiag[^\n]*addEventListener/],
  ['admin Drive settings', /id="openDriveSettings"/, /#openDriveSettings[^\n]*addEventListener/],
  ['admin Drive test', /id="testDriveStorage"/, /#testDriveStorage[^\n]*addEventListener/],
  ['admin Drive refresh', /id="refreshDriveStatus"/, /#refreshDriveStatus[^\n]*addEventListener/],
  ['task voice input', /id="taskVoice"/, /#taskVoice[^\n]*startTaskVoice/],
  ['task interpretation', /id="taskInterpret"/, /#taskInterpret[^\n]*interpretTaskText/],
  ['task batch confirmation', /id="taskBatchSave"/, /#taskBatchSave[^\n]*saveTaskBatch/],
];

let failed = 0;
for (const [name, ui, binding] of checks) {
  const hasUi = ui.test(s);
  const hasBinding = binding.test(s);
  const ok = hasUi && hasBinding;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ui=${hasUi} binding=${hasBinding}`);
  if (!ok) failed++;
}

const contracts = [
  ['pause runtime', /function toggleRecordingPause\(\)/],
  ['MediaRecorder pause', /recorder\.pause\(\)/],
  ['MediaRecorder resume', /recorder\.resume\(\)/],
  ['pause timer compensation', /state\.media\.startedAt\+=pausedFor/],
  ['settings quality check', /id="settingsDeviceTest"/],
  ['uniform global navigation', /bottom-nav cols-5 vf-global-nav/],
  ['global materials navigation', /\/board\.html/],
  ['complete result editors', /resultDecisionsEdit.*resultRisksEdit.*resultActionsEdit/],
  ['admin member delete control', /data-user-delete/],
  ['admin member delete binding', /method:'DELETE'/],
  ['meeting finalize endpoint', /\/finalize/],
  ['stop opens in-room result modal', /state\.resultModal=true;state\.resultSaveNotice='';render\(\)/],
  ['meeting result review', /result-review/],
  ['Drive reject API', /meeting-results\/\$\{state\.lastMeetingId\}\/reject/],
  ['translation assurance', /Translation Assurance/],
  ['task interpret API', /\/api\/v1\/tasks\/interpret/],
  ['confirmed task batch API', /\/api\/v1\/tasks\/batch/],
  ['multiple task timeline', /class="ai-task-timeline"/],
  ['task recurrence review', /data-draft-field="recurrence"/],
  ['task notification review', /data-draft-field="notify_assignees"/],
];
for (const [name, re] of contracts) {
  const ok = re.test(s);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
}

const cssChecks = [
  ['language controls hidden', /\.language-strip[^\{]*\{[^\}]*display\s*:\s*none/s],
  ['technical test row hidden', /\.chat-test-row[^\{]*\{[^\}]*display\s*:\s*none/s],
  ['composer attached navigation', /\.chat-compose-row[\s\S]*?\.bottom-nav/s],
  ['v3 stylesheet linked', /voiceflow-ui-v300\.css/.test(index)],
  ['selected task timeline styling', /\.ai-task-timeline[^{]*\{/s],
];
for (const item of cssChecks) {
  const name=item[0];
  const ok=typeof item[1]==='boolean'?item[1]:item[1].test(css);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
}

if (failed) {
  console.error(`UI v3 binding verification failed: ${failed} check(s)`);
  process.exit(1);
}
console.log('ALL REQUIRED VOICEFLOW UI V3 CONTRACTS PASS');
