import { totalEquipmentBonuses } from "./equipment.js";
// 장수별 전투 효과 계산. 데이터는 generals.js의 combatEffects에서 읽습니다.
export function calculatePower(g, equipmentInventory=[]) {
  const eq=totalEquipmentBonuses(g, equipmentInventory);
  const martial=g.stats.martial+(eq.martial||0), intelligence=g.stats.intelligence+(eq.intelligence||0), leadership=g.stats.leadership+(eq.leadership||0);
  const s = g.style === "공격형" ? martial : g.style === "전술형" ? intelligence : leadership;
  return s * .65 + leadership * .2 + intelligence * .15 + (g.level || 1) * 1.5 + (g.awakening || 0) * 3 + (eq.power||0);
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
