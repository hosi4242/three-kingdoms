// 초상화 적용 도구: 프로젝트 루트에서  node tools/apply-portraits.mjs  로 실행합니다. (Node.js만 있으면 됩니다)
//
// 하는 일
//  1) browser-test/assets/portraits/ 안의 gen_XXX.webp 파일을 찾아 규격(WebP, 256×320, 150KB 이하)을 검사합니다.
//  2) browser-test/js/generals.js 에서 파일이 실제로 있는 장수의 "portrait": null 을 경로로 바꿉니다.
//     (이름·능력치·등급·전투 효과 등 다른 데이터는 절대 수정하지 않습니다.)
//  3) browser-test/sw.js 의 APP_FILES 를 실제 존재하는 초상화 목록과 일치시킵니다.
//     (없는 파일을 목록에 넣으면 서비스워커 설치가 통째로 실패하므로, 파일이 있는 것만 넣습니다.)
//  4) browser-test → android-apk-project/www 로 동기화합니다.
//  5) 마지막에 node tools/verify.mjs 를 실행해 전체 검사를 확인하세요.
//
// 새 초상화 사용법: 256×320 WebP 파일을 gen_021.webp 처럼 장수 ID 이름으로 browser-test/assets/portraits/ 에 넣고 이 도구를 실행합니다.
import fs from "node:fs"; import path from "node:path"; import { pathToFileURL } from "node:url";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const B = path.join(root, "browser-test"), W = path.join(root, "android-apk-project", "www");
const PDIR = path.join(B, "assets", "portraits");
const W_EXPECT = 256, H_EXPECT = 320, MAX_KB = 150;
let problems = 0; const log = m => console.log(m), bad = m => { problems++; console.log("  문제 " + m); };

// WebP 헤더에서 가로·세로를 읽습니다 (VP8 / VP8L / VP8X 모두 지원).
function webpSize(buf) {
  if (buf.length < 30 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = buf.toString("ascii", 12, 16);
  if (kind === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
  if (kind === "VP8X") return { w: (buf.readUIntLE(24, 3)) + 1, h: (buf.readUIntLE(27, 3)) + 1 };
  return null;
}

const { GENERAL_DATA: G } = await import(pathToFileURL(path.join(B, "js", "generals.js")).href);
const files = fs.existsSync(PDIR) ? fs.readdirSync(PDIR).filter(f => /\.webp$/i.test(f)).sort() : [];
const ids = new Set(G.map(g => g.id));

log(`[1] 초상화 파일 검사 (${files.length}개 발견)`);
const valid = new Set();
for (const f of files) {
  const id = f.replace(/\.webp$/i, "");
  if (!ids.has(id)) { bad(`${f}: 장수 ID(${id})가 generals.js에 없습니다. 파일명을 확인하세요.`); continue; }
  if (f !== id + ".webp") { bad(`${f}: 확장자는 소문자 .webp 여야 합니다.`); continue; }
  const buf = fs.readFileSync(path.join(PDIR, f)), size = webpSize(buf);
  if (!size) { bad(`${f}: 올바른 WebP 파일이 아닙니다.`); continue; }
  if (size.w !== W_EXPECT || size.h !== H_EXPECT) { bad(`${f}: 크기 ${size.w}×${size.h} (필요: ${W_EXPECT}×${H_EXPECT})`); continue; }
  if (buf.length > MAX_KB * 1024) console.log(`  주의 ${f}: ${(buf.length / 1024).toFixed(0)}KB (권장 ${MAX_KB}KB 이하)`);
  valid.add(id);
}
log(`  규격 통과 ${valid.size}개`);

log("[2] generals.js 경로 연결 (portrait 필드만 수정)");
const gp = path.join(B, "js", "generals.js"); let src = fs.readFileSync(gp, "utf8"), changed = 0;
for (const id of valid) {
  const start = src.indexOf(`"id": "${id}"`); if (start < 0) { bad(`${id}: generals.js 에서 찾지 못했습니다.`); continue; }
  const nextObj = src.indexOf(`"id": "gen_`, start + 5); const end = nextObj < 0 ? src.length : nextObj;
  const seg = src.slice(start, end), want = `"portrait": "./assets/portraits/${id}.webp"`;
  if (seg.includes(want)) continue;
  if (!/"portrait": null/.test(seg)) { bad(`${id}: portrait 필드가 이미 다른 값입니다. 직접 확인하세요.`); continue; }
  src = src.slice(0, start) + seg.replace(/"portrait": null/, want) + src.slice(end); changed++;
}
if (changed) fs.writeFileSync(gp, src);
log(`  새로 연결 ${changed}명`);

log("[3] sw.js 캐시 목록 갱신");
const sp = path.join(B, "sw.js"), sw = fs.readFileSync(sp, "utf8");
const list = JSON.parse(/APP_FILES\s*=\s*(\[[^\]]*\])/.exec(sw)[1]);
const base = list.filter(f => !f.startsWith("./assets/portraits/"));
const onDisk = files.map(f => f.replace(/\.webp$/i, "")).filter(id => ids.has(id)).sort().map(id => `./assets/portraits/${id}.webp`);
const next = [...base, ...onDisk];
fs.writeFileSync(sp, sw.replace(/APP_FILES\s*=\s*\[[^\]]*\]/, "APP_FILES = " + JSON.stringify(next)));
log(`  캐시 목록 ${list.length}개 → ${next.length}개 (초상화 ${onDisk.length}개)`);

log("[4] browser-test → android-apk-project/www 동기화");
fs.rmSync(W, { recursive: true, force: true }); fs.cpSync(B, W, { recursive: true });
fs.rmSync(path.join(W, "README_KO.md"), { force: true });
for (const f of fs.readdirSync(W)) if (f.endsWith(".bat")) fs.rmSync(path.join(W, f), { force: true });
log("  동기화 완료");

const done = G.filter(g => valid.has(g.id) || (g.portrait && fs.existsSync(path.join(B, g.portrait.replace(/^\.\//, ""))))).length;
log(`\n초상화 연결 현황: ${done}/${G.length}명` + (done < G.length ? `  (미제작 ${G.length - done}명)` : "  (전원 완료)"));
if (problems) { log(`\n문제 ${problems}건을 먼저 해결하세요.`); process.exit(1); }
log("다음 단계: node tools/verify.mjs");
