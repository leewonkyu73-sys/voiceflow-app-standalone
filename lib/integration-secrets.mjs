import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const dataDir=process.env.INTEGRATION_DATA_DIR||process.env.CONNECTOR_DATA_DIR||process.env.AI_EMPLOYEE_DATA_DIR||process.env.MEETING_RESULT_DATA_DIR||'./data';
const secretFile=path.join(dataDir,'integration-secrets.json');
const configFile=path.join(dataDir,'integration-config.json');
const keySources=()=>[...new Set([process.env.INTEGRATION_SECRET_KEY,process.env.GOOGLE_DRIVE_TOKEN_SECRET].map(x=>String(x||'').trim()).filter(Boolean))];
const keySource=()=>keySources()[0]||'';
const key=source=>crypto.createHash('sha256').update(source).digest();
export async function ensureIntegrationStore(){await fs.mkdir(dataDir,{recursive:true});for(const [f,seed] of [[secretFile,{}],[configFile,{}]]){try{await fs.access(f)}catch{await fs.writeFile(f,JSON.stringify(seed,null,2))}}}
function enc(text){const source=keySource();if(!source)throw new Error('integration_secret_key_missing');const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key(source),iv),out=Buffer.concat([c.update(String(text),'utf8'),c.final()]);return{v:1,iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),data:out.toString('base64')}}
function dec(x){if(!x)return'';let lastError;for(const source of keySources()){try{const d=crypto.createDecipheriv('aes-256-gcm',key(source),Buffer.from(x.iv,'base64'));d.setAuthTag(Buffer.from(x.tag,'base64'));return Buffer.concat([d.update(Buffer.from(x.data,'base64')),d.final()]).toString('utf8')}catch(error){lastError=error}}if(lastError)throw lastError;return''}
async function rd(f){try{return JSON.parse(await fs.readFile(f,'utf8'))}catch{return{}}}
async function wr(f,d){await fs.writeFile(f,JSON.stringify(d,null,2))}
export async function setIntegrationSecret(name,value){await ensureIntegrationStore();const all=await rd(secretFile);if(value===null||value===undefined||String(value)==='')delete all[name];else all[name]=enc(value);await wr(secretFile,all)}
export async function getIntegrationSecret(name,envName=name){await ensureIntegrationStore();const all=await rd(secretFile);try{if(all[name])return dec(all[name])}catch{}return process.env[envName]||''}
export async function secretConfigured(name,envName=name){return!!(await getIntegrationSecret(name,envName))}
export async function setIntegrationConfig(patch={}){await ensureIntegrationStore();const cur=await rd(configFile);const next={...cur,...patch,updated_at:new Date().toISOString()};await wr(configFile,next);return next}
export async function getIntegrationConfig(){await ensureIntegrationStore();return rd(configFile)}
export async function integrationSnapshot(){await ensureIntegrationStore();const cfg=await rd(configFile),sec=await rd(secretFile);return{config:cfg,secret_names:Object.keys(sec)}}
