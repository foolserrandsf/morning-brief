// Network first, cache as backup, so the app opens offline with your last brief.
var C='mb-v20261010123610';
self.addEventListener('install',function(e){self.skipWaiting();e.waitUntil(caches.open(C).then(function(c){return c.addAll(['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'])}))});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(function(r){var cp=r.clone();caches.open(C).then(function(c){c.put(e.request,cp)});return r}).catch(function(){return caches.match(e.request,{ignoreSearch:true})}));
});
// Morning notification: encrypted by the brief writer, delivered by the sync sheet's script.
self.addEventListener('push',function(e){
  var d={};try{d=e.data?e.data.json():{}}catch(x){}
  e.waitUntil(self.registration.showNotification(d.title||'Morning Brief',{body:d.body||'Your Morning Brief is ready.',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:'morning-brief',data:{url:d.url||'./'}}));
});
self.addEventListener('notificationclick',function(e){
  e.notification.close();
  var url=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(function(ws){
    for(var i=0;i<ws.length;i++){if(ws[i].url.indexOf(self.registration.scope)===0&&'focus' in ws[i]){ws[i].navigate(url);return ws[i].focus()}}
    return clients.openWindow(url);
  }));
});
