// 모집 시스템 자동 테스트: node tools/test-recruit.mjs   (확률 시뮬레이션 때문에 약 20~60초 걸릴 수 있습니다)
import path from "node:path"; import { pathToFileURL } from "node:url";
const B = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "browser-test", "js");
const imp = f => import(pathToFileURL(path.join(B, f)).href);
const { GENERAL_DATA } = await imp("generals.js");
const R = await imp("recruit.js"); const D = await imp("db.js"); const { SAVE_FORMAT_VERSION } = await imp("version.js");
const { BANNERS, BANNER_IDS, RANKS, PITY_LIMIT, SHARD_PER_DUPLICATE, LEGEND_REDEEM_COST, recruit, redeemLegend, ensureRecruitState, defaultRecruitState, defaultShards } = R;
let fail = 0; const ok = m => console.log("  OK   " + m), bad = m => { fail++; console.log("  FAIL " + m); }; const check = (c, m) => c ? ok(m) : bad(m);
const clone = v => JSON.parse(JSON.stringify(v));
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const newState = (gold = 1e12) => ensureRecruitState({ saveFormatVersion: SAVE_FORMAT_VERSION, lord: { level: 1, exp: 0, gold, gems: 0 }, generals: clone(GENERAL_DATA) });

console.log("[1] 설정/데이터 일관성");
for (const id of BANNER_IDS) { const b = BANNERS[id]; const sum = Object.values(b.odds).reduce((a, c) => a + c, 0);
  check(sum === 100, `${b.name} 확률 합계 ${sum}%`);
  for (const r of Object.keys(b.odds)) check(GENERAL_DATA.some(g => g.rank === r), `${b.name}: ${r} 등급 장수 존재 (${GENERAL_DATA.filter(g => g.rank === r).length}명)`);
  check(RANKS.indexOf(b.minRank) >= 0 && Object.keys(b.odds).some(r => RANKS.indexOf(r) >= RANKS.indexOf(b.minRank)), `${b.name}: 보장 등급(${b.minRank}) 이상이 확률표에 존재`); }
check(GENERAL_DATA.filter(g => g.rank === "전설" && !g.owned).length > 0, "미보유 전설 장수 존재(영입 대상)");

console.log("[2] 등급 확률 (보장 발동 전 '자연 모집' 기준, 장수 선택은 해당 등급 균등)");
const N = 5000; // 10회 × 5천 = 모집당 5만 회 (회귀 검사 시간을 줄이고 통계 허용오차를 조정)
for (const id of BANNER_IDS) {
  const b = BANNERS[id], rng = mulberry32(12345 + id.length); let s = newState(), nat = {}, natTotal = 0, maxMiss = 0, miss = 0, pullsTotal = 0, hitsAll = 0; const need = RANKS.indexOf(b.minRank);
  let windowsBad = 0, sinceHit = 0;
  for (let i = 0; i < N; i++) { const r = recruit(s, id, 10, rng); if (!r.ok) { bad("모집 실패 " + r.reason); break; } s = r.state; s.lord.gold = 1e12;
    for (const x of r.results) { pullsTotal++; const hit = RANKS.indexOf(x.rank) >= need; if (hit) { hitsAll++; miss = 0; } else { miss++; maxMiss = Math.max(maxMiss, miss); }
      if (!x.guaranteed) { nat[x.rank] = (nat[x.rank] || 0) + 1; natTotal++; } } }
  const line = Object.keys(b.odds).map(rk => { const p = (nat[rk] || 0) / natTotal * 100, diff = Math.abs(p - b.odds[rk]); if (diff > 0.8) bad(`${b.name} ${rk} 자연 확률 ${p.toFixed(3)}% (목표 ${b.odds[rk]}%)`); return `${rk} ${p.toFixed(2)}%(목표 ${b.odds[rk]}%)`; }).join(" / ");
  console.log(`       ${b.name} ${pullsTotal.toLocaleString()}회: ${line}`);
  check(maxMiss <= PITY_LIMIT - 1, `${b.name}: 보장 등급(${b.minRank}↑) 연속 미출현 최대 ${maxMiss}회 (≤ ${PITY_LIMIT - 1})`);
  console.log(`       ${b.name} 보장 포함 실제 ${b.minRank}↑ 비율 ${(hitsAll / pullsTotal * 100).toFixed(2)}%`);
}

