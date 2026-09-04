import fs from 'fs';
import path from 'path';
const dataDir = path.join(process.cwd(), 'data');
const usageFile = path.join(dataDir, 'usage.json');
if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir,{recursive:true});
if(!fs.existsSync(usageFile)){
  fs.writeFileSync(usageFile, JSON.stringify({stt_tokens:0,stt_seconds:0,updated:new Date().toISOString(),alerts:{level:0}},null,2));
  console.log('usage.json auto-created');
} else {
  console.log('usage.json exists');
}
console.log('v365 done');
