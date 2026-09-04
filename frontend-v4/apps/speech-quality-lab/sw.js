const CACHE='voiceflow-speech-quality-lab-v1';
const SHELL=[
  '/v4/speech-quality-lab/',
  '/v4/speech-quality-lab/app.mjs',
  '/v4/speech-quality-lab/styles.css',
  '/v4/speech-quality-lab/manifest.webmanifest',
  '/v4/speech-quality-lab/modules/speech-quality-evaluator/index.mjs',
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
    return response;
  }).catch(async()=>await caches.match(event.request)||await caches.match('/v4/speech-quality-lab/')));
});
