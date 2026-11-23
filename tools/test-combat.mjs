import { GENERAL_DATA } from "../browser-test/js/generals.js";
import { calculatePower, passiveCombatBonus, weaknessCombatPenalty, ultimateCombatBonus } from "../browser-test/js/combat.js";
let fail=0;const check=(v,m)=>{if(v)console.log("OK",m);else{console.log("FAIL",m);fail++}};
check(GENERAL_DATA.every(g=>Number.isFinite(calculatePower(g))&&Number.isFinite(passiveCombatBonus(g))&&Number.isFinite(ultimateCombatBonus(g,1))),"60명 전투력·특성·필살기 계산 유효");
check(GENERAL_DATA.every(g=>weaknessCombatPenalty(g,{style:g.combatEffects.weakness.style})===g.combatEffects.weakness.penalty),"장수별 약점 대상과 페널티 적용");
check(GENERAL_DATA.every(g=>ultimateCombatBonus(g,1)>ultimateCombatBonus(g,0)),"상성 우위일 때 개별 필살기 추가 보너스 적용");
const g={...GENERAL_DATA[0],level:1,awakening:0};const p1=calculatePower(g);g.awakening=1;check(calculatePower(g)===p1+3,"각성 1단계당 전투력 +3");
console.log(fail?`${fail} failures`:"combat tests passed");process.exit(fail?1:0);
