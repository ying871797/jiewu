/* 解连环 · 离线壳
   单文件游戏的全部资源都在这里预缓存；导航请求网络优先，断网回退缓存。
   仅注册于 http(s)，file:// 双击打开时完全跳过。 */
'use strict';

var VERSION = 'jiewu-v0.8.0-dev';
var BASE = self.registration.scope;
var CORE = BASE + 'index.html';
var ASSETS = [
  CORE,
  BASE + 'manifest.webmanifest',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
  BASE + 'icons/icon-maskable-512.png',
  BASE + 'icons/apple-touch-icon.png',
  BASE + 'icons/favicon-32.png',
  BASE + 'icons/og-card.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          return key === VERSION ? null : caches.delete(key);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function cachePut(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  var copy = response.clone();
  caches.open(VERSION).then(function (cache) { cache.put(request, copy); }).catch(function () {});
}

// 网络优先，2.5 秒无响应就用缓存；保证首屏不被弱网拖住。
function offlineResponse() {
  return caches.match(CORE).then(function (cached) {
    return cached || new Response('离线缓存尚未就绪，请联网打开一次。', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  });
}

function navigation(event) {
  return new Promise(function (resolve) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      offlineResponse().then(resolve);
    }, 2500);

    fetch(event.request, { cache: 'no-store' }).then(function (response) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cachePut(CORE, response);
      resolve(response);
    }).catch(function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      offlineResponse().then(resolve);
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigation(event));
    return;
  }

  // 静态资源：先用缓存，后台顺手更新。
  event.respondWith(
    caches.match(request).then(function (cached) {
      var network = fetch(request).then(function (response) {
        cachePut(request, response);
        return response;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
