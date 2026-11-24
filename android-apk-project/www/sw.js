// 앱 파일을 바꾸면 CACHE_NAME의 버전도 함께 올려야 기존 사용자의 오프라인 캐시가 갱신됩니다. (js/version.js와 같은 번호 유지)
const CACHE_NAME = "cheonhap-v2.3.1";
const APP_FILES = ["./","./index.html","./styles.css","./manifest.webmanifest","./icon-192.png","./icon-512.png","./js/app.js","./js/db.js","./js/generals.js","./js/version.js","./js/recruit.js","./js/recruit-ui.js","./js/progression.js","./js/combat.js","./js/equipment.js","./js/campaign.js","./js/missions.js","./js/shop.js","./js/portrait.js","./js/arena.js","./assets/portraits/gen_001.webp","./assets/portraits/gen_002.webp","./assets/portraits/gen_003.webp","./assets/portraits/gen_004.webp","./assets/portraits/gen_005.webp","./assets/portraits/gen_006.webp","./assets/portraits/gen_007.webp","./assets/portraits/gen_008.webp","./assets/portraits/gen_009.webp","./assets/portraits/gen_010.webp","./assets/portraits/gen_011.webp","./assets/portraits/gen_012.webp","./assets/portraits/gen_013.webp","./assets/portraits/gen_014.webp","./assets/portraits/gen_015.webp","./assets/portraits/gen_016.webp","./assets/portraits/gen_017.webp","./assets/portraits/gen_018.webp","./assets/portraits/gen_019.webp","./assets/portraits/gen_020.webp","./assets/portraits/gen_025.webp","./assets/portraits/gen_026.webp","./assets/portraits/gen_027.webp","./assets/portraits/gen_028.webp","./assets/portraits/gen_030.webp","./assets/portraits/gen_031.webp","./assets/portraits/gen_033.webp","./assets/portraits/gen_034.webp","./assets/portraits/gen_037.webp","./assets/portraits/gen_040.webp"];
self.addEventListener("install", event => {
  // cache:"reload" - 브라우저 HTTP 캐시의 옛 파일이 새 캐시에 섞이지 않도록 항상 서버에서 새로 받습니다.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(APP_FILES.map(f => cache.add(new Request(f,{cache:"reload"}))))));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  if(event.request.method!=="GET") return;
  event.respondWith(caches.match(event.request).then(hit=>hit || fetch(event.request).then(response=>{
    // 정상 응답(같은 출처)만 캐시에 저장합니다. 404/오류 응답을 저장하지 않기 위함입니다.
    if(response.ok && response.type==="basic"){const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match("./index.html"))));
});
