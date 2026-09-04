import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const app=await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8');
const collab=await fs.readFile(new URL('../public/meeting-collab.js',import.meta.url),'utf8');

assert.match(app,/if\(!state\.lastMeetingId\|\|state\.meeting\?\.status!=='ended'\)return ''/,'new meetings must not render the previous completion bar');
assert.match(app,/function launchSimpleSession\(kind\)\{state\.lastMeetingId=null;state\.meetingResult=null;state\.resultModal=false;state\.resultSaveNotice=''/,'new PC sessions must clear previous result state');
assert.match(app,/state\.captions\.push\(temp\);if\(state\.view==='room'\)renderRoomStable\(true\);try/,'manual text must render optimistically before the API finishes');
assert.match(app,/state\.chatDraft=text;try\{const sent=await postCaption\(text\);if\(sent\)\{state\.chatDraft=''/,'the composer must clear only after a successful post');
assert.match(app,/catch\(error\)\{state\.chatDraft=text;/,'failed sends must restore the typed text');
assert.match(app,/aria-label="\$\{videoOn\?'화상 종료':'녹음 완료'\}"/,'video rooms must expose an explicit video end control');
assert.match(collab,/currentMeeting\?\.id&&currentMeeting\.id!==m\.id\)systemRows\.length=0/,'meeting guidance must reset between sessions');
console.log('PC_VIDEO_REENTRY_AND_CHAT_PASS');
