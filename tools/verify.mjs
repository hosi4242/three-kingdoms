// 정적 검사 도구: 프로젝트 루트에서  node tools/verify.mjs  로 실행합니다. (Node.js만 있으면 됩니다)
// 검사 항목: JS 문법 / 장수 데이터 / 버전 일치 / 서비스워커 파일 목록 / 브라우저↔Android 소스 일치
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { execFileSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,"$1")),"..");
const B=path.join(root,"browser-test"), W=path.join(root,"android-apk-project","www");
let fail=0; const ok=(m)=>console.log("  OK   "+m), bad=(m)=>{fail++;console.log("  FAIL "+m)}, warn=(m)=>console.log("  WARN "+m);
const check=(c,m)=>c?ok(m):bad(m);
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);

console.log("[1] JavaScript 문법");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"chk-"));
for(const dir of [B,W]) for(const f of walk(path.join(dir,"js")).filter(f=>f.endsWith(".js"))){
  const t=path.join(tmp,path.relative(root,f).replace(/[\\/]/g,"_")+".mjs"); fs.copyFileSync(f,t);
  try{execFileSync(process.execPath,["--check",t],{stdio:"pipe"});ok(path.relative(root,f))}catch(e){bad(path.relative(root,f)+" "+String(e.stderr).split("\n")[0])}
}

console.log("[2] 장수 데이터");
const {GENERAL_DATA:G}=await import(pathToFileURL(path.join(B,"js","generals.js")).href);
const ids=G.map(g=>g.id); check(new Set(ids).size===ids.length,`ID 중복 없음 (${G.length}명)`);
check(new Set(G.map(g=>g.name)).size===G.length,"이름 중복 없음");
const STAT=["martial","intelligence","leadership","politics","charm"], RANKS=["일반","고급","희귀","영웅","전설"], STYLES=["공격형","전술형","진형형"], FAC=["위","촉","오","군웅"];
let badRow=0; for(const g of G){const p=[]; if(!RANKS.includes(g.rank))p.push("rank"); if(!STYLES.includes(g.style))p.push("style"); if(!FAC.includes(g.faction))p.push("faction");
  for(const s of STAT) if(!Number.isInteger(g.stats?.[s])||g.stats[s]<1||g.stats[s]>100)p.push("stat:"+s);
  for(const k of ["skillName","skillDesc","passiveName","passiveDesc","weaknessName","weaknessDesc","passive","ultimate","weakness"]) if(!g[k])p.push(k);
  if(typeof g.owned!=="boolean")p.push("owned"); if(p.length){badRow++;bad(`${g.id} ${g.name}: ${p.join(",")}`)}}
if(!badRow)ok("능력치 범위·등급·성향·필살기/특성/약점 필드 모두 정상");
const byRank=Object.fromEntries(RANKS.map(r=>[r,G.filter(g=>g.rank===r).length])); console.log("       등급별 인원:",JSON.stringify(byRank));
check(new Set(G.map(g=>g.skillName)).size===G.length,"필살기 이름 고유");
check(G.every(g=>g.combatEffects?.passive?.stat&&Number.isFinite(g.combatEffects.passive.rate)&&Number.isFinite(g.combatEffects?.ultimate?.base)&&Number.isFinite(g.combatEffects?.ultimate?.counterBonus)&&g.combatEffects?.weakness?.style&&Number.isFinite(g.combatEffects.weakness.penalty)),"장수별 개별 전투 효과 데이터 존재");
check(new Set(G.map(g=>JSON.stringify(g.combatEffects))).size===G.length,"장수별 전투 효과 조합 60종 고유");
for(const r of RANKS) check(byRank[r]>0,`모집에 필요한 ${r} 등급 장수 존재 (${byRank[r]}명)`);
const s3=new Set(G.map(g=>g.skillDesc)).size; if(s3<G.length/2) warn(`필살기 설명이 ${s3}종뿐 (장수별 고유 설명 아님 - 알려진 미해결 사항)`);

