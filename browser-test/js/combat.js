// 장수별 전투 효과 계산. 데이터는 generals.js의 combatEffects에서 읽습니다.
export function calculatePower(g) {
  const s = g.style === "공격형" ? g.stats.martial : g.style === "전술형" ? g.stats.intelligence : g.stats.leadership;
  return s * .65 + g.stats.leadership * .2 + g.stats.intelligence * .15 + (g.level || 1) * 1.5 + (g.awakening || 0) * 3;
}
export function passiveCombatBonus(g) {
  const e = g.combatEffects?.passive; return e && Number.isFinite(e.rate) ? (g.stats[e.stat] || 0) * e.rate : 0;
}
export function weaknessCombatPenalty(g, opponent) {
  const e = g.combatEffects?.weakness; return e && opponent?.style === e.style ? e.penalty : 0;
}
export function ultimateCombatBonus(g, matchupAdvantage) {
  const e = g.combatEffects?.ultimate; return e ? e.base + (matchupAdvantage > 0 ? e.counterBonus : 0) : 0;
}