console.log("[3] 10회 보장 (처음 상태에서 10연속 모집, 및 1회씩 여러 번 모집해도 누적 보장)");
for (const id of BANNER_IDS) { const b = BANNERS[id], need = RANKS.indexOf(b.minRank), rng = mulberry32(777); let badWin = 0;
  for (let i = 0; i < 500; i++) { const r = recruit(newState(), id, 10, rng); if (!r.results.some(x => RANKS.indexOf(x.rank) >= need)) badWin++; }
  check(badWin === 0, `${b.name}: 10연속 모집 500회 중 보장 등급 없는 경우 ${badWin}번`);
  let s = newState(), worst = 0, run = 0; for (let i = 0; i < 8000; i++) { const r = recruit(s, id, 1, rng); s = r.state; s.lord.gold = 1e12; if (RANKS.indexOf(r.results[0].rank) >= need) run = 0; else { run++; worst = Math.max(worst, run); } }
  check(worst <= 9, `${b.name}: 1회씩 8천 번 모집해도 연속 미출현 최대 ${worst}회`); }
{ // 결정적 시나리오: 난수가 항상 최저 등급만 뽑도록 고정 → 정확히 10번째에 보장 발동
  const s = newState(); let cur = s, hits = []; const lowRng = () => 0;
  for (let i = 1; i <= 25; i++) { const r = recruit(cur, "normal", 1, lowRng); cur = r.state; if (r.results[0].guaranteed) hits.push(i); }
  check(JSON.stringify(hits) === "[10,20]", `일반 모집: 항상 최저 등급이 나오는 최악 난수에서도 10·20번째에 보장 발동 ${JSON.stringify(hits)}`);
  cur = newState(); hits = []; for (let i = 1; i <= 25; i++) { const r = recruit(cur, "legend", 1, lowRng); cur = r.state; if (r.results[0].guaranteed) hits.push(i); if (r.results[0].guaranteed) check(r.results[0].rank === "전설", `전설 모집 ${i}번째 보장 결과는 전설`); }
  check(JSON.stringify(hits) === "[10,20]", `전설 모집 최악 난수 보장 위치 ${JSON.stringify(hits)}`); }

console.log("[4] 최소 등급 / 중복 → 혼 조각");
for (const id of BANNER_IDS) { const rng = mulberry32(99); let s = newState(); const allowed = new Set(Object.keys(BANNERS[id].odds)); let outside = 0; for (let i = 0; i < 500; i++) { const r = recruit(s, id, 10, rng); s = r.state; s.lord.gold = 1e12; for (const x of r.results) if (!allowed.has(x.rank)) outside++; } check(outside === 0, `${BANNERS[id].name}: 확률표에 없는 등급이 나온 횟수 ${outside}`); }
{ const s = newState(); for (const g of s.generals) g.owned = true; let total = 0, exp = 0; const rng = mulberry32(5); let cur = s;
  for (let i = 0; i < 300; i++) { const r = recruit(cur, "normal", 10, rng); cur = r.state; cur.lord.gold = 1e12; for (const x of r.results) { exp += SHARD_PER_DUPLICATE[x.rank]; if (x.isNew || x.shards !== SHARD_PER_DUPLICATE[x.rank]) bad("중복 결과 불일치 " + JSON.stringify(x)); } }
  total = Object.values(cur.shards).reduce((a, c) => a + c, 0); check(total === exp, `전원 보유 상태: 혼 조각 합계 ${total} = 기대 ${exp}`);
  check(cur.generals.every(g => g.owned) && cur.generals.length === GENERAL_DATA.length, "중복 모집으로 장수가 늘거나 줄지 않음"); }
{ const s = newState(); let cur = s, seen = new Set(), newCount = 0, dupShard = 0; const rng = mulberry32(31337);
  for (let i = 0; i < 500; i++) { const r = recruit(cur, "elite", 10, rng); cur = r.state; cur.lord.gold = 1e12; for (const x of r.results) { if (x.isNew) { newCount++; if (seen.has(x.generalId)) bad("같은 장수가 두 번 NEW 처리됨"); seen.add(x.generalId); } else dupShard += x.shards; } }
  check(dupShard === cur.shards.희귀 * 1 + cur.shards.영웅 + cur.shards.전설 + cur.shards.고급 + cur.shards.일반, "NEW/중복 구분 및 혼 조각 누적 일치"); }

