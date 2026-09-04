const SHELL_CACHE='voiceflow-local-stt-shell-v4';
const APP_ROOT='/v4/local-stt-test/';
const SHELL=[
  APP_ROOT,
  `${APP_ROOT}app.mjs`,
  `${APP_ROOT}styles.css`,
  `${APP_ROOT}base.css`,
  `${APP_ROOT}manifest.webmanifest`,
  `${APP_ROOT}local-whisper-worker.mjs`,
  `${APP_ROOT}modules/meeting-contracts/index.mjs`,
  `${APP_ROOT}modules/meeting-api-adapter/index.mjs`,
  `${APP_ROOT}modules/caption-store/index.mjs`,
  `${APP_ROOT}modules/mobile-caption-session/index.mjs`,
  `${APP_ROOT}modules/mobile-input-policy/index.mjs`,
  `${APP_ROOT}modules/mobile-local-whisper/index.mjs`,
  `${APP_ROOT}modules/mobile-media-session/index.mjs`,
  `${APP_ROOT}modules/mobile-speech-session/index.mjs`,
  `${APP_ROOT}modules/mobile-browser-speech-session/index.mjs`,
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys
    .filter(key=>key.startsWith('voiceflow-local-stt-shell-')&&key!==SHELL_CACHE)
    .map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin||url.pathname.startsWith('/api/'))return;
  if(!url.pathname.startsWith(APP_ROOT))return;
  const cacheKey=event.request.mode==='navigate'?APP_ROOT:event.request;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok)caches.open(SHELL_CACHE).then(cache=>cache.put(cacheKey,response.clone()));
    return response;
  }).catch(()=>caches.match(cacheKey)));
});
