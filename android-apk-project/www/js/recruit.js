// 장수 모집 규칙 (v0.4.0). 화면(DOM)과 무관한 순수 계산 모듈이라 Node.js에서도 그대로 테스트할 수 있습니다.
// 확률·비용·혼 조각 수치는 모두 이 파일 맨 위 설정값만 고치면 됩니다.

export const RANKS = ["일반", "고급", "희귀", "영웅", "전설"];

// odds: 등급별 확률(%) 합계 100 / minRank: 10회 보장 최소 등급 / cost: 금화 비용
export const BANNERS = {
  normal: { id: "normal", name: "일반 모집", odds: { 일반: 55, 고급: 30, 희귀: 12, 영웅: 3 }, minRank: "고급", cost: { single: 100, ten: 900 } },
  elite:  { id: "elite",  name: "명장 모집", odds: { 희귀: 65, 영웅: 27, 전설: 8 },            minRank: "영웅", cost: { single: 500, ten: 4500 } },
  legend: { id: "legend", name: "전설 모집", odds: { 영웅: 75, 전설: 25 },                      minRank: "전설", cost: { single: 1500, ten: 13500 } },
};
export const BANNER_IDS = Object.keys(BANNERS);
export const PITY_LIMIT = 10;                                              // 보장 기준 횟수
export const SHARD_PER_DUPLICATE = { 일반: 1, 고급: 3, 희귀: 5, 영웅: 10, 전설: 20 }; // 중복 장수 1명당 혼 조각
export const LEGEND_REDEEM_COST = 100;                                     // 전설 혼 조각으로 전설 장수 영입
export const LAST_RESULTS_KEEP = 10;

const rankIndex = r => RANKS.indexOf(r);

// 기본 난수: 브라우저/Node 모두 지원하는 crypto 난수 (0 이상 1 미만)
export function defaultRng() {
  const c = globalThis.crypto;
  if (c?.getRandomValues) { const a = new Uint32Array(1); c.getRandomValues(a); return a[0] / 4294967296; }
  return Math.random();
}

export function defaultRecruitState() { return { pity: { normal: 0, elite: 0, legend: 0 }, totalPulls: { normal: 0, elite: 0, legend: 0 }, lastResults: [] }; }
export function defaultShards() { return { 일반: 0, 고급: 0, 희귀: 0, 영웅: 0, 전설: 0 }; }

const toInt = (v, max = Infinity) => (Number.isFinite(v) && v > 0 ? Math.min(Math.floor(v), max) : 0);
// 저장 데이터/백업에서 온 값이 비어 있거나 이상해도 안전한 구조로 맞춥니다. (state를 직접 수정)
export function ensureRecruitState(state) {
  const r = state.recruit && typeof state.recruit === "object" ? state.recruit : {};
  const base = defaultRecruitState();
  state.recruit = {
    pity: Object.fromEntries(BANNER_IDS.map(id => [id, toInt(r.pity?.[id], PITY_LIMIT - 1)])),
    totalPulls: Object.fromEntries(BANNER_IDS.map(id => [id, toInt(r.totalPulls?.[id])])),
    lastResults: Array.isArray(r.lastResults) ? r.lastResults.filter(x => x && typeof x.generalId === "string").slice(0, LAST_RESULTS_KEEP) : base.lastResults,
  };
  state.shards = Object.fromEntries(RANKS.map(rk => [rk, toInt(state.shards?.[rk])]));
  return state;
}

// weights: {등급: 확률} 에서 난수 하나로 등급을 뽑습니다.
function pickRank(weights, rng) {
  const entries = Object.entries(weights); const total = entries.reduce((a, [, w]) => a + w, 0);
  let x = rng() * total;
  for (const [rank, w] of entries) { if (x < w) return rank; x -= w; }
  return entries[entries.length - 1][0];
}
function pickGeneral(generals, rank, rng) {
  const pool = generals.filter(g => g.rank === rank);
  return pool.length ? pool[Math.floor(rng() * pool.length) % pool.length] : null;
}

