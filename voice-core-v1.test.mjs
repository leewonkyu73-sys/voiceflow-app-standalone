import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const html=await fs.readFile(new URL('./public/voice-core-v1.html',import.meta.url),'utf8');
const js=await fs.readFile(new URL('./public/voice-core-v1.js',import.meta.url),'utf8');
const css=await fs.readFile(new URL('./public/voice-core-v1.css',import.meta.url),'utf8');

assert.match(html,/id="startVoice"/);
assert.match(html,/id="chatForm"/);
assert.match(html,/voice-core-v1\.js\?v=1/);
assert.equal((js.match(/getUserMedia\(/g)||[]).length,1,'voice core must acquire one microphone stream');
assert.doesNotMatch(js,/SpeechRecognition|webkitSpeechRecognition/);
assert.doesNotMatch(js,/입력을 확인했습니다|executeVoice|command/i);
assert.match(js,/new MediaRecorder\(state\.stream/);
assert.match(js,/\/transcribe/);
assert.match(js,/\/captions/);
assert.match(js,/target_language:target\(\)/);
assert.match(js,/input_mode:mode/);
assert.match(js,/translated&&translated!==clean/);
assert.doesNotMatch(js,/innerHTML=.*toolbar|MutationObserver/);
assert.match(css,/@media\(max-width:620px\)/);
console.log('VoiceFlow isolated voice core v1 contract passed');
