// v0.5.0 장수 육성 규칙: 순수 계산 모듈
export const MAX_GENERAL_LEVEL = 30;
export const MAX_AWAKENING = 5;
export const EXP_MANUAL_VALUE = 100;
export const AWAKEN_STONE_COST = 3;
export function expRequired(level) { return Math.max(1, Math.min(MAX_GENERAL_LEVEL, Math.floor(level))) * 100; }
export function normalizeGeneralProgress(g) {
  g.level = Math.max(1, Math.min(MAX_GENERAL_LEVEL, Math.floor(Number(g.level) || 1)));
  g.exp = Math.max(0, Math.floor(Number(g.exp) || 0));
  g.awakening = Math.max(0, Math.min(MAX_AWAKENING, Math.floor(Number(g.awakening) || 0)));
  if (g.level >= MAX_GENERAL_LEVEL) g.exp = 0;
  else { const need = expRequired(g.level); if (g.exp >= need) g.exp %= need; }
  return g;
}
export function addExperience(general, amount) {
  const g = { ...general }; normalizeGeneralProgress(g);
  let gained = Math.max(0, Math.floor(Number(amount) || 0));
  if (g.level >= MAX_GENERAL_LEVEL || !gained) return { general: g, gained: 0, levels: 0 };
  const before = g.level; g.exp += gained;
  while (g.level < MAX_GENERAL_LEVEL && g.exp >= expRequired(g.level)) { g.exp -= expRequired(g.level); g.level++; }
  if (g.level >= MAX_GENERAL_LEVEL) g.exp = 0;
  return { general: g, gained, levels: g.level - before };
}
export function awakenGeneral(state, generalId) {
  const original = state.generals.find(g => g.id === generalId);
  if (!original || !original.owned) return { ok:false, reason:"보유한 장수만 각성할 수 있습니다." };
  const target = { ...original }; normalizeGeneralProgress(target);
  if (target.awakening >= MAX_AWAKENING) return { ok:false, reason:"최대 각성 단계입니다." };
  const stones = Math.max(0, Math.floor(Number(state.inventory?.awakeningStone) || 0));
  if (stones < AWAKEN_STONE_COST) return { ok:false, reason:`각성석이 부족합니다. (필요 ${AWAKEN_STONE_COST}, 보유 ${stones})` };
  const next = JSON.parse(JSON.stringify(state));
  next.inventory.awakeningStone -= AWAKEN_STONE_COST;
  const g = next.generals.find(x => x.id === generalId); g.awakening = (g.awakening || 0) + 1;
  return { ok:true, state:next, general:g };
}
