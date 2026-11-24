// 초상화 공통 렌더러 테스트: node tools/test-portrait.mjs
import path from "node:path"; import { pathToFileURL } from "node:url";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const { portraitHTML } = await import(pathToFileURL(path.join(root, "browser-test", "js", "portrait.js")).href);
let fail = 0; const t = (c, m) => { console.log((c ? "OK " : "FAIL ") + m); if (!c) fail++; };
const withImg = portraitHTML({ name: "조조", portrait: "./assets/portraits/gen_001.webp" });
t(/^<img class="portrait" src="\.\/assets\/portraits\/gen_001\.webp"/.test(withImg) && withImg.includes('data-initial="조"'), "이미지 있는 장수: img + 대체 글자 data 속성");
const noImg = portraitHTML({ name: "손권", portrait: null }, "portrait-sm");
t(noImg === '<div class="portrait portrait-sm">손</div>', "이미지 없는 장수: 이름 첫 글자 대체 표시");
t(portraitHTML({ name: "손권" }).startsWith("<div"), "portrait 필드 없음도 대체 표시");
const evil = portraitHTML({ name: '<b>"x', portrait: '"><script>' });
t(!evil.includes("<script>") && !evil.includes("<b>"), "이름·경로 HTML 이스케이프");
t(portraitHTML(null).includes("portrait"), "null 입력에도 오류 없음");
console.log(fail ? "portrait tests FAILED" : "portrait tests passed"); process.exit(fail ? 1 : 0);
