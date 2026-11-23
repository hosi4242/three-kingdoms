# 선택 사항(개발자용): 실제 Chromium으로 모집 화면을 모바일 크기(360x740)에서 점검합니다.
# 필요: pip install playwright && playwright install chromium   실행: python tools/runtime-test.py
import subprocess, time, json
from playwright.sync_api import sync_playwright
import os
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","browser-test")
srv=subprocess.Popen(["python3","-m","http.server","8130","--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
IDB_GET="""async()=>new Promise((res)=>{const r=indexedDB.open('cheonhap-save',1);r.onsuccess=()=>{const g=r.result.transaction('gameState').objectStore('gameState').get('main');g.onsuccess=()=>{res(g.result);r.result.close()}}})"""
def idb_edit(pg,js): return pg.evaluate("""async(fn)=>new Promise(res=>{const r=indexedDB.open('cheonhap-save',1);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('gameState','readwrite');const os=tx.objectStore('gameState');os.get('main').onsuccess=e=>{const s=e.target.result;(new Function('s',fn))(s);os.put(s,'main')};tx.oncomplete=()=>{db.close();res(1)}}})""",js)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":360,"height":740},has_touch=True,is_mobile=True,device_scale_factor=2)
    pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append("PAGEERR "+str(e))); pg.on("console",lambda m:errs.append(m.text) if m.type=="error" else None)
    pg.goto("http://localhost:8130/"); pg.wait_for_selector(".general-card")
    print("버전/장수:",pg.inner_text(".version"),pg.inner_text("#roster-count"),"보유",pg.inner_text("#owned-count"))
    print("가로 넘침(문서):",pg.evaluate("[document.documentElement.scrollWidth,document.documentElement.clientWidth]"))
    print("상단 탭 넘침:",pg.evaluate("(()=>{const t=document.querySelector('.tabs');return [t.scrollWidth,t.clientWidth]})()"))
    print("하단 메뉴:",pg.evaluate("(()=>{const n=document.querySelector('.bottom-nav');return {sw:n.scrollWidth,cw:n.clientWidth,items:[...n.children].map(c=>{const r=c.getBoundingClientRect();return [Math.round(r.left),Math.round(r.right),Math.round(r.height),c.textContent.trim()]})}})()"))
    print("44px 미만 터치요소:",pg.evaluate("[...document.querySelectorAll('button,input:not([type=checkbox]),select,textarea')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<44).map(e=>(e.id||e.className)+':'+Math.round(e.getBoundingClientRect().height))"))
    pg.click(".bottom-item[data-tab=recruit]"); time.sleep(.3)
    print("모집탭: 금화",pg.inner_text("#recruit-gold"),"| 배너",pg.locator(".banner").count(),"| 버튼 활성",pg.evaluate("[...document.querySelectorAll('[data-pull]')].map(b=>b.textContent.trim()+(b.disabled?'(비활성)':''))"))
    print("모집탭 가로 넘침:",pg.evaluate("[document.documentElement.scrollWidth,document.documentElement.clientWidth]"))
    
    # 일반 1회
    pg.click("[data-banner=normal][data-pull='1']"); pg.wait_for_function("document.querySelectorAll('#recruit-results .result-card').length==1")
    print("일반 1회 후 금화:",pg.inner_text("#recruit-gold"),"| 결과",pg.inner_text("#recruit-results").replace("\n"," "))
    # 더블탭 방지: 10회(900) 두 번 연속 클릭
    s=pg.evaluate(IDB_GET); before=s["lord"]["gold"]
    pg.locator("[data-banner=normal][data-pull='10']").dblclick(); time.sleep(.8)
    s=pg.evaluate(IDB_GET); print("10회 더블클릭: 금화",before,"→",s["lord"]["gold"],"(차감 900이면 1번만 실행) pity",s["recruit"]["pity"],"총",s["recruit"]["totalPulls"])
    print("결과 카드 수:",pg.locator("#recruit-results .result-card").count(),"| 보유",pg.inner_text("#owned-count"),"| 혼조각",pg.inner_text("#shard-list").replace("\n"," "))
    print("금화 부족 시 버튼:",pg.evaluate("[...document.querySelectorAll('[data-pull]')].map(b=>b.disabled)"))
    
    # 새로고침 후 유지
    gold=s["lord"]["gold"]; pg.reload(); pg.wait_for_selector(".general-card"); pg.click(".bottom-item[data-tab=recruit]")
    print("새로고침 후 금화/결과 유지:",pg.inner_text("#recruit-gold")==f"{gold:,}",pg.locator("#recruit-results .result-card").count())
    # 저장 실패 롤백
    idb_edit(pg,"s.lord.gold=5000"); pg.reload(); pg.wait_for_selector(".general-card"); pg.click(".bottom-item[data-tab=recruit]")
    pg.evaluate("(()=>{window.__orig=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new Error('강제 저장 실패')};return 1})()")
    pg.click("[data-banner=normal][data-pull='10']"); time.sleep(.8)
    print("저장 실패 시: 화면 금화",pg.inner_text("#recruit-gold"),"| 토스트:",pg.inner_text("#toast"))
    pg.evaluate("(()=>{IDBObjectStore.prototype.put=window.__orig;return 1})()")
    print("저장 실패 후 DB 금화(5000 유지):",pg.evaluate(IDB_GET)["lord"]["gold"])
    # 전설 영입
    idb_edit(pg,"s.shards['전설']=100"); pg.reload(); pg.wait_for_selector(".general-card"); pg.click(".bottom-item[data-tab=recruit]")
    print("영입 UI:",pg.inner_text("#redeem-progress"),"| 버튼활성",not pg.locator("#redeem-btn").is_disabled(),"| 후보수",pg.locator("#redeem-select option").count())
    target=pg.locator("#redeem-select option").nth(2).get_attribute("value"); pg.select_option("#redeem-select",target); pg.click("#redeem-btn"); time.sleep(.6)
    s=pg.evaluate(IDB_GET); g=[x for x in s["generals"] if x["id"]==target][0]
    print("영입 결과:",g["name"],g["rank"],"owned",g["owned"],"| 조각",s["shards"]["전설"],"| 버튼",pg.locator("#redeem-btn").is_disabled())
    
    # 모집한 장수로 전투
    idb_edit(pg,"for(const g of s.generals.slice(50)){g.owned=true}"); pg.reload(); pg.wait_for_selector(".general-card")
    pg.click(".tab[data-tab=battle]"); n=pg.locator("#battle-roster input").count(); print("전투 선택 가능 장수:",n,"| 문구",pg.inner_text("#battle-owned-count"))
    for j in range(3): pg.locator("#battle-roster input").nth(n-1-j).check()
    pg.click("#start-battle")
    for r in range(3):
        if pg.locator("#battle-choices .choice-btn").count()==0: break
        pg.locator("#battle-choices .choice-btn").first.click()
        if 2 in (int(pg.inner_text("#player-score")),int(pg.inner_text("#enemy-score"))): break
    print("일반 등급 장수 전투 결과:",pg.inner_text("#round-result").replace("\n"," | ")[:80])
    print("ERRORS:",errs[:6]); b.close()
srv.terminate()
