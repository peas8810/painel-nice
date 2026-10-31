/* Academy service worker v3: never cache authenticated HTML, private data or APIs. */
const CACHE='academy-static-v3';
const ROOT='/academy/';
const STATIC=[ROOT+'assets/style.css',ROOT+'assets/portal.css',ROOT+'assets/academy-theme.css',ROOT+'assets/academy-icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('academy-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith(ROOT))return;
if(event.request.mode==='navigate'||u.pathname.endsWith('.html')||u.pathname.endsWith('.js')){event.respondWith(fetch(event.request,{cache:'no-store'}));return}
if(!STATIC.includes(u.pathname))return;
event.respondWith(fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(u.pathname,copy))}return r}).catch(()=>caches.match(u.pathname)));
});