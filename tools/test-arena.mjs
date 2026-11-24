import assert from 'node:assert/strict';
import { GENERAL_DATA } from '../browser-test/js/generals.js';
import { arenaStats, simulateArena } from '../browser-test/js/arena.js';
const owned=GENERAL_DATA.filter(g=>g.owned).slice(0,4).map(g=>g.id);
const enemy=GENERAL_DATA.filter(g=>!owned.includes(g.id)).slice(0,4).map(g=>g.id);
assert.equal(owned.length,4,'테스트용 보유 장수 4명');
assert.equal(enemy.length,4,'AI 장수 4명');
for(const g of GENERAL_DATA){const s=arenaStats(g);for(const k of ['hp','maxHp','atk','def','spd','crit'])assert(Number.isFinite(s[k])&&s[k]>0,`${g.name} ${k} 유효`);assert.equal(s.hp,s.maxHp);}
let observedStatus=false;
for(let i=0;i<100;i++){
 const r=simulateArena(GENERAL_DATA,owned,enemy,[]);
 assert.equal(r.player.length,4);assert.equal(r.enemy.length,4);assert(r.turns>=1&&r.turns<=40);assert(r.log.length>0);if(r.log.some(x=>/기절|속도 감소|보호막|지속 피해|공격력 증가/.test(x)))observedStatus=true;
 for(const u of [...r.player,...r.enemy]){assert(u.hp>=0&&u.hp<=u.stats.maxHp);assert(Array.isArray(u.effects));}
 assert.equal(typeof r.win,'boolean');
}
assert(observedStatus,'상태 효과 발동 로그 확인');
console.log('arena tests passed: 60명 능력치, 4대4 팀 구성, 100회 전투 시뮬레이션, 상태 효과, HP 범위 및 종료 조건');
const skillNames=GENERAL_DATA.map(g=>g.skillName);
assert.equal(new Set(skillNames).size,GENERAL_DATA.length,'60명 고유 스킬명');
const skillUnits=GENERAL_DATA.map(g=>({g,s:arenaStats(g).skill}));
assert(skillUnits.every(x=>x.s.name===x.g.skillName&&x.s.description===x.g.skillDesc),'장수별 고유 스킬 설명 연결');
assert(new Set(skillUnits.map(x=>x.s.type)).size>=5,'서로 다른 스킬 효과 유형');
console.log('unique skill tests passed: 60명 고유 스킬명/설명, 효과 유형 다양성');
