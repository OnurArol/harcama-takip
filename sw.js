const C='harcama-v8';
const A=['./','./index.html','./style.css','./ios-fixes.css','./payments.css','./receipts.css','./receipt-config.js','./receipts.js','./app.js','./payments.js','./manifest.json','./apple-touch-icon.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(A)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 // Never cache authentication, private receipt photos, or API traffic.
 if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 const relative=u.pathname.slice(new URL(self.registration.scope).pathname.length);
 if(relative && !A.includes('./'+relative))return;
 const key=relative?'./'+relative:'./';
 e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(C).then(c=>c.put(key,copy)))}return r}).catch(async()=>{
  const cached=await caches.match(key);if(cached)return cached;
  if(e.request.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
  return Response.error();
 }));
});