console.log("[5] 금화·원자성(실패 시 원본 보존)");
{ const s = newState(150); const before = JSON.stringify(s);
  let r = recruit(s, "normal", 10, mulberry32(1)); check(!r.ok && JSON.stringify(s) === before, "금화 부족(10회 900 필요/150 보유) → 실패, 원본 불변");
  r = recruit(s, "normal", 1, mulberry32(1)); check(r.ok && r.state.lord.gold === 50 && JSON.stringify(s) === before, "1회 100금 차감, 입력 state 불변"); }
{ const s = newState(900); const r = recruit(s, "normal", 10, mulberry32(2)); check(r.ok && r.state.lord.gold === 0, "정확히 900금으로 10회 가능 → 잔액 0"); const r2 = recruit(r.state, "normal", 1, mulberry32(2)); check(!r2.ok, "잔액 0에서 모집 불가"); }
{ const s = newState(1e9); for (const [a, c] of [["nope", 1], ["normal", 0], ["normal", 5], ["normal", -1]]) check(!recruit(s, a, c).ok, `잘못된 요청 거부: ${a}/${c}`); }
{ const s = newState(1e6); const before = recruit(s, "legend", 10, mulberry32(3)); check(before.cost === 13500 && s.lord.gold - before.state.lord.gold === 13500, "전설 10회 비용 13,500 차감"); }

console.log("[6] 전설 혼 조각 100개 → 미보유 전설 선택 영입");
{ const s = newState(); s.shards.전설 = 99; const legends = s.generals.filter(g => g.rank === "전설" && !g.owned); const target = legends[0].id;
  check(!redeemLegend(s, target).ok, "혼 조각 99개: 영입 불가");
  s.shards.전설 = 100; const owned = s.generals.find(g => g.owned && g.rank === "전설").id; check(!redeemLegend(s, owned).ok, "이미 보유한 전설은 영입 불가");
  const nonLegend = s.generals.find(g => g.rank === "영웅").id; check(!redeemLegend(s, nonLegend).ok, "전설이 아닌 장수는 영입 불가");
  const before = JSON.stringify(s); const r = redeemLegend(s, target); check(r.ok && r.state.generals.find(g => g.id === target).owned && r.state.shards.전설 === 0 && JSON.stringify(s) === before, "100개로 선택한 전설 장수 영입, 조각 0, 원본 불변");
  const r2 = redeemLegend({ ...r.state, shards: { ...r.state.shards, 전설: 250 } }, legends[1].id); check(r2.ok && r2.state.shards.전설 === 150, "250개 보유 시 영입 후 150개 남음"); }

console.log("[7] 저장 형식 변환 (v1 → v7)");
{ const v1 = { saveFormatVersion: 1, appDataVersion: "0.3.1", lord: { level: 3, exp: 10, gold: 4321, gems: 0 }, generals: clone(GENERAL_DATA.slice(0, 50)), inventory: { a: 1 }, settings: {}, records: { battleWins: 2, battleLosses: 1, duelCount: 3 } };
  v1.generals[4].owned = true; v1.generals[4].level = 7; const snap = JSON.stringify(v1);
  const m = D.migrateState(v1); ensureRecruitState(m);
  check(m.saveFormatVersion === SAVE_FORMAT_VERSION && m.lord.gold === 4321 && m.records.battleWins === 2 && m.inventory.a === 1 && m.generals[4].level === 7 && m.generals[4].owned, "기존 금화·전적·인벤토리·장수 상태 유지");
  check(m.recruit && m.shards && m.recruit.pity.normal === 0 && m.shards.전설 === 0, "recruit/shards 기본값 생성");
  check(m.inventory.expManual === 3 && m.inventory.awakeningStone === 0 && m.generals.every(g => Number.isInteger(g.awakening)), "v0.5.0 육성 재화·각성 필드 마이그레이션");
  check(JSON.stringify(v1) === snap, "변환 입력 객체 불변");
  let threw = false; try { D.migrateState({ saveFormatVersion: SAVE_FORMAT_VERSION + 1 }); } catch (e) { threw = true; } check(threw, "더 새로운 저장 형식은 오류로 거부 (데이터 덮어쓰기 방지)");
  const m2 = D.migrateState({ saveFormatVersion: SAVE_FORMAT_VERSION, generals: [] }); check(m2.saveFormatVersion === SAVE_FORMAT_VERSION, "최신 형식은 그대로 통과");
  const bogus = { recruit: { pity: { normal: 99, elite: -4, legend: "x" }, totalPulls: null, lastResults: "bad" }, shards: { 전설: -5, 영웅: 2.7 } }; ensureRecruitState(bogus);
  check(bogus.recruit.pity.normal === 9 && bogus.recruit.pity.elite === 0 && bogus.recruit.pity.legend === 0 && bogus.shards.전설 === 0 && bogus.shards.영웅 === 2 && Array.isArray(bogus.recruit.lastResults), "손상된 recruit/shards 값 자동 보정"); }

console.log(fail ? `\n결과: ${fail}건 실패` : "\n결과: 모집 시스템 테스트 모두 통과"); process.exit(fail ? 1 : 0);
