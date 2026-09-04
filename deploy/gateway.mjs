import http from 'node:http';

const port=Number(process.env.GATEWAY_PORT||4173);
const identityPort=Number(process.env.IDENTITY_ORG_PORT||4180);
const routes=[
  {test:p=>p.startsWith('/api/v1/auth')||p.startsWith('/api/v1/account')||p.startsWith('/api/v1/org')||p.startsWith('/api/v1/admin/users')||p.startsWith('/api/v1/admin/organization'),port:identityPort},
  {test:p=>p.startsWith('/api/v1/admin/integration-hub'),port:Number(process.env.INTEGRATION_HUB_BRIDGE_PORT||4182)},
  {test:p=>p.startsWith('/api/v1/admin/integrations'),port:Number(process.env.ADMIN_INTEGRATION_PORT||4181)},
  {test:p=>p.startsWith('/api/v1/tapjoin'),port:Number(process.env.DEVICE_NEARBY_PORT||4183)},
  {test:p=>p.startsWith('/api/v1/meeting-media'),port:Number(process.env.ORIGINAL_MEDIA_PORT||4184)},
  {test:p=>p.startsWith('/api/v1/board'),port:Number(process.env.BOARD_PORT||4175)},
  {test:p=>p.startsWith('/api/v1/tasks'),port:Number(process.env.TASK_PORT||4176)},
  {test:p=>p.startsWith('/api/v1/ai-employees')||p.startsWith('/api/v1/ai-meeting')||p.startsWith('/api/v1/ai-memory')||p.startsWith('/api/v1/ai-actions'),port:Number(process.env.AI_EMPLOYEE_PORT||4177)},
  {test:p=>p.startsWith('/api/v1/connectors')||p.startsWith('/api/v1/obsidian')||p.startsWith('/api/v1/hermes')||p.startsWith('/api/v1/discord'),port:Number(process.env.CONNECTOR_PORT||4178)},
  {test:p=>p.startsWith('/api/v1/meeting-results'),port:Number(process.env.MEETING_RESULT_PORT||4179)}
];
const corePort=Number(process.env.CORE_PORT||4180);
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))};
const fetchJson=async(url,opt={})=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(2500),...opt});const d=await r.json().catch(()=>({}));return{ok:r.ok,data:d,status:r.status}}catch(e){return{ok:false,error:e.message}}};
async function health(res){const [core,board,tasks,ai,connectors,meetingResults,adminIntegrations,integrationHubBridge,deviceNearby,originalMedia,identityOrg]=await Promise.all([fetchJson(`http://127.0.0.1:${corePort}/api/health`),fetchJson(`http://127.0.0.1:${process.env.BOARD_PORT||4175}/health`),fetchJson(`http://127.0.0.1:${process.env.TASK_PORT||4176}/health`),fetchJson(`http://127.0.0.1:${process.env.AI_EMPLOYEE_PORT||4177}/health`),fetchJson(`http://127.0.0.1:${process.env.CONNECTOR_PORT||4178}/health`),fetchJson(`http://127.0.0.1:${process.env.MEETING_RESULT_PORT||4179}/health`),fetchJson(`http://127.0.0.1:${process.env.ADMIN_INTEGRATION_PORT||4181}/health`),fetchJson(`http://127.0.0.1:${process.env.INTEGRATION_HUB_BRIDGE_PORT||4182}/health`),fetchJson(`http://127.0.0.1:${process.env.DEVICE_NEARBY_PORT||4183}/health`),fetchJson(`http://127.0.0.1:${process.env.ORIGINAL_MEDIA_PORT||4184}/health`),fetchJson(`http://127.0.0.1:${identityPort}/health`)]);const services={core,board,tasks,ai,connectors,meetingResults,adminIntegrations,integrationHubBridge,deviceNearby,originalMedia,identityOrg};const ok=Object.values(services).every(x=>x.ok);return json(res,ok?200:503,{ok,service:'voiceflow-gateway',version:'2.6.2',mode:'meeting-first',services})}
function proxy(req,res,targetPort){const headers={...req.headers,host:`127.0.0.1:${targetPort}`};const upstream=http.request({hostname:'127.0.0.1',port:targetPort,path:req.url,method:req.method,headers},up=>{res.writeHead(up.statusCode||502,up.headers);up.pipe(res)});upstream.on('error',e=>json(res,502,{ok:false,error:'upstream_unavailable',target_port:targetPort,message:e.message}));req.pipe(upstream)}
async function isAdmin(req){const r=await fetchJson(`http://127.0.0.1:${identityPort}/api/v1/auth/me`,{headers:{cookie:req.headers.cookie||''}});return !!(r.ok&&r.data?.user?.role==='admin')}
const protectedAdminPages=new Set(['/admin-integrations.html','/drive-connect.html','/integration-center-v6.html','/ai-employee-admin.html','/ai-meeting-lab.html','/admin-nfc.html']);
const server=http.createServer(async(req,res)=>{const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(u.pathname==='/api/health')return health(res);const admin=await isAdmin(req);if(protectedAdminPages.has(u.pathname)&&!admin){res.writeHead(302,{location:'/?admin_required=1','cache-control':'no-store'});return res.end()}if(u.pathname.startsWith('/api/v1/admin/')&&!admin)return json(res,403,{ok:false,error:'admin_required'});const route=routes.find(r=>r.test(u.pathname));return proxy(req,res,route?.port||corePort)});
server.listen(port,'0.0.0.0',()=>console.log(`VoiceFlow Gateway v2.6.2 :${port} -> core:${corePort}`));
