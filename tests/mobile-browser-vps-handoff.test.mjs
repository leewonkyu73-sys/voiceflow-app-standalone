import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('function startSpeech(){');
const end=source.indexOf('\nfunction speechMatchesFixedLanguage',start);
assert.ok(start>=0&&end>start,'generated startSpeech function missing');
const speech=source.slice(start,end);

assert.ok(speech.includes("if(mobileSpeech){state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server';state.media.sttError='';return}const SR="));
assert.ok(!speech.includes("if(mobileSpeech&&!mobileBrowserSpeech){startServerSpeechFallback()"));
assert.ok(speech.includes("const mobileBrowserSpeech="));
assert.ok(source.includes("const APP_VERSION='3.5.24'"));
assert.ok(source.includes("postCaption(text,'server')"));
console.log('MOBILE_SERVER_PRIMARY_CONTRACT_PASS');
