import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'voiceflow-deepl-recovery-'));
const data=path.join(root,'data');
await fs.mkdir(data,{recursive:true});
const integrationKey='existing-integration-key-for-test';
const deepLKey='existing-deepl-key-for-test:fx';
const key=crypto.createHash('sha256').update(integrationKey).digest();
const iv=crypto.randomBytes(12);
const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
const encrypted=Buffer.concat([cipher.update(deepLKey,'utf8'),cipher.final()]);
await fs.writeFile(path.join(root,'.env.backup-before-recovery'),'INTEGRATION_SECRET_KEY='+integrationKey+'\n');
await fs.writeFile(path.join(data,'integration-secrets.json'),JSON.stringify({
  DEEPL_API_KEY:{v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')}
}));

const env={...process.env,VOICEFLOW_RECOVERY_PROJECT_ROOT:root,INTEGRATION_DATA_DIR:data,VOICEFLOW_RECOVERY_SKIP_DOCKER:'1'};
delete env.DEEPL_API_KEY;
delete env.INTEGRATION_SECRET_KEY;
delete env.GOOGLE_DRIVE_TOKEN_SECRET;
const status=execFileSync(process.execPath,['scripts/resolve-existing-deepl.mjs'],{cwd:new URL('.',import.meta.url),env,encoding:'utf8'});
assert.doesNotMatch(status,/existing-deepl-key-for-test/);
const parsed=JSON.parse(status);
assert.equal(parsed.ok,true);
assert.equal(parsed.reason,'unique-existing-key');
assert.deepEqual(parsed.sourceCategories,['encrypted-store-decrypted','project-env-file']);
const emitted=execFileSync(process.execPath,['scripts/resolve-existing-deepl.mjs','--emit'],{cwd:new URL('.',import.meta.url),env,encoding:'utf8'});
assert.equal(emitted,deepLKey);
await fs.rm(root,{recursive:true,force:true});
console.log('Existing DeepL Secret recovery contract passed');