console.log("[3] 버전 일치");
const ver=fs.readFileSync(path.join(B,"js","version.js"),"utf8"), app=/APP_VERSION\s*=\s*"([^"]+)"/.exec(ver)?.[1];
const sw=fs.readFileSync(path.join(B,"sw.js"),"utf8"), swv=/cheonhap-v([\d.]+)/.exec(sw)?.[1];
const pk=JSON.parse(fs.readFileSync(path.join(root,"android-apk-project","package.json"),"utf8")).version;
const html=fs.readFileSync(path.join(B,"index.html"),"utf8"); const hv=[...html.matchAll(/data-app-version>([\d.]+)</g)].map(m=>m[1]);
const rd=fs.readFileSync(path.join(root,"README_KO.md"),"utf8"); const rv=/v([\d.]+)/.exec(rd.split("\n")[0])?.[1];
check(app===swv,`APP_VERSION(${app}) = sw.js CACHE_NAME(${swv})`); check(app===pk,`APP_VERSION = package.json(${pk})`);
check(hv.length>0&&hv.every(v=>v===app),`index.html 표시 기본값 ${JSON.stringify(hv)}`); check(app===rv,`APP_VERSION = README 제목(${rv})`);
check(path.basename(root).includes(app.replace(/\./g,"_")),`폴더 이름(${path.basename(root)})에 버전 포함`);

console.log("[4] PWA / 서비스워커");
const list=JSON.parse(/APP_FILES\s*=\s*(\[[^\]]*\])/.exec(sw)[1]);
for(const f of list){ if(f==="./")continue; check(fs.existsSync(path.join(B,f)),`캐시 목록 파일 존재: ${f}`);}
const jsOnDisk=walk(path.join(B,"js")).map(f=>"./js/"+path.basename(f)); for(const f of jsOnDisk) check(list.includes(f),`오프라인 캐시에 포함: ${f}`);
const mf=JSON.parse(fs.readFileSync(path.join(B,"manifest.webmanifest"),"utf8")); check(mf.icons?.length>=2,"manifest 아이콘 등록"); for(const i of mf.icons||[]) check(fs.existsSync(path.join(B,i.src)),`아이콘 파일 존재: ${i.src}`);
const refs=[...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(m=>m[1]); for(const r of refs) check(fs.existsSync(path.join(B,r)),`index.html 참조 파일 존재: ${r}`);
for(const f of walk(path.join(B,"js"))){ const src=fs.readFileSync(f,"utf8"); for(const m of src.matchAll(/from\s+"\.\/([^"]+)"/g)) check(fs.existsSync(path.join(B,"js",m[1])),`import 경로 존재: ${path.basename(f)} → ${m[1]}`); }

console.log("[5] 브라우저 ↔ Android(www) 소스 일치");
const norm=d=>walk(d).filter(f=>!/README_KO\.md$|\.bat$/.test(f)).map(f=>path.relative(d,f).replace(/\\/g,"/")).sort();
const a=norm(B), b=norm(W); check(JSON.stringify(a)===JSON.stringify(b),`파일 목록 동일 (${a.length}개)`);
for(const f of a) if(b.includes(f)&&!fs.readFileSync(path.join(B,f)).equals(fs.readFileSync(path.join(W,f)))) bad("내용 다름: "+f);
for(const f of a.filter(f=>!b.includes(f))) bad("www에 없음: "+f);
console.log("[6] 모집 시스템 자동 테스트 (확률·10회 보장·혼 조각·저장 변환)");
try{execFileSync(process.execPath,[path.join(root,"tools","test-recruit.mjs")],{stdio:"inherit",timeout:180000,maxBuffer:1<<26});ok("tools/test-recruit.mjs 전체 통과")}catch(e){bad("tools/test-recruit.mjs 실패/시간 초과 - 단독 실행해 상세 내용을 확인하세요")}
console.log("[7] 장수 육성 테스트");
try{execFileSync(process.execPath,[path.join(root,"tools","test-progression.mjs")],{stdio:"inherit",timeout:15000});ok("tools/test-progression.mjs 전체 통과")}catch(e){bad("tools/test-progression.mjs 실패") }
console.log("[8] 장수별 전투 효과 테스트");
try{execFileSync(process.execPath,[path.join(root,"tools","test-combat.mjs")],{stdio:"inherit",timeout:15000});ok("tools/test-combat.mjs 전체 통과")}catch(e){bad("tools/test-combat.mjs 실패")}
fs.rmSync(tmp,{recursive:true,force:true});
console.log(fail?`\n결과: ${fail}건 실패`:"\n결과: 모든 정적 검사 통과"); process.exit(fail?1:0);
