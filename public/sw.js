const CACHE='voiceflow-shell-v333';
const SHELL=['/','/index.html','/app.js?v=3.5.8','/manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const url=e.request.url;
  if(url.includes('/api/')||url.includes('/transcribe')||url.includes('/socket.io')||url.includes('/whisper')){
    return e.respondWith(fetch(e.request));
  }
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put('/',c));return r}).catch(()=>caches.match('/')));
    return;
  }
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{const cc=r.clone();caches.open(CACHE).then(x=>x.put(e.request,cc));return r})));
});
