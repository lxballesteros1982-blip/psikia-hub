const C='psikia-v26-input-fix';
const CORE=['./manifest.webmanifest?v=26'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(C).then(c=>c.put('./index.html?v=26',copy));return r}).catch(()=>caches.match('./index.html?v=26')));
    return;
  }
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
