import fs from 'node:fs/promises';
import path from 'node:path';

const email=String(process.argv[2]||'').trim().toLowerCase();
if(!email||!email.includes('@')){
  console.error('Usage: node scripts/promote-admin.mjs <email>');
  process.exit(2);
}

const dataDir=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):'/opt/star45/voiceflow-data';
const usersFile=path.join(dataDir,'users.json');
const backupFile=path.join(dataDir,`users.json.backup-${Date.now()}`);

let users;
try{
  users=JSON.parse(await fs.readFile(usersFile,'utf8'));
}catch(e){
  console.error(`FAIL: cannot read ${usersFile}: ${e.message}`);
  process.exit(3);
}

if(!Array.isArray(users)){
  console.error('FAIL: users.json is not an array');
  process.exit(4);
}

const index=users.findIndex(u=>String(u?.email||'').trim().toLowerCase()===email&&!u?.deleted_at);
if(index<0){
  console.error(`FAIL: active user not found: ${email}`);
  process.exit(5);
}

await fs.copyFile(usersFile,backupFile);
const before={role:users[index].role,status:users[index].status};
users[index]={...users[index],role:'admin',status:'active',updated_at:new Date().toISOString()};
await fs.writeFile(usersFile,JSON.stringify(users,null,2));

const verify=JSON.parse(await fs.readFile(usersFile,'utf8'));
const changed=verify.find(u=>String(u?.email||'').trim().toLowerCase()===email&&!u?.deleted_at);
if(!changed||changed.role!=='admin'||changed.status!=='active'){
  console.error('FAIL: verification failed; restoring backup');
  await fs.copyFile(backupFile,usersFile);
  process.exit(6);
}

console.log(`PASS: ${email} promoted to admin`);
console.log(`BEFORE: role=${before.role||''} status=${before.status||''}`);
console.log(`AFTER:  role=${changed.role} status=${changed.status}`);
console.log(`BACKUP: ${backupFile}`);
