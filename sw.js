const CACHE='psikia-hub-v42';
const ASSETS=['./','./index.html?v=4.2','./app.js?v=4.2','./manifest.webmanifest?v=4.2','./icon-192.png?v=4.2','./icon-512.png?v=4.2','./version.json?v=4.2'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
  e.respondWith(
    fetch(e.request,{cache:'no-store'}).then(r=>{
      const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return r;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html?v=4.2')||caches.match('./')))
  );
});
