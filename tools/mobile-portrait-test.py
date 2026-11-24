# 선택 사항(개발자용): 실제 Chromium으로 360/390/430px 모바일 화면의 초상화 표시를 점검하고 스크린샷을 저장합니다.
# 필요: pip install playwright && playwright install chromium   실행: python tools/mobile-portrait-test.py
# 주의: 데스크톱 Chromium의 모바일 에뮬레이션이며 실제 Android 기기 테스트를 대체하지 않습니다.
import subprocess, time, os, json, sys
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.join(HERE,"..","browser-test"); OUT=os.path.join(HERE,"..","docs","mobile-check")
os.makedirs(OUT,exist_ok=True)
PORT=8141; srv=subprocess.Popen([sys.executable,"-m","http.server",str(PORT),"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
EDIT="""async(fn)=>new Promise(res=>{const r=indexedDB.open('cheonhap-save',1);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('gameState','readwrite');const os=tx.objectStore('gameState');os.get('main').onsuccess=e=>{const s=e.target.result;(new Function('s',fn))(s);os.put(s,'main')};tx.oncomplete=()=>{db.close();res(1)}}})"""
results=[]; fails=0
def rec(ok,msg):
    global fails; results.append(("PASS" if ok else "FAIL")+"  "+msg); fails+= (not ok)
IMG_STATE="""()=>{const imgs=[...document.querySelectorAll('%s img.portrait')];imgs.forEach(i=>{i.loading='eager'});return imgs.map(i=>[i.currentSrc.split('/').pop(),i.complete&&i.naturalWidth>0])}"""
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    for W,H in [(360,740),(390,844),(430,932)]:
        ctx=b.new_context(viewport={"width":W,"height":H},has_touch=True,is_mobile=True,device_scale_factor=2,service_workers="block")
        # gen_002 은 일부러 로드 실패시켜 대체 표시를 확인합니다.
        ctx.route("**/gen_002.webp",lambda r:r.abort())
        pg=ctx.new_page(); errs=[]
        pg.on("pageerror",lambda e:errs.append("PAGEERR "+str(e))); pg.on("console",lambda m:errs.append(m.text) if m.type=="error" and "gen_002" not in m.text and "ERR_FAILED" not in m.text else None)
        pg.goto(f"http://localhost:{PORT}/"); pg.wait_for_selector(".general-card")
        # 가진 장수를 늘려 이미지/대체 표시가 섞이게 합니다. (테스트 전용, 실제 저장과 무관한 새 브라우저 컨텍스트)
        pg.evaluate(EDIT,"for(const g of s.generals){if(['gen_001','gen_002','gen_003','gen_021','gen_023','gen_032'].includes(g.id))g.owned=true} s.lord.gold=50000");
        pg.reload(); pg.wait_for_selector(".general-card"); pg.wait_for_timeout(500)
        tag=f"{W}px"
        rec(pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth"),f"[{tag}] 도감 가로 넘침 없음")
        st=pg.evaluate(IMG_STATE%"#general-grid"); pg.wait_for_timeout(800); st=pg.evaluate("()=>[...document.querySelectorAll('#general-grid img.portrait')].map(i=>[i.currentSrc.split('/').pop(),i.complete&&i.naturalWidth>0])")
        okimg=[n for n,o in st if o]; badimg=[n for n,o in st if not o]
        fb=pg.evaluate("document.querySelectorAll('#general-grid div.portrait').length")
        rec(len(okimg)>=28 and badimg==[],f"[{tag}] 도감: 이미지 {len(okimg)}장 정상 로드, 실패 {badimg}, 대체 표시 {fb}칸 (60칸 중)")
        rec(pg.evaluate("[...document.querySelectorAll('#general-grid .general-card')].find(c=>c.dataset.id==='gen_002').querySelector('.portrait').tagName")=="DIV",f"[{tag}] 로드 실패 이미지(gen_002) → 이름 첫 글자 대체 표시")
        # 카드 이미지가 박스를 채우는지(잘림 확인용 비율): 256x320 = 0.8
        ratios=pg.evaluate("[...document.querySelectorAll('#general-grid img.portrait')].slice(0,6).map(i=>{const r=i.getBoundingClientRect();return +(r.width/r.height).toFixed(2)})")
        rec(all(abs(x-55/64)<0.03 or abs(x-48/58)<0.03 for x in ratios),f"[{tag}] 도감 카드 이미지 비율 {ratios[:3]} (표시 박스 기준, object-fit:cover)")
        pg.screenshot(path=os.path.join(OUT,f"{W}_01_dogam.png"))
        # 상세
        for gid,label in [("gen_001","이미지"),("gen_021","대체")]:
            pg.evaluate("id=>document.querySelector(`.general-card[data-id=${id}]`).click()",gid); pg.wait_for_selector("#general-dialog[open]"); pg.wait_for_timeout(400)
            box=pg.evaluate("(()=>{const e=document.querySelector('#general-detail .portrait-detail');const r=e.getBoundingClientRect();return [r.left,r.right,r.top,r.bottom,innerWidth,innerHeight,e.tagName]})()")
            rec(box[0]>=0 and box[1]<=box[4] and box[2]>=0 and box[3]<=box[5],f"[{tag}] 상세({label}) 초상화가 화면 안에 위치 {box[6]}")
            pg.screenshot(path=os.path.join(OUT,f"{W}_02_detail_{gid}.png")); pg.evaluate("document.querySelector('#general-dialog').close()")
        # 전투 편성
        pg.click('[data-tab="battle"]'); pg.wait_for_selector(".roster-choice"); pg.wait_for_timeout(600)
        rec(pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth"),f"[{tag}] 전투 편성 가로 넘침 없음")
        n=pg.evaluate("document.querySelectorAll('#battle-roster .roster-choice .portrait').length"); rec(n>=6,f"[{tag}] 전투 편성 카드 {n}개에 초상화/대체 표시")
        pg.evaluate("document.querySelector('#battle-roster').scrollIntoView()"); pg.screenshot(path=os.path.join(OUT,f"{W}_03_battle_setup.png"))
        for gid in ["gen_001","gen_003","gen_021"]: pg.evaluate("id=>{const i=document.querySelector(`[data-pick=${id}]`);i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}))}",gid)
        pg.click("#start-battle"); pg.wait_for_selector(".choice-btn"); pg.wait_for_timeout(500)
        rec(pg.evaluate("document.querySelectorAll('#battle-choices .choice-btn .portrait').length")==3,f"[{tag}] 라운드 출전 선택 버튼 3개에 초상화")
        rec(pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth"),f"[{tag}] 전투 진행 화면 가로 넘침 없음")
        pg.evaluate("document.querySelector('#battle-choices').scrollIntoView({block:'center'})"); pg.screenshot(path=os.path.join(OUT,f"{W}_04_battle_choices.png"))
        # 모집 결과
        pg.click('[data-tab="recruit"]'); pg.wait_for_selector('[data-pull="1"]'); pg.click('[data-pull="1"]'); pg.wait_for_selector(".result-card"); pg.wait_for_timeout(500)
        cnt=pg.evaluate("document.querySelectorAll('.result-card .portrait').length"); rec(cnt>=1,f"[{tag}] 모집 결과 카드 초상화/대체 표시 {cnt}개")
        pg.click('[data-pull="10"]'); pg.wait_for_timeout(800)
        cnt10=pg.evaluate("document.querySelectorAll('.result-card .portrait').length"); rec(cnt10>=10,f"[{tag}] 10회 모집 결과 {cnt10}칸 표시")
        rec(pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth"),f"[{tag}] 모집 화면 가로 넘침 없음")
        pg.evaluate("document.querySelector('.result-card').scrollIntoView()"); pg.screenshot(path=os.path.join(OUT,f"{W}_05_recruit_result.png"))
        rec(errs==[],f"[{tag}] 콘솔/페이지 오류 없음 {errs[:2]}")
        ctx.close()
    b.close()
finally:
    srv.terminate()
print("\n".join(results)); print(f"\n총 {len(results)}항목, 실패 {fails}")
open(os.path.join(OUT,"mobile-check-result.txt"),"w",encoding="utf-8").write("\n".join(results)+f"\n\n총 {len(results)}항목, 실패 {fails}\n")
sys.exit(1 if fails else 0)
