import fs from 'node:fs';

const appFile=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(appFile,'utf8');
const replaceOnce=(text,from,to,label)=>{const at=text.indexOf(from);if(at<0)throw new Error('v371_anchor_missing:'+label);if(text.indexOf(from,at+from.length)>=0)throw new Error('v371_anchor_duplicate:'+label);return text.slice(0,at)+to+text.slice(at+from.length)};

const speechStart=source.indexOf('function startSpeech(){');const speechProvider=source.indexOf('const SR=',speechStart);const mobileCondition=source.indexOf('if(mobileSpeech&&!mobileBrowserSpeech)',speechStart);if(speechStart<0||speechProvider<0||mobileCondition<speechStart||mobileCondition>speechProvider)throw new Error('v371_anchor_missing:android-mobile-server-primary');source=source.slice(0,mobileCondition)+'if(mobileSpeech)'+source.slice(mobileCondition+'if(mobileSpeech&&!mobileBrowserSpeech)'.length);

source=replaceOnce(source,"const APP_VERSION='3.5.21'","const APP_VERSION='3.5.23'",'app-version');

for(const marker of [
  'if(mobileSpeech)',
  "const mobileBrowserSpeech=",
  "const APP_VERSION='3.5.23'"
])if(!source.includes(marker))throw new Error('v371_contract_missing:'+marker);

fs.writeFileSync(appFile,source);

const indexFile=new URL('../public/index.html',import.meta.url);
let index=fs.readFileSync(indexFile,'utf8');
index=replaceOnce(index,'app.js?v=3.5.21','app.js?v=3.5.23','index-version');
fs.writeFileSync(indexFile,index);

const swFile=new URL('../public/sw.js',import.meta.url);
let sw=fs.readFileSync(swFile,'utf8');
sw=replaceOnce(sw,'voiceflow-shell-v347','voiceflow-shell-v349','pwa-cache');
fs.writeFileSync(swFile,sw);

console.log('VoiceFlow Android mobile VPS local STT primary v3.5.23 applied');