// 남은 모집 보장까지의 횟수 (화면 표시용). 0이면 이번 모집이 보장 모집입니다.
export function pullsUntilGuarantee(state, bannerId) { return PITY_LIMIT - 1 - (state.recruit?.pity?.[bannerId] || 0); }
export function recruitCost(bannerId, count) { const b = BANNERS[bannerId]; return count === 10 ? b.cost.ten : b.cost.single * count; }

// 모집 1~10회를 수행합니다. state는 수정하지 않고, 성공하면 새 state를 돌려줍니다. (실패해도 원본은 그대로)
export function recruit(state, bannerId, count, rng = defaultRng) {
  const banner = BANNERS[bannerId];
  if (!banner) return { ok: false, reason: "알 수 없는 모집입니다." };
  if (count !== 1 && count !== 10) return { ok: false, reason: "모집은 1회 또는 10회만 가능합니다." };
  const cost = recruitCost(bannerId, count);
  if (!Number.isFinite(state.lord?.gold) || state.lord.gold < cost) return { ok: false, reason: `금화가 부족합니다. (필요 ${cost}, 보유 ${state.lord?.gold ?? 0})` };

  const next = JSON.parse(JSON.stringify(state)); ensureRecruitState(next);
  next.lord.gold -= cost;
  const minIdx = rankIndex(banner.minRank);
  const qualifying = Object.fromEntries(Object.entries(banner.odds).filter(([r]) => rankIndex(r) >= minIdx)); // 보장 모집에서 쓰는 등급 후보
  const results = [];

  for (let i = 0; i < count; i++) {
    const forced = next.recruit.pity[bannerId] >= PITY_LIMIT - 1;      // 직전 9회 연속 보장 등급 미달 → 이번이 10번째
    let rank = pickRank(forced ? qualifying : banner.odds, rng);
    let general = pickGeneral(next.generals, rank, rng);
    if (!general) {                                                    // 방어: 해당 등급 장수가 데이터에 없을 때 같은 모집의 다른 등급으로 대체
      const alt = Object.keys(forced ? qualifying : banner.odds).find(r => pickGeneral(next.generals, r, () => 0));
      if (!alt) return { ok: false, reason: "모집 가능한 장수 데이터가 없습니다." };
      rank = alt; general = pickGeneral(next.generals, rank, rng);
    }
    const hit = rankIndex(rank) >= minIdx;
    next.recruit.pity[bannerId] = hit ? 0 : next.recruit.pity[bannerId] + 1;
    next.recruit.totalPulls[bannerId] += 1;

    const target = next.generals.find(g => g.id === general.id);
    let isNew = false, shards = 0;
    if (!target.owned) { target.owned = true; isNew = true; }
    else { shards = SHARD_PER_DUPLICATE[rank]; next.shards[rank] += shards; }  // 중복 → 등급별 혼 조각
    results.push({ generalId: general.id, rank, isNew, shards, guaranteed: forced && hit });
  }
  next.recruit.lastResults = results.slice(-LAST_RESULTS_KEEP);
  return { ok: true, state: next, results, cost };
}

// 전설 혼 조각으로 미보유 전설 장수 한 명을 선택 영입합니다.
export function redeemLegend(state, generalId) {
  const target = state.generals.find(g => g.id === generalId);
  if (!target || target.rank !== "전설") return { ok: false, reason: "영입할 수 없는 장수입니다." };
  if (target.owned) return { ok: false, reason: "이미 보유한 장수입니다." };
  if ((state.shards?.전설 || 0) < LEGEND_REDEEM_COST) return { ok: false, reason: `전설 혼 조각이 부족합니다. (필요 ${LEGEND_REDEEM_COST}, 보유 ${state.shards?.전설 || 0})` };
  const next = JSON.parse(JSON.stringify(state)); ensureRecruitState(next);
  next.shards.전설 -= LEGEND_REDEEM_COST;
  next.generals.find(g => g.id === generalId).owned = true;
  return { ok: true, state: next };
}
