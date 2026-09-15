// One validated application snapshot per release. Updates wait for an explicit UI action.
const RELEASE='phase1-2026-09-15-1';
const PREFIX='pitbull-academy-';
const CACHE=PREFIX+RELEASE;
const IMAGE_CACHE=CACHE+'-images';
const ASSETS=['./index.html','./styles.css','./core-v1.css','./app.js','./reset-progress.js','./data/brands.js','./data/sources.js','./data/products.js','./data/modules.js','./data/clients.js','./data/scenarios/m01.js','./data/scenarios/m01-legacy-adapter.js','./manifest.webmanifest',
'./assets/glutamina.webp','./assets/tiby-boss-check.webp','./assets/tiby-boss-review.webp','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-512-maskable.png',
'./assets/tomas.svg','./assets/luciano.svg','./assets/marina.svg','./assets/matias.svg','./assets/carla.svg','./assets/federico.svg','./assets/client-ref-camila.svg'];
const assetURLs=new Set(ASSETS.map(path=>new URL(path,self.registration.scope).href));
const shellURL=new URL('./index.html',self.registration.scope).href;

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    // Fetch and validate everything before publishing this cache.
    const entries=await Promise.all(ASSETS.map(async path=>{
      const url=new URL(path,self.registration.scope).href;
      const response=await fetch(new Request(url,{cache:'reload'}));
      if(!response.ok||response.type==='opaque')throw new Error('Invalid release asset: '+path);
      // Drain every response before awaiting the whole snapshot. Leaving unread bodies
      // across many parallel requests can hold up the browser's connection pool.
      const bytes=await response.arrayBuffer();
      const text=path==='./index.html'||path==='./app.js'?new TextDecoder().decode(bytes):'';
      if(path==='./index.html'&&!text.includes('name="academy-release" content="'+RELEASE+'"'))
        throw new Error('HTML release mismatch');
      if(path==='./app.js'&&!text.includes("const RELEASE='"+RELEASE+"'"))
        throw new Error('Application release mismatch');
      const headers=new Headers(response.headers);headers.delete('Content-Encoding');headers.delete('Content-Length');
      return [url,new Response(bytes,{status:response.status,statusText:response.statusText,headers})];
    }));
    const cache=await caches.open(CACHE);
    try{await Promise.all(entries.map(([url,response])=>cache.put(url,response)))}
    catch(error){await caches.delete(CACHE);throw error}
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE&&k!==IMAGE_CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const scoped=sameOrigin&&url.href.startsWith(self.registration.scope);
  const unavailable=()=>new Response('Recurso no disponible en esta versión.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  if(scoped&&event.request.mode==='navigate'){
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(shellURL)).then(hit=>hit||unavailable()));
    return;
  }
  const canonical=new URL(url.pathname,self.location.origin).href;
  if(scoped&&(assetURLs.has(canonical)||/\.(?:html|js|css|webmanifest)$/.test(url.pathname))){
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(canonical)).then(hit=>hit||unavailable()));
    return;
  }
  if(event.request.destination==='image'){
    // Optional catalog images are independent of the executable snapshot.
    const response=caches.open(IMAGE_CACHE).then(async cache=>{
      const hit=await cache.match(event.request);if(hit)return hit;
      const downloaded=await fetch(event.request);
      if(downloaded.ok||(!sameOrigin&&downloaded.type==='opaque')){
        await cache.put(event.request,downloaded.clone());
      }
      return downloaded;
    });
    event.respondWith(response);
    event.waitUntil(response.then(()=>{},()=>{}));
  }
});
