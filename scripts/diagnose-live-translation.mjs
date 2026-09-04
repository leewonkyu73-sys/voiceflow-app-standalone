import {translateExternal} from '../lib/provider-adapters.mjs';

const text='밥 먹었니';
const target='vi-VN';
const providers=['openai','gemini','deepl'];
let passed=false;
for(const provider of providers){
  const started=Date.now();
  try{
    const out=await translateExternal(provider,text,target);
    const ok=!!out&&String(out).trim()!==text;
    console.log(`${provider.toUpperCase()} ${ok?'PASS':'FAIL'} ${Date.now()-started}ms${ok?` -> ${String(out).slice(0,120)}`:' -> unchanged/empty'}`);
    if(ok)passed=true;
  }catch(e){
    const msg=String(e?.message||e).replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED]').replace(/AIza[A-Za-z0-9_-]+/g,'[REDACTED]');
    console.log(`${provider.toUpperCase()} FAIL ${Date.now()-started}ms -> ${msg}`);
  }
}
if(!passed)process.exit(1);
